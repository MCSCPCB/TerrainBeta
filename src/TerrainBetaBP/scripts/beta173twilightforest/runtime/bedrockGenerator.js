import { getTwilightBiomeIdFromClimate } from "../biome/index.js";
import { buildHeightmap, buildHeightmapColumns } from "../terrain/chunk.js";
import {
  addGlaciers,
  generateBaseTerrainCellColumns,
  generateDensityFieldExact,
  terraformChunk,
} from "../terrain/density.js";
import { Beta173TwilightForestGenerator } from "../terrain/generator.js";
import { raiseHills } from "../terrain/generator.js";
import { replaceBlocksForBiomesExact } from "../terrain/surface.js";
import {
  copyChunkIntoPopulationRegion,
  createPopulationRegion,
  createPopulationRegionShell,
  extractCenterChunkColumns,
  extractCenterChunkFromRegion,
} from "../population/region.js";
import {
  POPULATION_REGION_DIAMETER,
  POPULATION_REGION_RADIUS,
  POPULATION_REGION_SIZE,
} from "../population/shared.js";
import { getPopulationRandom } from "../../beta173/population/seeding.js";
import { createOreSession, advanceOreSession, applyTwilightOres } from "../features/deposits.js";
import { createFloraSession, advanceFloraSession, applyTwilightFlora } from "../features/flora.js";
import { createLakeSession, advanceLakeSession, applyTwilightLakes } from "../features/lakes.js";
import { createSpringSession, advanceSpringSession, applyTwilightSprings } from "../features/springs.js";
import { createSnowSession, advanceSnowSession, applyTwilightSnow } from "../features/snow.js";
import { createTreeSession, advanceTreeSession, applyTwilightTrees } from "../features/trees.js";
import {
  createRandomFeatureSession,
  advanceRandomFeatureSession,
  applyTwilightRandomFeature,
} from "../features/randomFeatures.js";
import {
  createHollowTreeSession,
  advanceHollowTreeSession,
  applyTwilightHollowTree,
} from "../features/hollowTree.js";
import {
  createHollowHillSession,
  advanceHollowHillSession,
  applyTwilightHollowHill,
} from "../features/hollowHill.js";
import { hillSize, isHollowHill } from "../terrain/hills.js";

export { BEDROCK_BLOCK_MAP } from "../world/blocks.js";

const CACHE_LIMIT = 81;
const SOURCE_MIN_OFFSET = -1;
const SOURCE_MAX_OFFSET = 0;
const BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP = 1;
const BACKGROUND_HEIGHTMAP_COLUMNS_PER_STEP = 1;
const BACKGROUND_REGION_COPY_CHUNKS_PER_STEP = 1;
const BACKGROUND_REGION_EXTRACT_COLUMNS_PER_STEP = 1;
const BACKGROUND_DECORATION_STAGE_KEYS = Object.freeze([
  "lakes",
  "random_features",
  "hollow_trees",
  "ores",
  "trees",
  "flora",
  "springs",
  "snow",
  "hollow_hills",
]);

function cloneChunk(chunk) {
  return {
    ...chunk,
    blocks: chunk.blocks.slice(),
    biomes: chunk.biomes.slice(),
    temperature: chunk.temperature.slice(),
    rainfall: chunk.rainfall.slice(),
    humidity: chunk.humidity.slice(),
    densityField: chunk.densityField.slice(),
    heightmap: chunk.heightmap.slice(),
  };
}

function getPopulationRegionSourceChunk(chunkX, chunkZ, copyCursor) {
  return {
    x: chunkX - POPULATION_REGION_RADIUS + Math.floor(copyCursor / POPULATION_REGION_DIAMETER),
    z: chunkZ - POPULATION_REGION_RADIUS + (copyCursor % POPULATION_REGION_DIAMETER),
  };
}

function getPopulationFeatureSourceChunk(chunkX, chunkZ, sourceCursor) {
  return {
    x: chunkX + SOURCE_MIN_OFFSET + Math.floor(sourceCursor / 2),
    z: chunkZ + SOURCE_MIN_OFFSET + (sourceCursor % 2),
  };
}

export class Beta173TwilightForestBedrockGenerator {
  constructor(seed, options = {}) {
    this.seed = seed;
    this.options = {
      lakes: options.lakes ?? true,
      randomFeatures: options.randomFeatures ?? true,
      hollowTrees: options.hollowTrees ?? true,
      ores: options.ores ?? true,
      trees: options.trees ?? true,
      flora: options.flora ?? true,
      springs: options.springs ?? true,
      snow: options.snow ?? true,
      hollowHills: options.hollowHills ?? true,
      farlandsCoordinate: options.farlandsCoordinate,
      surfacePalette: options.surfacePalette ?? null,
    };
    this.generator = new Beta173TwilightForestGenerator(seed, {
      farlandsCoordinate: this.options.farlandsCoordinate,
      surfacePalette: this.options.surfacePalette,
    });
    this.baseChunkCache = new Map();
    this.populationBiomeCache = new Map();
    this.populationClimateCache = new Map();
    this.populationRegionScratch = new Uint16Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * 128);
    this.hasPopulationFeatures = (
      this.options.lakes
      || this.options.randomFeatures
      || this.options.hollowTrees
      || this.options.ores
      || this.options.trees
      || this.options.flora
      || this.options.springs
      || this.options.snow
      || this.options.hollowHills
    );
  }

  getCachedValue(cache, key, factory) {
    if (cache.has(key)) {
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const value = factory();
    this.putCachedValue(cache, key, value);
    return value;
  }

  putCachedValue(cache, key, value) {
    if (cache.has(key)) {
      cache.delete(key);
    } else if (cache.size >= CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    cache.set(key, value);
    return value;
  }

  peekCachedValue(cache, key) {
    if (!cache.has(key)) {
      return null;
    }

    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }

  cacheBaseChunk(chunk) {
    return this.putCachedValue(this.baseChunkCache, `${chunk.chunkX}|${chunk.chunkZ}`, chunk);
  }

  peekBaseChunk(chunkX, chunkZ) {
    return this.peekCachedValue(this.baseChunkCache, `${chunkX}|${chunkZ}`);
  }

  getBaseChunk(chunkX, chunkZ) {
    this.generator.applyRuntimeConfig();
    return this.getCachedValue(
      this.baseChunkCache,
      `${chunkX}|${chunkZ}`,
      () => this.generator.generateChunk(chunkX, chunkZ),
    );
  }

  getPopulationClimate(chunkX, chunkZ) {
    return this.getCachedValue(
      this.populationClimateCache,
      `${chunkX}|${chunkZ}`,
      () => this.generator.climateGenerator.generateArea(chunkX * 16 + 8, chunkZ * 16 + 8, 16, 16),
    );
  }

  getPopulationBiome(chunkX, chunkZ) {
    return this.getCachedValue(
      this.populationBiomeCache,
      `${chunkX}|${chunkZ}`,
      () => {
        const climate = this.getPopulationClimate(chunkX, chunkZ);
        const centerIndex = 8 * 16 + 8;
        return getTwilightBiomeIdFromClimate(
          climate.temperature[centerIndex],
          climate.humidity[centerIndex],
        );
      },
    );
  }

  createBackgroundBaseChunkSession(chunkX, chunkZ) {
    const cachedChunk = this.peekBaseChunk(chunkX, chunkZ);
    if (cachedChunk) {
      return {
        chunkX,
        chunkZ,
        chunk: cachedChunk,
        complete: true,
        phase: "complete",
      };
    }

    return {
      chunkX,
      chunkZ,
      climateData: null,
      densityField: null,
      blocks: new Uint16Array(16 * 16 * 128),
      baseTerrainCellX: 0,
      heightmap: new Int16Array(256),
      heightmapX: 0,
      chunk: null,
      complete: false,
      phase: "biome",
    };
  }

  advanceBackgroundBaseChunkSession(session) {
    if (session.complete) {
      return false;
    }

    switch (session.phase) {
      case "biome":
        session.climateData = this.generator.generateBiomeData(session.chunkX, session.chunkZ);
        session.phase = "density";
        return true;

      case "density":
        session.densityField = generateDensityFieldExact(
          this.generator,
          session.climateData,
          session.chunkX,
          session.chunkZ,
        );
        session.phase = "base_terrain";
        return true;

      case "base_terrain":
        generateBaseTerrainCellColumns(
          session.blocks,
          session.densityField,
          session.baseTerrainCellX,
          BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP,
        );
        session.baseTerrainCellX += BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP;
        if (session.baseTerrainCellX >= 4) {
          session.phase = "terraform";
        }
        return true;

      case "terraform":
        terraformChunk(session.blocks, session.climateData);
        addGlaciers(session.blocks, session.climateData);
        raiseHills(session.blocks, session.chunkX, session.chunkZ);
        replaceBlocksForBiomesExact(
          session.blocks,
          session.climateData,
          session.chunkX,
          session.chunkZ,
          this.generator.surfacePalette,
        );
        session.phase = "heightmap";
        return true;

      case "heightmap":
        buildHeightmapColumns(
          session.blocks,
          session.heightmap,
          session.heightmapX,
          BACKGROUND_HEIGHTMAP_COLUMNS_PER_STEP,
        );
        session.heightmapX += BACKGROUND_HEIGHTMAP_COLUMNS_PER_STEP;
        if (session.heightmapX >= 16) {
          session.chunk = this.cacheBaseChunk({
            chunkX: session.chunkX,
            chunkZ: session.chunkZ,
            blocks: session.blocks,
            biomes: session.climateData.biomes,
            temperature: session.climateData.temperature,
            rainfall: session.climateData.rainfall,
            humidity: session.climateData.humidity,
            densityField: session.densityField,
            heightmap: session.heightmap,
          });
          session.complete = true;
          session.phase = "complete";
        }
        return true;

      default:
        return false;
    }
  }

  createBackgroundTerrainSession(chunkX, chunkZ) {
    const cachedChunk = this.peekBaseChunk(chunkX, chunkZ);
    if (cachedChunk) {
      return {
        chunkX,
        chunkZ,
        terrainChunk: cloneChunk(cachedChunk),
        complete: true,
        phase: "complete",
      };
    }

    return {
      chunkX,
      chunkZ,
      baseSession: this.createBackgroundBaseChunkSession(chunkX, chunkZ),
      terrainChunk: null,
      complete: false,
      phase: "base",
    };
  }

  advanceBackgroundTerrainSession(session) {
    if (session.complete) {
      return false;
    }

    if (!session.baseSession.complete) {
      return this.advanceBackgroundBaseChunkSession(session.baseSession);
    }

    session.terrainChunk = cloneChunk(session.baseSession.chunk);
    session.complete = true;
    session.phase = "complete";
    return true;
  }

  generateTerrainChunk(chunkX, chunkZ) {
    return cloneChunk(this.getBaseChunk(chunkX, chunkZ));
  }

  decorateTerrainChunk(terrainChunk, options = {}) {
    if (!this.hasPopulationFeatures) {
      return terrainChunk;
    }

    const { chunkX, chunkZ } = terrainChunk;
    const region = createPopulationRegion(
      (sourceChunkX, sourceChunkZ) => this.getBaseChunk(sourceChunkX, sourceChunkZ),
      chunkX,
      chunkZ,
      terrainChunk.blocks,
      this.populationRegionScratch,
    );

    for (let sourceChunkX = chunkX + SOURCE_MIN_OFFSET; sourceChunkX <= chunkX + SOURCE_MAX_OFFSET; sourceChunkX += 1) {
      for (let sourceChunkZ = chunkZ + SOURCE_MIN_OFFSET; sourceChunkZ <= chunkZ + SOURCE_MAX_OFFSET; sourceChunkZ += 1) {
        const populationRandom = getPopulationRandom(this.seed, sourceChunkX, sourceChunkZ);
        const sourceBiome = this.getPopulationBiome(sourceChunkX, sourceChunkZ);
        const climate = this.options.snow
          ? this.getPopulationClimate(sourceChunkX, sourceChunkZ)
          : null;

        if (this.options.lakes) {
          applyTwilightLakes(region, sourceBiome, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.randomFeatures) {
          applyTwilightRandomFeature(region, populationRandom, sourceBiome, sourceChunkX, sourceChunkZ);
        }
        if (this.options.hollowTrees) {
          applyTwilightHollowTree(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.ores) {
          applyTwilightOres(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.trees) {
          applyTwilightTrees(region, sourceBiome, this.generator.forestNoise, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.flora) {
          applyTwilightFlora(region, sourceBiome, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.springs) {
          applyTwilightSprings(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.snow && climate) {
          applyTwilightSnow(region, climate, sourceChunkX, sourceChunkZ);
        }
        if (this.options.hollowHills && isHollowHill(sourceChunkX, sourceChunkZ, 0n)) {
          applyTwilightHollowHill(
            region,
            populationRandom,
            hillSize(sourceChunkX, sourceChunkZ, 0n),
            sourceChunkX * 16 + 8,
            17,
            sourceChunkZ * 16 + 8,
          );
        }
      }
    }

    const decoratedBlocks = extractCenterChunkFromRegion(region, chunkX, chunkZ);
    return {
      ...terrainChunk,
      blocks: decoratedBlocks,
      heightmap: options.rebuildHeightmap === false
        ? terrainChunk.heightmap
        : buildHeightmap(decoratedBlocks),
    };
  }

  startBackgroundDecorationStage(session) {
    const sourceChunk = getPopulationFeatureSourceChunk(
      session.terrainChunk.chunkX,
      session.terrainChunk.chunkZ,
      session.sourceCursor,
    );
    const populationRandom = session.populationRandom;
    const sourceBiome = session.sourceBiome;
    const climate = session.sourceClimate;
    const stageKey = BACKGROUND_DECORATION_STAGE_KEYS[session.stageIndex];

    switch (stageKey) {
      case "lakes":
        if (!this.options.lakes) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createLakeSession(
          session.region,
          sourceBiome,
          populationRandom,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "random_features":
        if (!this.options.randomFeatures) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createRandomFeatureSession(
          session.region,
          populationRandom,
          sourceBiome,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "hollow_trees":
        if (!this.options.hollowTrees) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createHollowTreeSession(
          session.region,
          populationRandom,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "ores":
        if (!this.options.ores) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createOreSession(
          session.region,
          populationRandom,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "trees":
        if (!this.options.trees) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createTreeSession(
          session.region,
          sourceBiome,
          this.generator.forestNoise,
          populationRandom,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "flora":
        if (!this.options.flora) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createFloraSession(
          session.region,
          sourceBiome,
          populationRandom,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "springs":
        if (!this.options.springs) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createSpringSession(
          session.region,
          populationRandom,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "snow":
        if (!this.options.snow || !climate) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createSnowSession(
          session.region,
          climate,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "hollow_hills":
        if (!this.options.hollowHills || !isHollowHill(sourceChunk.x, sourceChunk.z, 0n)) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createHollowHillSession(
          session.region,
          populationRandom,
          hillSize(sourceChunk.x, sourceChunk.z, 0n),
          sourceChunk.x * 16 + 8,
          17,
          sourceChunk.z * 16 + 8,
        );
        return "session";

      default:
        return "skip";
    }
  }

  advanceBackgroundDecorationStageSession(session) {
    switch (session.currentStage) {
      case "lakes":
        return advanceLakeSession(session.currentFeatureSession);
      case "random_features":
        return advanceRandomFeatureSession(session.currentFeatureSession);
      case "hollow_trees":
        return advanceHollowTreeSession(session.currentFeatureSession);
      case "ores":
        return advanceOreSession(session.currentFeatureSession);
      case "trees":
        return advanceTreeSession(session.currentFeatureSession);
      case "flora":
        return advanceFloraSession(session.currentFeatureSession);
      case "springs":
        return advanceSpringSession(session.currentFeatureSession);
      case "snow":
        return advanceSnowSession(session.currentFeatureSession);
      case "hollow_hills":
        return advanceHollowHillSession(session.currentFeatureSession);
      default:
        return false;
    }
  }

  advanceBackgroundDecorationSource(session) {
    session.stageIndex += 1;
    session.currentStage = "";
    session.currentFeatureSession = null;

    if (session.stageIndex >= BACKGROUND_DECORATION_STAGE_KEYS.length) {
      session.stageIndex = 0;
      session.sourceCursor += 1;
      session.populationRandom = null;
      session.sourceBiome = null;
      session.sourceClimate = null;

      if (session.sourceCursor >= 4) {
        session.phase = "extract";
      }
    }
  }

  createBackgroundDecorationSession(terrainChunk) {
    if (!this.hasPopulationFeatures) {
      return {
        terrainChunk,
        decoratedBlocks: terrainChunk.blocks,
        complete: true,
        phase: "complete",
      };
    }

    return {
      terrainChunk,
      region: createPopulationRegionShell(
        terrainChunk.chunkX,
        terrainChunk.chunkZ,
        new Uint16Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * 128),
      ),
      copyCursor: 0,
      dependencyBaseSession: null,
      sourceCursor: 0,
      stageIndex: 0,
      currentStage: "",
      currentFeatureSession: null,
      populationRandom: null,
      sourceBiome: null,
      sourceClimate: null,
      decoratedBlocks: new Uint16Array(16 * 16 * 128),
      extractX: 0,
      phase: "copy",
      complete: false,
    };
  }

  advanceBackgroundDecorationSession(session) {
    if (session.complete) {
      return false;
    }

    if (session.phase === "copy") {
      let processed = 0;
      const totalChunks = POPULATION_REGION_DIAMETER * POPULATION_REGION_DIAMETER;
      while (processed < BACKGROUND_REGION_COPY_CHUNKS_PER_STEP && session.copyCursor < totalChunks) {
        const sourceChunk = getPopulationRegionSourceChunk(
          session.terrainChunk.chunkX,
          session.terrainChunk.chunkZ,
          session.copyCursor,
        );

        if (sourceChunk.x === session.terrainChunk.chunkX && sourceChunk.z === session.terrainChunk.chunkZ) {
          copyChunkIntoPopulationRegion(session.region, sourceChunk.x, sourceChunk.z, session.terrainChunk.blocks);
          session.copyCursor += 1;
          processed += 1;
          continue;
        }

        if (!session.dependencyBaseSession) {
          const cachedChunk = this.peekBaseChunk(sourceChunk.x, sourceChunk.z);
          if (cachedChunk) {
            copyChunkIntoPopulationRegion(session.region, sourceChunk.x, sourceChunk.z, cachedChunk.blocks);
            session.copyCursor += 1;
            processed += 1;
            continue;
          }

          session.dependencyBaseSession = this.createBackgroundBaseChunkSession(sourceChunk.x, sourceChunk.z);
          return true;
        }

        if (!session.dependencyBaseSession.complete) {
          return this.advanceBackgroundBaseChunkSession(session.dependencyBaseSession);
        }

        copyChunkIntoPopulationRegion(
          session.region,
          sourceChunk.x,
          sourceChunk.z,
          session.dependencyBaseSession.chunk.blocks,
        );
        session.dependencyBaseSession = null;
        session.copyCursor += 1;
        processed += 1;
      }

      if (session.copyCursor >= totalChunks) {
        session.phase = "features";
      }
      return processed > 0;
    }

    if (session.phase === "features") {
      if (session.sourceCursor >= 4) {
        session.phase = "extract";
        return true;
      }

      if (!session.populationRandom) {
        const sourceChunk = getPopulationFeatureSourceChunk(
          session.terrainChunk.chunkX,
          session.terrainChunk.chunkZ,
          session.sourceCursor,
        );
        session.populationRandom = getPopulationRandom(this.seed, sourceChunk.x, sourceChunk.z);
        session.sourceBiome = this.getPopulationBiome(sourceChunk.x, sourceChunk.z);
        session.sourceClimate = this.options.snow
          ? this.getPopulationClimate(sourceChunk.x, sourceChunk.z)
          : null;
        return true;
      }

      if (!session.currentFeatureSession) {
        while (session.phase === "features" && session.sourceCursor < 4) {
          if (!session.populationRandom) {
            return true;
          }
          const startResult = this.startBackgroundDecorationStage(session);
          if (startResult === "skip") {
            this.advanceBackgroundDecorationSource(session);
            continue;
          }
          if (startResult === "session") {
            break;
          }
        }

        if (session.phase !== "features") {
          return true;
        }
      }

      const progressed = this.advanceBackgroundDecorationStageSession(session);
      if (session.currentFeatureSession?.complete) {
        this.advanceBackgroundDecorationSource(session);
      }
      return progressed;
    }

    if (session.phase === "extract") {
      extractCenterChunkColumns(
        session.region,
        session.terrainChunk.chunkX,
        session.terrainChunk.chunkZ,
        session.decoratedBlocks,
        session.extractX,
        BACKGROUND_REGION_EXTRACT_COLUMNS_PER_STEP,
      );
      session.extractX += BACKGROUND_REGION_EXTRACT_COLUMNS_PER_STEP;
      if (session.extractX >= 16) {
        session.complete = true;
        session.phase = "complete";
      }
      return true;
    }

    return false;
  }

  generateChunk(chunkX, chunkZ) {
    return this.decorateTerrainChunk(this.generateTerrainChunk(chunkX, chunkZ));
  }
}

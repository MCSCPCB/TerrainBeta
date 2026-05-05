import { BLOCKS, getBiomeIdFromClimate } from "../biome/index.js";
import { Beta173Generator } from "../terrain/generator.js";
import { buildHeightmapColumns } from "../terrain/chunk.js";
import { generateBaseTerrainCellColumns } from "../terrain/density.js";
import {
  advanceSurfaceReplacementSession,
  createSurfaceReplacementSession,
} from "../terrain/surface.js";
import { JavaRandom, toJavaLong } from "../random/java.js";
import { NoiseGeneratorOctaves2173 } from "../noise/index.js";
import { generateClimateAreaReference } from "../reference/index.js";
import { chunkBlockIndex } from "../utils/layout.js";
import {
  advanceCaveCarverSession,
  applyCaves,
  createCaveCarverSession,
  DEFAULT_CAVE_RANGE,
} from "../carvers/caves.js";
import {
  copyChunkIntoPopulationRegion,
  createPopulationRegion,
  createPopulationRegionShell,
  extractCenterChunkColumns,
  extractCenterChunkFromRegion,
} from "../population/region.js";
import { POPULATION_REGION_SIZE } from "../population/shared.js";
import { getPopulationRandom } from "../population/seeding.js";
import {
  advanceClaySession,
  advanceOreSession,
  applyClay,
  applyOres,
  createClaySession,
  createOreSession,
} from "../features/deposits.js";
import {
  advanceDungeonSession,
  applyDungeons,
  createDungeonSession,
} from "../features/dungeons.js";
import {
  advanceFloraSession,
  applyFlora,
  createFloraSession,
} from "../features/flora.js";
import { applyLakes } from "../features/lakes.js";
import {
  advanceSnowSession,
  applySnow,
  createSnowSession,
} from "../features/snow.js";
import {
  advanceSpringSession,
  applySprings,
  createSpringSession,
} from "../features/springs.js";
import {
  advanceTreeSession,
  applyTrees,
  createTreeSession,
} from "../features/trees.js";

export { BEDROCK_BLOCK_MAP } from "../world/blocks.js";

const POPULATION_BASE_CACHE_LIMIT = 49;
const POPULATION_SOURCE_MIN_OFFSET = -1;
const POPULATION_SOURCE_MAX_OFFSET = 0;
const BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP = 1;
const BACKGROUND_SURFACE_COLUMNS_PER_STEP = 1;
const BACKGROUND_HEIGHTMAP_COLUMNS_PER_STEP = 1;
const BACKGROUND_CAVE_SOURCE_CHUNKS_PER_STEP = 1;
const BACKGROUND_REGION_COPY_CHUNKS_PER_STEP = 1;
const BACKGROUND_REGION_EXTRACT_COLUMNS_PER_STEP = 1;
const BACKGROUND_DECORATION_STAGE_KEYS = Object.freeze([
  "lakes",
  "dungeons",
  "clay",
  "ores",
  "trees",
  "flora",
  "springs",
  "snow",
]);

function rebuildHeightmap(blocks) {
  const heightmap = new Int16Array(256);
  buildHeightmapColumns(blocks, heightmap);
  return heightmap;
}

function copyChunkBlockColumns(sourceBlocks, targetBlocks, startX = 0, columnCount = 16) {
  const endX = Math.min(16, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const columnIndex = chunkBlockIndex(x, 0, z);
      targetBlocks.set(sourceBlocks.subarray(columnIndex, columnIndex + 128), columnIndex);
    }
  }

  return endX;
}

function getPopulationRegionSourceChunk(chunkX, chunkZ, copyCursor) {
  return {
    x: chunkX - 1 + Math.floor(copyCursor / 3),
    z: chunkZ - 1 + (copyCursor % 3),
  };
}

function getPopulationFeatureSourceChunk(chunkX, chunkZ, sourceCursor) {
  return {
    x: chunkX + POPULATION_SOURCE_MIN_OFFSET + Math.floor(sourceCursor / 2),
    z: chunkZ + POPULATION_SOURCE_MIN_OFFSET + (sourceCursor % 2),
  };
}

export class Beta173BedrockGenerator {
  constructor(seed, options = {}) {
    this.seed = seed;
    this.options = {
      caves: options.caves ?? true,
      dungeons: options.dungeons ?? true,
      clay: options.clay ?? true,
      ores: options.ores ?? true,
      lakes: options.lakes ?? true,
      trees: options.trees ?? true,
      flora: options.flora ?? true,
      springs: options.springs ?? true,
      snow: options.snow ?? true,
      caveRange: options.caveRange ?? DEFAULT_CAVE_RANGE,
      farlandsCoordinate: options.farlandsCoordinate,
      surfacePalette: options.surfacePalette ?? null,
    };
    this.baseChunkCache = new Map();
    this.populationBiomeCache = new Map();
    this.populationClimateCache = new Map();
    this.generator = new Beta173Generator(seed, {
      farlandsCoordinate: this.options.farlandsCoordinate,
      surfacePalette: this.options.surfacePalette,
    });
    this.populationRegionScratch = new Uint8Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * 128);
    this.treeNoise = new NoiseGeneratorOctaves2173(new JavaRandom(toJavaLong(seed)), 8);
    this.hasPopulationFeatures = (
      this.options.dungeons
      || this.options.clay
      || this.options.ores
      || this.options.lakes
      || this.options.trees
      || this.options.flora
      || this.options.springs
      || this.options.snow
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
    } else if (cache.size >= POPULATION_BASE_CACHE_LIMIT) {
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

  getBaseChunk(chunkX, chunkZ) {
    this.generator.applyRuntimeConfig();
    const key = `${chunkX}|${chunkZ}`;
    return this.getCachedValue(
      this.baseChunkCache,
      key,
      () => this.generator.generateChunk(chunkX, chunkZ),
    );
  }

  peekBaseChunk(chunkX, chunkZ) {
    return this.peekCachedValue(this.baseChunkCache, `${chunkX}|${chunkZ}`);
  }

  cacheBaseChunk(chunk) {
    this.putCachedValue(this.baseChunkCache, `${chunk.chunkX}|${chunk.chunkZ}`, chunk);
    return chunk;
  }

  getPopulationBiome(chunkX, chunkZ) {
    const key = `${chunkX}|${chunkZ}`;
    return this.getCachedValue(
      this.populationBiomeCache,
      key,
      () => {
        const climate = this.getPopulationClimate(chunkX, chunkZ);
        const centerIndex = 8 * 16 + 8;
        return getBiomeIdFromClimate(climate.temperature[centerIndex], climate.humidity[centerIndex]);
      },
    );
  }

  getPopulationClimate(chunkX, chunkZ) {
    this.generator.applyRuntimeConfig();
    const key = `${chunkX}|${chunkZ}`;
    return this.getCachedValue(
      this.populationClimateCache,
      key,
      () => generateClimateAreaReference(this.seed, chunkX * 16 + 8, chunkZ * 16 + 8, 16, 16),
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
      surfaceSession: null,
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
        session.densityField = this.generator.generateDensityField(
          session.chunkX,
          session.chunkZ,
          session.climateData,
        );
        session.phase = "base_terrain";
        return true;

      case "base_terrain":
        generateBaseTerrainCellColumns(
          session.blocks,
          session.densityField,
          session.climateData,
          session.baseTerrainCellX,
          BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP,
        );
        session.baseTerrainCellX += BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP;
        if (session.baseTerrainCellX >= 4) {
          session.phase = "surface_setup";
        }
        return true;

      case "surface_setup":
        session.surfaceSession = createSurfaceReplacementSession(
          session.blocks,
          this.generator.terrainTables,
          session.climateData,
          session.chunkX,
          session.chunkZ,
          this.generator.surfacePalette,
        );
        session.phase = "surface";
        return true;

      case "surface":
        if (!advanceSurfaceReplacementSession(session.surfaceSession, BACKGROUND_SURFACE_COLUMNS_PER_STEP)) {
          return false;
        }
        if (session.surfaceSession.complete) {
          session.phase = "heightmap";
        }
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
    return {
      chunkX,
      chunkZ,
      baseSession: this.createBackgroundBaseChunkSession(chunkX, chunkZ),
      baseChunk: null,
      blocks: null,
      copyX: 0,
      caveSession: null,
      heightmap: new Int16Array(256),
      heightmapX: 0,
      terrainChunk: null,
      complete: false,
      phase: "base",
    };
  }

  advanceBackgroundTerrainSession(session) {
    if (session.complete) {
      return false;
    }

    switch (session.phase) {
      case "base":
        if (!session.baseSession.complete) {
          return this.advanceBackgroundBaseChunkSession(session.baseSession);
        }

        session.baseChunk = session.baseSession.chunk;
        session.blocks = new Uint16Array(session.baseChunk.blocks.length);
        session.phase = "copy";
        return true;

      case "copy":
        session.copyX = copyChunkBlockColumns(session.baseChunk.blocks, session.blocks, session.copyX, 1);
        if (session.copyX >= 16) {
          if (this.options.caves) {
            session.caveSession = createCaveCarverSession(
              session.blocks,
              this.seed,
              session.chunkX,
              session.chunkZ,
              this.options.caveRange,
            );
            session.phase = "caves";
          } else {
            session.phase = "heightmap";
          }
        }
        return true;

      case "caves":
        if (!advanceCaveCarverSession(session.caveSession, BACKGROUND_CAVE_SOURCE_CHUNKS_PER_STEP)) {
          return false;
        }
        if (session.caveSession.complete) {
          session.phase = "heightmap";
        }
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
          session.terrainChunk = {
            ...session.baseChunk,
            terrainHeightmap: session.baseChunk.heightmap,
            blocks: session.blocks,
            heightmap: session.heightmap,
          };
          session.complete = true;
          session.phase = "complete";
        }
        return true;

      default:
        return false;
    }
  }

  startBackgroundDecorationStage(session) {
    const sourceChunk = getPopulationFeatureSourceChunk(
      session.terrainChunk.chunkX,
      session.terrainChunk.chunkZ,
      session.sourceCursor,
    );
    const populationRandom = session.populationRandom;
    const biome = session.sourceBiome;
    const climate = session.sourceClimate;
    const stageKey = BACKGROUND_DECORATION_STAGE_KEYS[session.stageIndex];

    switch (stageKey) {
      case "lakes":
        if (!this.options.lakes) {
          return "skip";
        }
        applyLakes(session.region, populationRandom, sourceChunk.x, sourceChunk.z);
        return "done";

      case "dungeons":
        if (!this.options.dungeons) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createDungeonSession(
          session.region,
          populationRandom,
          sourceChunk.x,
          sourceChunk.z,
        );
        return "session";

      case "clay":
        if (!this.options.clay) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createClaySession(
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
          biome,
          this.treeNoise,
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
          biome,
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

      default:
        return "skip";
    }
  }

  advanceBackgroundDecorationStageSession(session) {
    switch (session.currentStage) {
      case "dungeons":
        return advanceDungeonSession(session.currentFeatureSession);
      case "clay":
        return advanceClaySession(session.currentFeatureSession);
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
      while (processed < BACKGROUND_REGION_COPY_CHUNKS_PER_STEP && session.copyCursor < 9) {
        const sourceChunk = getPopulationRegionSourceChunk(
          session.terrainChunk.chunkX,
          session.terrainChunk.chunkZ,
          session.copyCursor,
        );

        if (
          sourceChunk.x === session.terrainChunk.chunkX
          && sourceChunk.z === session.terrainChunk.chunkZ
        ) {
          copyChunkIntoPopulationRegion(
            session.region,
            sourceChunk.x,
            sourceChunk.z,
            session.terrainChunk.blocks,
          );
          session.copyCursor += 1;
          processed += 1;
          continue;
        }

        if (!session.dependencyBaseSession) {
          const cachedChunk = this.peekBaseChunk(sourceChunk.x, sourceChunk.z);
          if (cachedChunk) {
            copyChunkIntoPopulationRegion(
              session.region,
              sourceChunk.x,
              sourceChunk.z,
              cachedChunk.blocks,
            );
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

      if (session.copyCursor >= 9) {
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
          if (startResult === "done") {
            this.advanceBackgroundDecorationSource(session);
            return true;
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

  generateTerrainChunk(chunkX, chunkZ) {
    const baseChunk = this.getBaseChunk(chunkX, chunkZ);
    const blocks = baseChunk.blocks.slice();

    if (this.options.caves) {
      applyCaves(blocks, this.seed, chunkX, chunkZ, this.options.caveRange);
    }

    return {
      ...baseChunk,
      terrainHeightmap: baseChunk.heightmap,
      blocks,
      heightmap: rebuildHeightmap(blocks),
    };
  }

  decorateTerrainChunk(terrainChunk, options = {}) {
    const { chunkX, chunkZ } = terrainChunk;
    if (!this.hasPopulationFeatures) {
      return terrainChunk;
    }

    const region = createPopulationRegion(
      (sourceChunkX, sourceChunkZ) => this.getBaseChunk(sourceChunkX, sourceChunkZ),
      chunkX,
      chunkZ,
      terrainChunk.blocks,
      this.populationRegionScratch,
    );

    for (
      let sourceChunkX = chunkX + POPULATION_SOURCE_MIN_OFFSET;
      sourceChunkX <= chunkX + POPULATION_SOURCE_MAX_OFFSET;
      sourceChunkX += 1
    ) {
      for (
        let sourceChunkZ = chunkZ + POPULATION_SOURCE_MIN_OFFSET;
        sourceChunkZ <= chunkZ + POPULATION_SOURCE_MAX_OFFSET;
        sourceChunkZ += 1
      ) {
        const populationRandom = getPopulationRandom(this.seed, sourceChunkX, sourceChunkZ);
        const biome = this.getPopulationBiome(sourceChunkX, sourceChunkZ);
        const climate = this.options.snow
          ? this.getPopulationClimate(sourceChunkX, sourceChunkZ)
          : null;

        if (this.options.lakes) {
          applyLakes(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.dungeons) {
          applyDungeons(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.clay) {
          applyClay(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.ores) {
          applyOres(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.trees) {
          applyTrees(region, biome, this.treeNoise, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.flora) {
          applyFlora(region, biome, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.springs) {
          applySprings(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.snow && climate) {
          applySnow(region, climate, sourceChunkX, sourceChunkZ);
        }
      }
    }

    const decoratedBlocks = extractCenterChunkFromRegion(region, chunkX, chunkZ);

    return {
      ...terrainChunk,
      blocks: decoratedBlocks,
      heightmap: options.rebuildHeightmap === false
        ? terrainChunk.heightmap
        : rebuildHeightmap(decoratedBlocks),
    };
  }

  generateChunk(chunkX, chunkZ) {
    return this.decorateTerrainChunk(this.generateTerrainChunk(chunkX, chunkZ));
  }
}

import { NoiseGeneratorOctaves2173 } from "../../beta173/noise/simplex.js";
import { applyCaves, DEFAULT_CAVE_RANGE } from "../../beta173/carvers/caves.js";
import { applyClay, applyOres } from "../../beta173/features/deposits.js";
import { applyDungeons } from "../../beta173/features/dungeons.js";
import { applyFlora } from "../../beta173/features/flora.js";
import { applyLakes } from "../../beta173/features/lakes.js";
import { applySnow } from "../../beta173/features/snow.js";
import { applySprings } from "../../beta173/features/springs.js";
import { applyTrees } from "../../beta173/features/trees.js";
import {
  createPopulationRegion,
  extractCenterChunkColumns,
} from "../../beta173/population/region.js";
import { getPopulationRandom } from "../../beta173/population/seeding.js";
import { POPULATION_REGION_SIZE } from "../../beta173/population/shared.js";
import { BIOME_IDS } from "../biome/constants.js";
import { buildHeightmap } from "../terrain/chunk.js";
import { Beta173SkyGenerator } from "../terrain/generator.js";
import { JavaRandom, toJavaLong } from "../random/java.js";

const CACHE_LIMIT = 49;

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

function createSkyClimateData() {
  const temperature = new Float64Array(256);
  temperature.fill(0.5);

  const rainfall = new Float64Array(256);
  rainfall.fill(0.0);

  const humidity = new Float64Array(256);
  humidity.fill(0.0);

  return {
    temperature,
    rainfall,
    humidity,
  };
}

export class Beta173SkyBedrockGenerator {
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
    };
    this.generator = new Beta173SkyGenerator(seed, {
      farlandsCoordinate: this.options.farlandsCoordinate,
    });
    this.baseChunkCache = new Map();
    this.terrainChunkCache = new Map();
    this.populationRegionScratch = new Uint16Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * 128);
    this.treeNoise = new NoiseGeneratorOctaves2173(new JavaRandom(toJavaLong(seed)), 8);
    this.skyClimate = createSkyClimateData();
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
    if (cache.size >= CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
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

  getTerrainChunk(chunkX, chunkZ) {
    this.generator.applyRuntimeConfig();
    const key = `${chunkX}|${chunkZ}`;
    return this.getCachedValue(
      this.terrainChunkCache,
      key,
      () => {
        const baseChunk = this.getBaseChunk(chunkX, chunkZ);
        const blocks = baseChunk.blocks.slice();
        if (this.options.caves) {
          applyCaves(blocks, this.seed, chunkX, chunkZ, this.options.caveRange);
        }

        return {
          ...cloneChunk(baseChunk),
          terrainHeightmap: baseChunk.heightmap.slice(),
          blocks,
          heightmap: buildHeightmap(blocks),
        };
      },
    );
  }

  getPopulationBiome() {
    return BIOME_IDS.SKY;
  }

  getPopulationClimate() {
    return this.skyClimate;
  }

  generateTerrainChunk(chunkX, chunkZ) {
    return cloneChunk(this.getTerrainChunk(chunkX, chunkZ));
  }

  decorateTerrainChunk(terrainChunk, options = {}) {
    if (!this.hasPopulationFeatures) {
      return terrainChunk;
    }

    const { chunkX, chunkZ } = terrainChunk;
    const region = createPopulationRegion(
      (sourceChunkX, sourceChunkZ) => this.getTerrainChunk(sourceChunkX, sourceChunkZ),
      chunkX,
      chunkZ,
      terrainChunk.blocks,
      this.populationRegionScratch,
    );

    for (let sourceChunkX = chunkX - 1; sourceChunkX <= chunkX; sourceChunkX += 1) {
      for (let sourceChunkZ = chunkZ - 1; sourceChunkZ <= chunkZ; sourceChunkZ += 1) {
        const populationRandom = getPopulationRandom(this.seed, sourceChunkX, sourceChunkZ);
        const sourceBiome = this.getPopulationBiome(sourceChunkX, sourceChunkZ);
        const climate = this.options.snow ? this.getPopulationClimate(sourceChunkX, sourceChunkZ) : null;

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
          applyTrees(region, sourceBiome, this.treeNoise, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.flora) {
          applyFlora(region, sourceBiome, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.springs) {
          applySprings(region, populationRandom, sourceChunkX, sourceChunkZ);
        }
        if (this.options.snow && climate) {
          applySnow(region, climate, sourceChunkX, sourceChunkZ);
        }
      }
    }

    const decoratedBlocks = new Uint16Array(16 * 16 * 128);
    extractCenterChunkColumns(region, chunkX, chunkZ, decoratedBlocks);

    return {
      ...terrainChunk,
      blocks: decoratedBlocks,
      heightmap: options.rebuildHeightmap === false
        ? terrainChunk.heightmap
        : buildHeightmap(decoratedBlocks),
    };
  }

  createBackgroundTerrainSession(chunkX, chunkZ) {
    return {
      chunkX,
      chunkZ,
      terrainChunk: null,
      complete: false,
    };
  }

  advanceBackgroundTerrainSession(session) {
    if (session.complete) {
      return false;
    }

    session.terrainChunk = this.generateTerrainChunk(session.chunkX, session.chunkZ);
    session.complete = true;
    return true;
  }

  createBackgroundDecorationSession(terrainChunk) {
    if (!this.hasPopulationFeatures) {
      return {
        terrainChunk,
        decoratedBlocks: terrainChunk.blocks,
        complete: true,
      };
    }

    return {
      terrainChunk,
      decoratedBlocks: null,
      complete: false,
    };
  }

  advanceBackgroundDecorationSession(session) {
    if (session.complete) {
      return false;
    }

    const decoratedChunk = this.decorateTerrainChunk(session.terrainChunk, {
      rebuildHeightmap: false,
    });
    session.decoratedBlocks = decoratedChunk.blocks;
    session.complete = true;
    return true;
  }

  generateChunk(chunkX, chunkZ) {
    return this.decorateTerrainChunk(this.generateTerrainChunk(chunkX, chunkZ));
  }
}

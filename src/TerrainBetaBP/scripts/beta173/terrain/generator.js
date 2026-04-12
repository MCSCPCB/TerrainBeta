import { toJavaLong } from "../random/java.js";
import {
  DEFAULT_FARLANDS_COORDINATE,
  initTerrainTables,
  setFarlandsCoordinate,
} from "../reference/index.js";
import { setNoiseFarlandsCoordinate } from "../utils/math.js";
import { buildBiomeData } from "./biomes.js";
import { buildHeightmap, validateChunkCoordinate } from "./chunk.js";
import { generateBaseTerrain, generateDensityFieldExact } from "./density.js";
import { replaceBlocksForBiomesExact } from "./surface.js";

export class Beta173Generator {
  constructor(seed, options = {}) {
    this.seed = toJavaLong(seed);
    this.farlandsCoordinate = options.farlandsCoordinate ?? DEFAULT_FARLANDS_COORDINATE;
    setFarlandsCoordinate(this.farlandsCoordinate);
    setNoiseFarlandsCoordinate(this.farlandsCoordinate);
    this.terrainTables = initTerrainTables(this.seed);
  }

  applyRuntimeConfig() {
    setFarlandsCoordinate(this.farlandsCoordinate);
    setNoiseFarlandsCoordinate(this.farlandsCoordinate);
  }

  generateBiomeData(chunkX, chunkZ) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();
    return buildBiomeData(this.seed, chunkX, chunkZ);
  }

  generateDensityField(chunkX, chunkZ, climateData = this.generateBiomeData(chunkX, chunkZ)) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();
    return generateDensityFieldExact(this.terrainTables, climateData, chunkX, chunkZ);
  }

  generateChunk(chunkX, chunkZ) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();

    const climateData = this.generateBiomeData(chunkX, chunkZ);
    const densityField = this.generateDensityField(chunkX, chunkZ, climateData);
    const blocks = new Uint16Array(16 * 16 * 128);

    generateBaseTerrain(blocks, densityField, climateData);
    replaceBlocksForBiomesExact(blocks, this.terrainTables, climateData, chunkX, chunkZ);

    return {
      chunkX,
      chunkZ,
      blocks,
      biomes: climateData.biomes,
      temperature: climateData.temperature,
      rainfall: climateData.rainfall,
      humidity: climateData.humidity,
      densityField,
      heightmap: buildHeightmap(blocks),
    };
  }
}

export function generateBeta173Chunk(seed, chunkX, chunkZ, options = {}) {
  return new Beta173Generator(seed, options).generateChunk(chunkX, chunkZ);
}

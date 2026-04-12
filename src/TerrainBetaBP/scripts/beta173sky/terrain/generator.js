import { JavaRandom, toJavaLong } from "../random/java.js";
import { NoiseGeneratorOctaves173 } from "../noise/perlin.js";
import { DEFAULT_FARLANDS_COORDINATE, setNoiseFarlandsCoordinate } from "../utils/math.js";
import { buildSkyBiomeData } from "./biomes.js";
import { buildHeightmap, validateChunkCoordinate } from "./chunk.js";
import { generateBaseTerrain, generateDensityField } from "./density.js";
import { replaceBlocksForBiomes } from "./surface.js";

export class Beta173SkyGenerator {
  constructor(seed, options = {}) {
    this.seed = toJavaLong(seed);
    this.farlandsCoordinate = options.farlandsCoordinate ?? DEFAULT_FARLANDS_COORDINATE;
    this.random = new JavaRandom(this.seed);
    this.minLimitNoise = new NoiseGeneratorOctaves173(this.random, 16);
    this.maxLimitNoise = new NoiseGeneratorOctaves173(this.random, 16);
    this.mainNoise = new NoiseGeneratorOctaves173(this.random, 8);
    this.sandAndGravelNoise = new NoiseGeneratorOctaves173(this.random, 4);
    this.surfaceNoise = new NoiseGeneratorOctaves173(this.random, 4);
    this.scaleNoise = new NoiseGeneratorOctaves173(this.random, 10);
    this.depthNoise = new NoiseGeneratorOctaves173(this.random, 16);
    this.forestNoise = new NoiseGeneratorOctaves173(this.random, 8);

    this.scaleNoiseBuffer = null;
    this.depthNoiseBuffer = null;
    this.mainNoiseBuffer = null;
    this.minLimitNoiseBuffer = null;
    this.maxLimitNoiseBuffer = null;
    this.surfaceNoiseBuffer = null;
    this.climateData = buildSkyBiomeData();
    this.applyRuntimeConfig();
  }

  applyRuntimeConfig() {
    setNoiseFarlandsCoordinate(this.farlandsCoordinate);
  }

  generateBiomeData(chunkX, chunkZ) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();
    return this.climateData;
  }

  generateDensityField(chunkX, chunkZ, climateData = this.generateBiomeData(chunkX, chunkZ)) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();
    return generateDensityField(this, climateData, chunkX, chunkZ);
  }

  generateChunk(chunkX, chunkZ) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();

    const climateData = this.generateBiomeData(chunkX, chunkZ);
    const densityField = this.generateDensityField(chunkX, chunkZ, climateData);
    const blocks = new Uint16Array(16 * 16 * 128);

    generateBaseTerrain(blocks, densityField);
    replaceBlocksForBiomes(blocks, this, climateData, chunkX, chunkZ);

    return {
      chunkX,
      chunkZ,
      blocks,
      biomes: climateData.biomes.slice(),
      temperature: climateData.temperature.slice(),
      rainfall: climateData.rainfall.slice(),
      humidity: climateData.humidity.slice(),
      densityField: densityField.slice(),
      heightmap: buildHeightmap(blocks),
    };
  }
}

export function generateBeta173SkyChunk(seed, chunkX, chunkZ, options = {}) {
  return new Beta173SkyGenerator(seed, options).generateChunk(chunkX, chunkZ);
}

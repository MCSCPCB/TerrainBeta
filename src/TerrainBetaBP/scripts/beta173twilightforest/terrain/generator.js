import { toJavaLong } from "../../beta173/random/java.js";
import {
  DEFAULT_FARLANDS_COORDINATE,
  setNoiseFarlandsCoordinate,
} from "../../beta173/utils/math.js";
import { TwilightClimateGenerator } from "../biome/index.js";
import { buildHeightmap, validateChunkCoordinate } from "./chunk.js";
import {
  addGlaciers,
  generateBaseTerrain,
  generateDensityFieldExact,
  initializeTwilightTerrainState,
  terraformChunk,
} from "./density.js";
import {
  hillSize,
  isHollowHill,
  nearHollowHill,
  nearestHillCenter,
  nearestHillSize,
} from "./hills.js";
import { replaceBlocksForBiomesExact } from "./surface.js";

export function raiseHills(blocks, chunkX, chunkZ) {
  if (!nearHollowHill(chunkX, chunkZ, 0n)) {
    return;
  }

  const center = nearestHillCenter(chunkX, chunkZ, 0n);
  const size = nearestHillSize(chunkX, chunkZ, 0n);
  const diameter = (size * 2 + 1) * 16.0;

  for (let x = 0; x < 16; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const deltaX = x - center.x;
      const deltaZ = z - center.z;
      const distance = Math.trunc(Math.sqrt(deltaX * deltaX + deltaZ * deltaZ));
      const hillHeight = Math.trunc(Math.cos((distance / diameter) * Math.PI) * (diameter / 3.0));

      let oldGround = -1;
      let newGround = -1;
      for (let y = 0; y <= 127; y += 1) {
        const blockIndex = ((x * 16 + z) * 128) + y;
        const currentBlock = blocks[blockIndex];
        if (currentBlock !== 0 && currentBlock !== 79) {
          continue;
        }

        if (newGround === -1) {
          oldGround = y;
          newGround = oldGround + hillHeight;
        }

        if (y <= newGround) {
          blocks[blockIndex] = 1;
        }
      }

      const hollow = Math.max(0, hillHeight - 4);
      for (let y = 0; y <= 127; y += 1) {
        if (y <= 16 || y >= 16 + hollow) {
          continue;
        }
        blocks[((x * 16 + z) * 128) + y] = 0;
      }
    }
  }
}

export class Beta173TwilightForestGenerator {
  constructor(seed, options = {}) {
    this.seed = toJavaLong(seed);
    this.farlandsCoordinate = options.farlandsCoordinate ?? DEFAULT_FARLANDS_COORDINATE;
    this.surfacePalette = options.surfacePalette ?? null;
    this.climateGenerator = new TwilightClimateGenerator(this.seed);
    initializeTwilightTerrainState(this, this.seed);
    this.applyRuntimeConfig();
  }

  applyRuntimeConfig() {
    setNoiseFarlandsCoordinate(this.farlandsCoordinate);
  }

  generateBiomeData(chunkX, chunkZ) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();
    return this.climateGenerator.generateArea(chunkX * 16, chunkZ * 16, 16, 16);
  }

  generateDensityField(chunkX, chunkZ, climateData = this.generateBiomeData(chunkX, chunkZ)) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();
    return generateDensityFieldExact(this, climateData, chunkX, chunkZ);
  }

  generateChunk(chunkX, chunkZ) {
    validateChunkCoordinate(chunkX, "chunkX");
    validateChunkCoordinate(chunkZ, "chunkZ");
    this.applyRuntimeConfig();

    const climateData = this.generateBiomeData(chunkX, chunkZ);
    const densityField = this.generateDensityField(chunkX, chunkZ, climateData);
    const blocks = new Uint16Array(16 * 16 * 128);

    generateBaseTerrain(blocks, densityField);
    terraformChunk(blocks, climateData);
    addGlaciers(blocks, climateData);
    raiseHills(blocks, chunkX, chunkZ);
    replaceBlocksForBiomesExact(blocks, climateData, chunkX, chunkZ, this.surfacePalette);

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

export function generateBeta173TwilightForestChunk(seed, chunkX, chunkZ, options = {}) {
  return new Beta173TwilightForestGenerator(seed, options).generateChunk(chunkX, chunkZ);
}

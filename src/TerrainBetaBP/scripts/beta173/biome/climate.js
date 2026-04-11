import { JavaRandom, toJavaLong } from "../random/java.js";
import { NoiseGeneratorOctaves2173 } from "../noise/index.js";
import { clamp, layerIndex } from "../utils/index.js";
import { BIOME_IDS } from "./constants.js";

const TEMP_COEFF = 9871n;
const RAIN_COEFF = 39811n;
const MIXIN_COEFF = 543321n;

function createClimateRandom(seed, coefficient) {
  return new JavaRandom(BigInt.asIntN(64, toJavaLong(seed) * coefficient));
}

export function getBiomeIdFromClimate(temperature, rainfall) {
  const adjustedRainfall = temperature * rainfall;

  if (temperature < 0.1) {
    return BIOME_IDS.TUNDRA;
  }
  if (adjustedRainfall < 0.2) {
    if (temperature < 0.5) {
      return BIOME_IDS.TUNDRA;
    }
    if (temperature < 0.95) {
      return BIOME_IDS.SAVANNA;
    }
    return BIOME_IDS.DESERT;
  }
  if (adjustedRainfall > 0.5 && temperature < 0.7) {
    return BIOME_IDS.SWAMPLAND;
  }
  if (temperature < 0.5) {
    return BIOME_IDS.TAIGA;
  }
  if (temperature < 0.97) {
    if (adjustedRainfall < 0.35) {
      return BIOME_IDS.SHRUBLAND;
    }
    return BIOME_IDS.FOREST;
  }
  if (adjustedRainfall < 0.45) {
    return BIOME_IDS.PLAINS;
  }
  if (adjustedRainfall < 0.9) {
    return BIOME_IDS.SEASONAL_FOREST;
  }
  return BIOME_IDS.RAINFOREST;
}

export class ClimateGenerator173 {
  constructor(seed) {
    this.temperatureNoise = new NoiseGeneratorOctaves2173(createClimateRandom(seed, TEMP_COEFF), 4);
    this.rainfallNoise = new NoiseGeneratorOctaves2173(createClimateRandom(seed, RAIN_COEFF), 4);
    this.mixinNoise = new NoiseGeneratorOctaves2173(createClimateRandom(seed, MIXIN_COEFF), 2);
  }

  generateArea(x, z, sizeX, sizeZ) {
    const temperature = this.temperatureNoise.generate(
      null,
      x,
      z,
      sizeX,
      sizeZ,
      0.02500000037252903,
      0.02500000037252903,
      0.25,
    );
    const rainfall = this.rainfallNoise.generate(
      null,
      x,
      z,
      sizeX,
      sizeZ,
      0.05000000074505806,
      0.05000000074505806,
      0.3333333333333333,
    );
    const mixin = this.mixinNoise.generate(
      null,
      x,
      z,
      sizeX,
      sizeZ,
      0.25,
      0.25,
      0.5882352941176471,
    );

    const biomes = new Uint8Array(sizeX * sizeZ);

    for (let offsetX = 0; offsetX < sizeX; offsetX += 1) {
      for (let offsetZ = 0; offsetZ < sizeZ; offsetZ += 1) {
        const index = layerIndex(offsetX, offsetZ, sizeZ);
        const blended = mixin[index] * 1.1 + 0.5;

        let currentTemperature = (temperature[index] * 0.15 + 0.7) * 0.99 + blended * 0.01;
        currentTemperature = 1.0 - (1.0 - currentTemperature) * (1.0 - currentTemperature);
        currentTemperature = clamp(currentTemperature, 0.0, 1.0);

        let currentRainfall = (rainfall[index] * 0.15 + 0.5) * 0.998 + blended * 0.002;
        currentRainfall = clamp(currentRainfall, 0.0, 1.0);

        temperature[index] = currentTemperature;
        rainfall[index] = currentRainfall;
        biomes[index] = getBiomeIdFromClimate(currentTemperature, currentRainfall);
      }
    }

    return { temperature, rainfall, biomes, sizeX, sizeZ };
  }
}

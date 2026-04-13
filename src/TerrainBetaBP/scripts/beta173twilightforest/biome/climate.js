import { JavaRandom, toJavaLong } from "../../beta173/random/java.js";
import { NoiseGeneratorOctaves2173 } from "../../beta173/noise/index.js";
import { clamp } from "../../beta173/utils/math.js";
import { layerIndex } from "../../beta173/utils/layout.js";
import { BIOME_IDS } from "./constants.js";

const TEMP_COEFF = 9871n;
const HUMIDITY_COEFF = 39811n;
const MIXIN_COEFF = 543321n;

function createClimateRandom(seed, coefficient) {
  return new JavaRandom(BigInt.asIntN(64, toJavaLong(seed) * coefficient));
}

export function getTwilightBiomeIdFromClimate(temperature, humidity) {
  const adjustedHumidity = temperature * humidity;

  if (adjustedHumidity > 0.75) {
    return adjustedHumidity > 0.825
      ? BIOME_IDS.TWILIGHT_SWAMP
      : BIOME_IDS.TWILIGHT_CLEARINGS;
  }

  if (adjustedHumidity > 0.675 && temperature < 0.75) {
    return BIOME_IDS.TWILIGHT_MUSHROOM;
  }

  if (temperature < 0.25) {
    return temperature < 0.1
      ? BIOME_IDS.TWILIGHT_GLACIER
      : BIOME_IDS.TWILIGHT_SNOW;
  }

  if (temperature > 0.75 && humidity < 1.0 - temperature) {
    return BIOME_IDS.TWILIGHT_HIGHLAND;
  }

  return BIOME_IDS.TWILIGHT_FOREST;
}

export class TwilightClimateGenerator {
  constructor(seed) {
    this.temperatureNoise = new NoiseGeneratorOctaves2173(createClimateRandom(seed, TEMP_COEFF), 4);
    this.humidityNoise = new NoiseGeneratorOctaves2173(createClimateRandom(seed, HUMIDITY_COEFF), 4);
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
    const humidity = this.humidityNoise.generate(
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

        let currentHumidity = (humidity[index] * 0.15 + 0.5) * 0.998 + blended * 0.002;
        currentHumidity = clamp(currentHumidity, 0.0, 1.0);

        temperature[index] = currentTemperature;
        humidity[index] = currentHumidity;
        biomes[index] = getTwilightBiomeIdFromClimate(currentTemperature, currentHumidity);
      }
    }

    return {
      temperature,
      rainfall: humidity,
      humidity,
      biomes,
      sizeX,
      sizeZ,
    };
  }
}

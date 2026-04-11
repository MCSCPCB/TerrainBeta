import { getBiomeIdFromClimate } from "../biome/index.js";
import { generateClimateReference } from "../reference/index.js";

export function buildBiomeData(seed, chunkX, chunkZ) {
  const { temperature, humidity } = generateClimateReference(seed, chunkX, chunkZ);
  const biomes = new Uint8Array(256);

  for (let index = 0; index < 256; index += 1) {
    biomes[index] = getBiomeIdFromClimate(temperature[index], humidity[index]);
  }

  return {
    temperature,
    rainfall: humidity,
    humidity,
    biomes,
    sizeX: 16,
    sizeZ: 16,
  };
}

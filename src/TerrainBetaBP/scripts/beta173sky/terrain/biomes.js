import { BIOME_IDS } from "../biome/constants.js";

export function buildSkyBiomeData() {
  const biomes = new Int8Array(256);
  biomes.fill(BIOME_IDS.SKY);

  const temperature = new Float64Array(256);
  temperature.fill(0.5);

  const rainfall = new Float64Array(256);
  rainfall.fill(0.0);

  const humidity = new Float64Array(256);
  humidity.fill(0.0);

  return {
    biomes,
    temperature,
    rainfall,
    humidity,
  };
}

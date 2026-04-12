import {
  BEDROCK_BLOCK_MAP,
  Beta173SkyBedrockGenerator,
  BLOCKS,
} from "../../beta173sky/index.js";

const BETA173_SKY_DIMENSIONS = Object.freeze({
  chunkSize: 16,
  chunkHeight: 128,
  minWorldY: 0,
});

export function createBeta173SkyWorldGenerator(config) {
  return {
    id: "beta173sky",
    storageKey: config.storageKey ?? "beta173SkyGeneratedChunks",
    dimensions: BETA173_SKY_DIMENSIONS,
    blocks: BLOCKS,
    blockTypeMap: BEDROCK_BLOCK_MAP,
    generator: new Beta173SkyBedrockGenerator(
      config.seed,
      {
        ...config.options,
        farlandsCoordinate: config.farlandsCoordinate,
      },
    ),
  };
}

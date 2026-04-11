import {
  BEDROCK_BLOCK_MAP,
  Beta173BedrockGenerator,
  BLOCKS,
} from "../../beta173/index.js";

const BETA173_DIMENSIONS = Object.freeze({
  chunkSize: 16,
  chunkHeight: 128,
  minWorldY: 0,
});

export function createBeta173WorldGenerator(config) {
  return {
    id: "beta173",
    storageKey: config.storageKey ?? "beta173GeneratedChunks",
    dimensions: BETA173_DIMENSIONS,
    blocks: BLOCKS,
    blockTypeMap: BEDROCK_BLOCK_MAP,
    generator: new Beta173BedrockGenerator(
      config.seed,
      {
        ...config.options,
        farlandsCoordinate: config.farlandsCoordinate,
      },
    ),
  };
}

import { BLOCKS } from "../../beta173sky/index.js";
import { BIOME_IDS, DEFAULT_BIOME_SURFACE_CONFIG } from "../../beta173sky/biome/constants.js";
import {
  BEDROCK_BLOCK_MAP,
  BLOCK_ROLE_IDS,
  DEFAULT_BLOCK_PALETTE,
} from "../../beta173sky/world/blocks.js";
import { Beta173SkyBedrockGenerator } from "../../beta173sky/runtime/bedrockGenerator.js";
import { createGeneratorPalette } from "./palette.js";

const BETA173_SKY_DIMENSIONS = Object.freeze({
  chunkSize: 16,
  chunkHeight: 128,
  minWorldY: 0,
});
const BETA173_SKY_RUNTIME_PROFILE = Object.freeze({
  initializationCompletionMode: "populated",
  backgroundLookaheadChunks: 2,
});

export function createBeta173SkyWorldGenerator(config) {
  const palette = createGeneratorPalette({
    generatorId: "beta173sky",
    biomeIds: BIOME_IDS,
    defaultBlockPalette: DEFAULT_BLOCK_PALETTE,
    blockRoleIds: BLOCK_ROLE_IDS,
    defaultSurfaceConfig: DEFAULT_BIOME_SURFACE_CONFIG,
    blockPaletteOverrides: config.blockPalette,
    surfacePaletteOverrides: config.surfacePalette,
  });

  return {
    id: "beta173sky",
    storageKey: config.storageKey ?? "beta173SkyGeneratedChunks",
    dimensions: BETA173_SKY_DIMENSIONS,
    runtimeProfile: {
      ...BETA173_SKY_RUNTIME_PROFILE,
      ...config.runtimeProfile,
    },
    blocks: BLOCKS,
    defaultBlockTypeMap: BEDROCK_BLOCK_MAP,
    blockPalette: palette.blockPalette,
    blockTypeMap: palette.blockTypeMap,
    generator: new Beta173SkyBedrockGenerator(
      config.seed,
      {
        ...config.options,
        farlandsCoordinate: config.farlandsCoordinate,
        surfacePalette: palette.surfacePalette,
      },
    ),
  };
}

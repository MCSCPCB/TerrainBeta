import { BLOCKS } from "../../beta173twilightforest/index.js";
import {
  BIOME_IDS,
  DEFAULT_BIOME_SURFACE_CONFIG,
} from "../../beta173twilightforest/biome/constants.js";
import {
  BEDROCK_BLOCK_MAP,
  BLOCK_ROLE_IDS,
  DEFAULT_BLOCK_PALETTE,
} from "../../beta173twilightforest/world/blocks.js";
import { Beta173TwilightForestBedrockGenerator } from "../../beta173twilightforest/runtime/bedrockGenerator.js";
import { createGeneratorPalette } from "./palette.js";

const BETA173_TWILIGHT_FOREST_DIMENSIONS = Object.freeze({
  chunkSize: 16,
  chunkHeight: 128,
  minWorldY: 0,
});
const BETA173_TWILIGHT_FOREST_RUNTIME_PROFILE = Object.freeze({
  initializationCompletionMode: "center_landing",
  backgroundLookaheadChunks: 1,
});

export function createBeta173TwilightForestWorldGenerator(config) {
  const palette = createGeneratorPalette({
    generatorId: "beta173twilightforest",
    biomeIds: BIOME_IDS,
    defaultBlockPalette: DEFAULT_BLOCK_PALETTE,
    blockRoleIds: BLOCK_ROLE_IDS,
    defaultSurfaceConfig: DEFAULT_BIOME_SURFACE_CONFIG,
    blockPaletteOverrides: config.blockPalette,
    surfacePaletteOverrides: config.surfacePalette,
  });

  return {
    id: "beta173twilightforest",
    storageKey: config.storageKey ?? "beta173TwilightForestGeneratedChunks",
    dimensions: BETA173_TWILIGHT_FOREST_DIMENSIONS,
    runtimeProfile: {
      ...BETA173_TWILIGHT_FOREST_RUNTIME_PROFILE,
      ...config.runtimeProfile,
    },
    blocks: BLOCKS,
    defaultBlockTypeMap: BEDROCK_BLOCK_MAP,
    blockPalette: palette.blockPalette,
    blockTypeMap: palette.blockTypeMap,
    generator: new Beta173TwilightForestBedrockGenerator(
      config.seed,
      {
        ...config.options,
        farlandsCoordinate: config.farlandsCoordinate,
        surfacePalette: palette.surfacePalette,
      },
    ),
  };
}

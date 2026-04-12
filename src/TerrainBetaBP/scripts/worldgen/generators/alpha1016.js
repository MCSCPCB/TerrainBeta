import { BLOCKS, BIOME_IDS, DEFAULT_BIOME_SURFACE_CONFIG } from "../../alpha1016/index.js";
import {
  BEDROCK_BLOCK_MAP,
  BLOCK_ROLE_IDS,
  DEFAULT_BLOCK_PALETTE,
} from "../../alpha1016/world/blocks.js";
import { Alpha1016BedrockGenerator } from "../../alpha1016/runtime/bedrockGenerator.js";
import { createGeneratorPalette } from "./palette.js";

const ALPHA_1016_DIMENSIONS = Object.freeze({
  chunkSize: 16,
  chunkHeight: 128,
  minWorldY: 0,
});
const ALPHA_1016_RUNTIME_PROFILE = Object.freeze({
  initializationCompletionMode: "center_landing",
  backgroundLookaheadChunks: 3,
});

export function createAlpha1016WorldGenerator(config) {
  const palette = createGeneratorPalette({
    generatorId: "alpha1016",
    biomeIds: BIOME_IDS,
    defaultBlockPalette: DEFAULT_BLOCK_PALETTE,
    blockRoleIds: BLOCK_ROLE_IDS,
    defaultSurfaceConfig: DEFAULT_BIOME_SURFACE_CONFIG,
    blockPaletteOverrides: config.blockPalette,
    surfacePaletteOverrides: config.surfacePalette,
  });

  return {
    id: "alpha1016",
    storageKey: config.storageKey ?? "alpha1016GeneratedChunks",
    dimensions: ALPHA_1016_DIMENSIONS,
    runtimeProfile: {
      ...ALPHA_1016_RUNTIME_PROFILE,
      ...config.runtimeProfile,
    },
    blocks: BLOCKS,
    defaultBlockTypeMap: BEDROCK_BLOCK_MAP,
    blockPalette: palette.blockPalette,
    blockTypeMap: palette.blockTypeMap,
    generator: new Alpha1016BedrockGenerator(
      config.seed,
      {
        ...config.options,
        farlandsCoordinate: config.farlandsCoordinate,
        surfacePalette: palette.surfacePalette,
      },
    ),
  };
}


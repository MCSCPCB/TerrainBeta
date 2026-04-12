import { BLOCKS } from "../../beta173/index.js";
import { BIOME_IDS, DEFAULT_BIOME_SURFACE_CONFIG } from "../../beta173/biome/constants.js";
import {
  BEDROCK_BLOCK_MAP,
  BLOCK_ROLE_IDS,
  DEFAULT_BLOCK_PALETTE,
} from "../../beta173/world/blocks.js";
import { Beta173BedrockGenerator } from "../../beta173/runtime/bedrockGenerator.js";
import { createGeneratorPalette } from "./palette.js";

const BETA173_DIMENSIONS = Object.freeze({
  chunkSize: 16,
  chunkHeight: 128,
  minWorldY: 0,
});
const BETA173_RUNTIME_PROFILE = Object.freeze({
  initializationCompletionMode: "center_landing",
  backgroundLookaheadChunks: 3,
});

export function createBeta173WorldGenerator(config) {
  const palette = createGeneratorPalette({
    generatorId: "beta173",
    biomeIds: BIOME_IDS,
    defaultBlockPalette: DEFAULT_BLOCK_PALETTE,
    blockRoleIds: BLOCK_ROLE_IDS,
    defaultSurfaceConfig: DEFAULT_BIOME_SURFACE_CONFIG,
    blockPaletteOverrides: config.blockPalette,
    surfacePaletteOverrides: config.surfacePalette,
  });

  return {
    id: "beta173",
    storageKey: config.storageKey ?? "beta173GeneratedChunks",
    dimensions: BETA173_DIMENSIONS,
    runtimeProfile: {
      ...BETA173_RUNTIME_PROFILE,
      ...config.runtimeProfile,
    },
    blocks: BLOCKS,
    defaultBlockTypeMap: BEDROCK_BLOCK_MAP,
    blockPalette: palette.blockPalette,
    blockTypeMap: palette.blockTypeMap,
    generator: new Beta173BedrockGenerator(
      config.seed,
      {
        ...config.options,
        farlandsCoordinate: config.farlandsCoordinate,
        surfacePalette: palette.surfacePalette,
      },
    ),
  };
}

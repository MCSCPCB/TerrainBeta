// Generator-specific user-facing settings.
// Future generators can be added as new keys alongside beta173.
export const GENERATOR_CONFIGS = {
  alpha1016: {
    seed: "-1",
    storageKey: "alpha1016GeneratedChunks",
    farlandsCoordinate: 12550821,
    worldVerticalOffset: 0,
    runtimeProfile: {
      initializationCompletionMode: "center_landing",
      backgroundLookaheadChunks: 3,
    },
    // Optional early Far Lands override.
    // Omit this to keep alpha1016's natural overflow boundary.
    // farlandsCoordinate: 105508,
    // Optional Bedrock block-id overrides for logical materials and feature blocks.
    blockPalette: {},
    // Alpha has a single overworld surface profile.
    // Example:
    // OVERWORLD: { top: "GRASS", fill: "DIRT" }
    surfacePalette: {},
    options: {
      caves: true,
      dungeons: true,
      clay: true,
      ores: true,
      trees: true,
      flora: true,
      springs: true,
      snow: true,
      snowCovered: false,
      caveRange: 8,
    },
  },
  beta173: {
    seed: "-1",
    storageKey: "beta173GeneratedChunks",
    // Positive-world Far Lands start. 12550821 keeps classic Beta 1.7.3 behavior.
    farlandsCoordinate: 12550821,
    worldVerticalOffset: 0,
    runtimeProfile: {
      initializationCompletionMode: "center_landing",
      backgroundLookaheadChunks: 3,
    },
    // Optional Bedrock block-id overrides for logical materials and feature blocks.
    // Examples:
    // STONE: "minecraft:stone"
    // OAK_LOG: "minecraft:oak_log"
    // RED_FLOWER: "minecraft:red_flower"
    blockPalette: {},
    // Optional biome surface overrides.
    // `top` / `fill` can be a logical material name such as "GRASS" / "DIRT"
    // or a configured Bedrock block id from blockPalette such as "minecraft:stone".
    // Examples:
    // PLAINS: { top: "GRASS", fill: "DIRT" }
    // DESERT: { top: "minecraft:sand", fill: "minecraft:sand" }
    surfacePalette: {},
    options: {
      caves: true,
      dungeons: true,
      clay: true,
      ores: true,
      lakes: true,
      trees: true,
      flora: true,
      springs: true,
      snow: true,
      caveRange: 8,
    },
  },
  beta173sky: {
    seed: "-1",
    storageKey: "beta173SkyGeneratedChunks",
    farlandsCoordinate: 12550821,
    worldVerticalOffset: 0,
    runtimeProfile: {
      initializationCompletionMode: "populated",
      backgroundLookaheadChunks: 2,
    },
    // Same block material override mechanism as beta173.
    blockPalette: {},
    // Sky only supports the SKY biome here.
    // Example:
    // SKY: { top: "GRASS", fill: "DIRT" }
    surfacePalette: {},
    options: {
      caves: true,
      dungeons: true,
      clay: true,
      ores: true,
      lakes: true,
      trees: true,
      flora: true,
      springs: true,
      snow: true,
      caveRange: 8,
    },
  },
  beta173twilightforest: {
    seed: "-1",
    storageKey: "beta173TwilightForestGeneratedChunks",
    farlandsCoordinate: 12550821,
    worldVerticalOffset: 0,
    runtimeProfile: {
      initializationCompletionMode: "center_landing",
      backgroundLookaheadChunks: 1,
    },
    blockPalette: {},
    surfacePalette: {},
    options: {
      lakes: true,
      randomFeatures: true,
      hollowTrees: true,
      ores: true,
      trees: true,
      flora: true,
      springs: true,
      snow: true,
      hollowHills: true,
    },
  },
};

// Generator-specific user-facing settings.
// Future generators can be added as new keys alongside beta173.
export const GENERATOR_CONFIGS = {
  beta173: {
    seed: "-1623774494",
    storageKey: "beta173GeneratedChunks",
    // Positive-world Far Lands start. 12550821 keeps classic Beta 1.7.3 behavior.
    farlandsCoordinate: 12550821,
    runtimeProfile: {
      initializationCompletionMode: "center_landing",
      backgroundLookaheadChunks: 3,
    },
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
    seed: "-1623774494",
    storageKey: "beta173SkyGeneratedChunks",
    farlandsCoordinate: 12550821,
    runtimeProfile: {
      initializationCompletionMode: "populated",
      backgroundLookaheadChunks: 2,
    },
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
};

export const BIOME_IDS = Object.freeze({
  OVERWORLD: 0,
});

export const BLOCKS = Object.freeze({
  AIR: 0,
  STONE: 1,
  GRASS: 2,
  DIRT: 3,
  BEDROCK: 7,
  WATER: 9,
  SAND: 12,
  GRAVEL: 13,
  SANDSTONE: 24,
  ICE: 79,
});

export const DEFAULT_BIOME_SURFACE_CONFIG = Object.freeze({
  OVERWORLD: Object.freeze({ top: "GRASS", fill: "DIRT" }),
});

export const BIOME_IDS = Object.freeze({
  RAINFOREST: 0,
  SWAMPLAND: 1,
  SEASONAL_FOREST: 2,
  FOREST: 3,
  SAVANNA: 4,
  SHRUBLAND: 5,
  TAIGA: 6,
  DESERT: 7,
  PLAINS: 8,
  ICE_DESERT: 9,
  TUNDRA: 10,
});

export const BIOME_NAMES = Object.freeze([
  "Rainforest",
  "Swampland",
  "Seasonal Forest",
  "Forest",
  "Savanna",
  "Shrubland",
  "Taiga",
  "Desert",
  "Plains",
  "Ice Desert",
  "Tundra",
]);

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
  RAINFOREST: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  SWAMPLAND: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  SEASONAL_FOREST: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  FOREST: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  SAVANNA: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  SHRUBLAND: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  TAIGA: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  DESERT: Object.freeze({ top: "SAND", fill: "SAND" }),
  PLAINS: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  ICE_DESERT: Object.freeze({ top: "SAND", fill: "SAND" }),
  TUNDRA: Object.freeze({ top: "GRASS", fill: "DIRT" }),
});

const DEFAULT_BIOME_SURFACE_PALETTE = Object.freeze([
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.SAND, fill: BLOCKS.SAND }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.SAND, fill: BLOCKS.SAND }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
]);

export function getSurfaceForBiome(biomeId, surfacePalette = DEFAULT_BIOME_SURFACE_PALETTE) {
  const palette = surfacePalette ?? DEFAULT_BIOME_SURFACE_PALETTE;
  return palette[biomeId] ?? palette[BIOME_IDS.PLAINS];
}

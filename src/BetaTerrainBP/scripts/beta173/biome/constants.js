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

const BIOME_SURFACES = [
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.SAND, fill: BLOCKS.SAND },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
  { top: BLOCKS.SAND, fill: BLOCKS.SAND },
  { top: BLOCKS.GRASS, fill: BLOCKS.DIRT },
];

export function getSurfaceForBiome(biomeId) {
  return BIOME_SURFACES[biomeId] ?? BIOME_SURFACES[BIOME_IDS.PLAINS];
}

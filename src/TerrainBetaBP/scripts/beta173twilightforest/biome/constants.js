import { BLOCKS as BASE_BLOCKS } from "../../beta173/biome/constants.js";

export const BIOME_IDS = Object.freeze({
  TWILIGHT_FOREST: 0,
  TWILIGHT_CLEARINGS: 1,
  TWILIGHT_HIGHLAND: 2,
  TWILIGHT_MUSHROOM: 3,
  TWILIGHT_SWAMP: 4,
  TWILIGHT_SNOW: 5,
  TWILIGHT_GLACIER: 6,
});

export const BIOME_NAMES = Object.freeze([
  "Twilight Forest",
  "Twilight Clearings",
  "Twilight Highland",
  "Twilight Mushroom",
  "Twilight Swamp",
  "Twilight Snow",
  "Twilight Glacier",
]);

export const BLOCKS = BASE_BLOCKS;

export const DEFAULT_BIOME_SURFACE_CONFIG = Object.freeze({
  TWILIGHT_FOREST: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  TWILIGHT_CLEARINGS: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  TWILIGHT_HIGHLAND: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  TWILIGHT_MUSHROOM: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  TWILIGHT_SWAMP: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  TWILIGHT_SNOW: Object.freeze({ top: "GRASS", fill: "DIRT" }),
  TWILIGHT_GLACIER: Object.freeze({ top: "GRASS", fill: "DIRT" }),
});

const DEFAULT_BIOME_SURFACE_PALETTE = Object.freeze([
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
  Object.freeze({ top: BLOCKS.GRASS, fill: BLOCKS.DIRT }),
]);

export function getSurfaceForBiome(biomeId, surfacePalette = DEFAULT_BIOME_SURFACE_PALETTE) {
  const palette = surfacePalette ?? DEFAULT_BIOME_SURFACE_PALETTE;
  return palette[biomeId] ?? palette[BIOME_IDS.TWILIGHT_FOREST];
}

export const BIOME_IDS = Object.freeze({
  SKY: 11,
});

export const BIOME_NAMES = Object.freeze([
  "Sky",
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
  SKY: Object.freeze({ top: "GRASS", fill: "DIRT" }),
});

const DEFAULT_SKY_SURFACE_PALETTE = Object.freeze({
  [BIOME_IDS.SKY]: Object.freeze({
    top: BLOCKS.GRASS,
    fill: BLOCKS.DIRT,
  }),
});

export function getSurfaceForBiome(biomeId, surfacePalette = DEFAULT_SKY_SURFACE_PALETTE) {
  const palette = surfacePalette ?? DEFAULT_SKY_SURFACE_PALETTE;
  return palette[biomeId] ?? palette[BIOME_IDS.SKY];
}

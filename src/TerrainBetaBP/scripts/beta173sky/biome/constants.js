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

const SKY_SURFACE = Object.freeze({
  top: BLOCKS.GRASS,
  fill: BLOCKS.DIRT,
});

export function getSurfaceForBiome(biomeId) {
  if (biomeId === BIOME_IDS.SKY) {
    return SKY_SURFACE;
  }
  return SKY_SURFACE;
}

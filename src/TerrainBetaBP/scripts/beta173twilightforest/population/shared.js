import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";

export const POPULATION_REGION_RADIUS = 3;
export const POPULATION_REGION_DIAMETER = POPULATION_REGION_RADIUS * 2 + 1;
export const POPULATION_REGION_SIZE = POPULATION_REGION_DIAMETER * 16;

export const TREE_LEAF_BLOCKS = new Set([
  EXTRA_BLOCKS.OAK_LEAVES,
  EXTRA_BLOCKS.BIRCH_LEAVES,
  EXTRA_BLOCKS.SPRUCE_LEAVES,
]);

export const REED_SUPPORT = new Set([
  BLOCKS.GRASS,
  BLOCKS.DIRT,
  BLOCKS.SAND,
  EXTRA_BLOCKS.REEDS,
]);

const NON_SOLID_RENDER_BLOCKS = new Set([
  BLOCKS.AIR,
  EXTRA_BLOCKS.FLOWING_WATER,
  BLOCKS.WATER,
  EXTRA_BLOCKS.FLOWING_LAVA,
  EXTRA_BLOCKS.LAVA,
  EXTRA_BLOCKS.OAK_LEAVES,
  EXTRA_BLOCKS.BIRCH_LEAVES,
  EXTRA_BLOCKS.SPRUCE_LEAVES,
  EXTRA_BLOCKS.TALL_GRASS,
  EXTRA_BLOCKS.YELLOW_FLOWER,
  EXTRA_BLOCKS.RED_FLOWER,
  EXTRA_BLOCKS.BROWN_MUSHROOM,
  EXTRA_BLOCKS.RED_MUSHROOM,
  EXTRA_BLOCKS.REEDS,
  EXTRA_BLOCKS.CHEST,
  EXTRA_BLOCKS.TORCH,
  EXTRA_BLOCKS.FIRE,
  EXTRA_BLOCKS.SNOW_LAYER,
  EXTRA_BLOCKS.LADDER,
]);

export function regionBlockIndex(x, y, z) {
  return ((x * POPULATION_REGION_SIZE + z) * 128) + y;
}

function inRegionBounds(x, y, z) {
  return (
    x >= 0
    && x < POPULATION_REGION_SIZE
    && y >= 0
    && y < 128
    && z >= 0
    && z < POPULATION_REGION_SIZE
  );
}

function getRegionLocal(region, x, y, z) {
  if (!inRegionBounds(x, y, z)) {
    return BLOCKS.AIR;
  }

  return region.blocks[regionBlockIndex(x, y, z)];
}

function setRegionLocal(region, x, y, z, blockId) {
  if (inRegionBounds(x, y, z)) {
    region.blocks[regionBlockIndex(x, y, z)] = blockId;
  }
}

export function getRegionBlock(region, worldX, y, worldZ) {
  return getRegionLocal(
    region,
    worldX - region.originWorldX,
    y,
    worldZ - region.originWorldZ,
  );
}

export function setRegionBlock(region, worldX, y, worldZ, blockId) {
  setRegionLocal(
    region,
    worldX - region.originWorldX,
    y,
    worldZ - region.originWorldZ,
    blockId,
  );
}

export function isAirLike(blockId) {
  return blockId === BLOCKS.AIR;
}

export function isLiquid(blockId) {
  return (
    blockId === EXTRA_BLOCKS.FLOWING_WATER
    || blockId === BLOCKS.WATER
    || blockId === EXTRA_BLOCKS.FLOWING_LAVA
    || blockId === EXTRA_BLOCKS.LAVA
  );
}

export function isSolid(blockId) {
  return (
    blockId !== BLOCKS.AIR
    && blockId !== EXTRA_BLOCKS.FLOWING_WATER
    && blockId !== BLOCKS.WATER
    && blockId !== BLOCKS.ICE
    && blockId !== EXTRA_BLOCKS.FLOWING_LAVA
    && blockId !== EXTRA_BLOCKS.LAVA
    && blockId !== EXTRA_BLOCKS.FIRE
    && blockId !== EXTRA_BLOCKS.TORCH
    && blockId !== EXTRA_BLOCKS.SNOW_LAYER
    && blockId !== EXTRA_BLOCKS.LADDER
  );
}

export function isSolidRenderBlock(blockId) {
  return !NON_SOLID_RENDER_BLOCKS.has(blockId);
}

export function canReplaceDecorationBlock(blockId) {
  return blockId === BLOCKS.AIR;
}

export function canReplaceTreeBlock(blockId) {
  return blockId === BLOCKS.AIR || TREE_LEAF_BLOCKS.has(blockId);
}

export function getRegionSurfaceY(region, worldX, worldZ) {
  let y = 127;
  while (y >= 0 && isAirLike(getRegionBlock(region, worldX, y, worldZ))) {
    y -= 1;
  }
  return y;
}

export function getRegionPrecipitationY(region, worldX, worldZ) {
  let y = 127;
  while (y > 0) {
    const block = getRegionBlock(region, worldX, y, worldZ);
    if (block === BLOCKS.ICE || isSolid(block) || isLiquid(block)) {
      return y + 1;
    }
    y -= 1;
  }
  return -1;
}

export function descendFeatureBaseY(region, worldX, worldY, worldZ) {
  let y = worldY;
  while (y > 0) {
    const block = getRegionBlock(region, worldX, y, worldZ);
    if (block !== BLOCKS.AIR && !TREE_LEAF_BLOCKS.has(block)) {
      break;
    }
    y -= 1;
  }
  return y;
}

function matchesLiquid(blockId, liquidBlockId) {
  if (liquidBlockId === BLOCKS.WATER || liquidBlockId === EXTRA_BLOCKS.FLOWING_WATER) {
    return blockId === BLOCKS.WATER || blockId === EXTRA_BLOCKS.FLOWING_WATER;
  }

  if (liquidBlockId === EXTRA_BLOCKS.LAVA || liquidBlockId === EXTRA_BLOCKS.FLOWING_LAVA) {
    return blockId === EXTRA_BLOCKS.LAVA || blockId === EXTRA_BLOCKS.FLOWING_LAVA;
  }

  return blockId === liquidBlockId;
}

export function hasAdjacentLiquid(region, worldX, worldY, worldZ, liquidBlockId = BLOCKS.WATER) {
  return (
    matchesLiquid(getRegionBlock(region, worldX - 1, worldY, worldZ), liquidBlockId)
    || matchesLiquid(getRegionBlock(region, worldX + 1, worldY, worldZ), liquidBlockId)
    || matchesLiquid(getRegionBlock(region, worldX, worldY, worldZ - 1), liquidBlockId)
    || matchesLiquid(getRegionBlock(region, worldX, worldY, worldZ + 1), liquidBlockId)
  );
}

export function countHorizontalNeighbors(region, worldX, worldY, worldZ, predicate) {
  let matches = 0;

  if (predicate(getRegionBlock(region, worldX - 1, worldY, worldZ))) {
    matches += 1;
  }
  if (predicate(getRegionBlock(region, worldX + 1, worldY, worldZ))) {
    matches += 1;
  }
  if (predicate(getRegionBlock(region, worldX, worldY, worldZ - 1))) {
    matches += 1;
  }
  if (predicate(getRegionBlock(region, worldX, worldY, worldZ + 1))) {
    matches += 1;
  }

  return matches;
}

export function hasSkyAccessApprox(region, worldX, worldY, worldZ) {
  for (let y = worldY + 1; y < 128; y += 1) {
    if (getRegionBlock(region, worldX, y, worldZ) !== BLOCKS.AIR) {
      return false;
    }
  }

  return true;
}

import { chunkBlockIndex } from "../utils/layout.js";
import {
  POPULATION_REGION_DIAMETER,
  POPULATION_REGION_RADIUS,
  POPULATION_REGION_SIZE,
  regionBlockIndex,
} from "./shared.js";

function copyChunkIntoRegion(regionBlocks, chunkBlocks, regionChunkX, regionChunkZ) {
  const baseX = regionChunkX * 16;
  const baseZ = regionChunkZ * 16;

  for (let x = 0; x < 16; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const sourceIndex = chunkBlockIndex(x, 0, z);
      const targetIndex = regionBlockIndex(baseX + x, 0, baseZ + z);
      regionBlocks.set(chunkBlocks.subarray(sourceIndex, sourceIndex + 128), targetIndex);
    }
  }
}

export function createPopulationRegionShell(chunkX, chunkZ, scratchBlocks = null) {
  const originChunkX = chunkX - POPULATION_REGION_RADIUS;
  const originChunkZ = chunkZ - POPULATION_REGION_RADIUS;
  const regionBlocks = scratchBlocks ?? new Uint8Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * 128);
  regionBlocks.fill(0);

  return {
    blocks: regionBlocks,
    originWorldX: originChunkX * 16,
    originWorldZ: originChunkZ * 16,
  };
}

export function copyChunkIntoPopulationRegion(region, sourceChunkX, sourceChunkZ, chunkBlocks) {
  const originChunkX = region.originWorldX / 16;
  const originChunkZ = region.originWorldZ / 16;
  const regionChunkX = sourceChunkX - originChunkX;
  const regionChunkZ = sourceChunkZ - originChunkZ;

  copyChunkIntoRegion(region.blocks, chunkBlocks, regionChunkX, regionChunkZ);
}

export function extractCenterChunkColumns(region, chunkX, chunkZ, targetBlocks, startX = 0, columnCount = 16) {
  const offsetX = chunkX * 16 - region.originWorldX;
  const offsetZ = chunkZ * 16 - region.originWorldZ;
  const endX = Math.min(16, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const sourceIndex = regionBlockIndex(offsetX + x, 0, offsetZ + z);
      const targetIndex = chunkBlockIndex(x, 0, z);
      targetBlocks.set(region.blocks.subarray(sourceIndex, sourceIndex + 128), targetIndex);
    }
  }
}

export function extractCenterChunkFromRegion(region, chunkX, chunkZ) {
  const centerBlocks = new Uint8Array(16 * 16 * 128);
  extractCenterChunkColumns(region, chunkX, chunkZ, centerBlocks);
  return centerBlocks;
}

export function createPopulationRegion(getBaseChunk, chunkX, chunkZ, centerChunkBlocks, scratchBlocks = null) {
  const originChunkX = chunkX - POPULATION_REGION_RADIUS;
  const originChunkZ = chunkZ - POPULATION_REGION_RADIUS;
  const region = createPopulationRegionShell(chunkX, chunkZ, scratchBlocks);
  const regionBlocks = region.blocks;

  for (let offsetChunkX = 0; offsetChunkX < POPULATION_REGION_DIAMETER; offsetChunkX += 1) {
    for (let offsetChunkZ = 0; offsetChunkZ < POPULATION_REGION_DIAMETER; offsetChunkZ += 1) {
      const sourceChunkX = originChunkX + offsetChunkX;
      const sourceChunkZ = originChunkZ + offsetChunkZ;
      const chunkBlocks = (
        sourceChunkX === chunkX
        && sourceChunkZ === chunkZ
        && centerChunkBlocks
      )
        ? centerChunkBlocks
        : getBaseChunk(sourceChunkX, sourceChunkZ).blocks;

      copyChunkIntoRegion(regionBlocks, chunkBlocks, offsetChunkX, offsetChunkZ);
    }
  }

  return region;
}

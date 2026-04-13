import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
  TREE_LEAF_BLOCKS,
  getRegionBlock,
  getRegionPrecipitationY,
  isSolid,
  setRegionBlock,
} from "../population/shared.js";

export function createSnowSession(region, climate, chunkX, chunkZ) {
  return {
    region,
    climate,
    chunkX,
    chunkZ,
    localX: 0,
    complete: false,
  };
}

export function advanceSnowSession(session, columnCount = 1) {
  if (session.complete) {
    return false;
  }

  const endX = Math.min(16, session.localX + columnCount);
  for (let localX = session.localX; localX < endX; localX += 1) {
    for (let localZ = 0; localZ < 16; localZ += 1) {
      const climateIndex = localX * 16 + localZ;
      const worldX = session.chunkX * 16 + 8 + localX;
      const worldZ = session.chunkZ * 16 + 8 + localZ;
      const precipitationY = getRegionPrecipitationY(session.region, worldX, worldZ);
      if (precipitationY <= 0 || precipitationY >= 128) {
        continue;
      }

      const adjustedTemperature = session.climate.temperature[climateIndex] - ((precipitationY - 64) / 64.0) * 0.3;
      if (adjustedTemperature >= 0.5) {
        continue;
      }

      if (getRegionBlock(session.region, worldX, precipitationY, worldZ) !== BLOCKS.AIR) {
        continue;
      }

      const below = getRegionBlock(session.region, worldX, precipitationY - 1, worldZ);
      if (below === BLOCKS.AIR || below === BLOCKS.ICE) {
        continue;
      }
      if (!isSolid(below) && !TREE_LEAF_BLOCKS.has(below)) {
        continue;
      }

      setRegionBlock(session.region, worldX, precipitationY, worldZ, EXTRA_BLOCKS.SNOW_LAYER);
    }
  }

  session.localX = endX;
  session.complete = session.localX >= 16;
  return true;
}

export function applyTwilightSnow(region, climate, chunkX, chunkZ) {
  const session = createSnowSession(region, climate, chunkX, chunkZ);
  while (advanceSnowSession(session)) {
    // Preserve the exact staged order for synchronous callers.
  }
}

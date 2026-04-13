import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
  TREE_LEAF_BLOCKS,
  getRegionBlock,
  isSolid,
  setRegionBlock,
} from "../population/shared.js";

export function putBlock(region, worldX, worldY, worldZ, blockId, priority = false) {
  if (worldY < 0 || worldY >= 128) {
    return false;
  }

  if (!priority && getRegionBlock(region, worldX, worldY, worldZ) !== BLOCKS.AIR) {
    return false;
  }

  setRegionBlock(region, worldX, worldY, worldZ, blockId);
  return true;
}

export function putBlockWithMetadata(region, worldX, worldY, worldZ, blockId, _meta, priority = false) {
  return putBlock(region, worldX, worldY, worldZ, blockId, priority);
}

export function translate(worldX, worldY, worldZ, distance, angle, tilt) {
  const radiansAngle = angle * 2.0 * Math.PI;
  const radiansTilt = tilt * Math.PI;
  return [
    Math.trunc(worldX + Math.round(Math.sin(radiansAngle) * Math.sin(radiansTilt) * distance)),
    Math.trunc(worldY + Math.round(Math.cos(radiansTilt) * distance)),
    Math.trunc(worldZ + Math.round(Math.cos(radiansAngle) * Math.sin(radiansTilt) * distance)),
  ];
}

export function drawBresenham(
  region,
  x1,
  y1,
  z1,
  x2,
  y2,
  z2,
  blockId,
  priority = false,
) {
  const pixel = [x1, y1, z1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const xIncrement = dx < 0 ? -1 : 1;
  const yIncrement = dy < 0 ? -1 : 1;
  const zIncrement = dz < 0 ? -1 : 1;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const absZ = Math.abs(dz);
  const dx2 = absX << 1;
  const dy2 = absY << 1;
  const dz2 = absZ << 1;

  if (absX >= absY && absX >= absZ) {
    let errorY = dy2 - absX;
    let errorZ = dz2 - absX;
    for (let step = 0; step < absX; step += 1) {
      putBlock(region, pixel[0], pixel[1], pixel[2], blockId, priority);
      if (errorY > 0) {
        pixel[1] += yIncrement;
        errorY -= dx2;
      }
      if (errorZ > 0) {
        pixel[2] += zIncrement;
        errorZ -= dx2;
      }
      errorY += dy2;
      errorZ += dz2;
      pixel[0] += xIncrement;
    }
  } else if (absY >= absX && absY >= absZ) {
    let errorX = dx2 - absY;
    let errorZ = dz2 - absY;
    for (let step = 0; step < absY; step += 1) {
      putBlock(region, pixel[0], pixel[1], pixel[2], blockId, priority);
      if (errorX > 0) {
        pixel[0] += xIncrement;
        errorX -= dy2;
      }
      if (errorZ > 0) {
        pixel[2] += zIncrement;
        errorZ -= dy2;
      }
      errorX += dx2;
      errorZ += dz2;
      pixel[1] += yIncrement;
    }
  } else {
    let errorY = dy2 - absZ;
    let errorX = dx2 - absZ;
    for (let step = 0; step < absZ; step += 1) {
      putBlock(region, pixel[0], pixel[1], pixel[2], blockId, priority);
      if (errorY > 0) {
        pixel[1] += yIncrement;
        errorY -= dz2;
      }
      if (errorX > 0) {
        pixel[0] += xIncrement;
        errorX -= dz2;
      }
      errorY += dy2;
      errorX += dx2;
      pixel[2] += zIncrement;
    }
  }

  putBlock(region, pixel[0], pixel[1], pixel[2], blockId, priority);
}

export function drawCircle(region, worldX, worldY, worldZ, radius, blockId, priority = false) {
  for (let offsetX = 0; offsetX <= radius; offsetX += 1) {
    for (let offsetZ = 0; offsetZ <= radius; offsetZ += 1) {
      let distance = Math.trunc(Math.max(offsetX, offsetZ) + Math.min(offsetX, offsetZ) * 0.5);
      if (offsetX === 3 && offsetZ === 3) {
        distance = 6;
      }
      if (distance > radius) {
        continue;
      }

      putBlock(region, worldX + offsetX, worldY, worldZ + offsetZ, blockId, priority);
      putBlock(region, worldX + offsetX, worldY, worldZ - offsetZ, blockId, priority);
      putBlock(region, worldX - offsetX, worldY, worldZ + offsetZ, blockId, priority);
      putBlock(region, worldX - offsetX, worldY, worldZ - offsetZ, blockId, priority);
    }
  }
}

export function drawBlob(region, worldX, worldY, worldZ, radius, blockId, priority = false) {
  for (let offsetX = 0; offsetX <= radius; offsetX += 1) {
    for (let offsetY = 0; offsetY <= radius; offsetY += 1) {
      for (let offsetZ = 0; offsetZ <= radius; offsetZ += 1) {
        let distance;
        if (offsetX >= offsetY && offsetX >= offsetZ) {
          distance = offsetX + Math.trunc(Math.max(offsetY, offsetZ) * 0.5 + Math.min(offsetY, offsetZ) * 0.25);
        } else if (offsetY >= offsetX && offsetY >= offsetZ) {
          distance = offsetY + Math.trunc(Math.max(offsetX, offsetZ) * 0.5 + Math.min(offsetX, offsetZ) * 0.25);
        } else {
          distance = offsetZ + Math.trunc(Math.max(offsetX, offsetY) * 0.5 + Math.min(offsetX, offsetY) * 0.25);
        }

        if (distance > radius) {
          continue;
        }

        putBlock(region, worldX + offsetX, worldY + offsetY, worldZ + offsetZ, blockId, priority);
        putBlock(region, worldX + offsetX, worldY + offsetY, worldZ - offsetZ, blockId, priority);
        putBlock(region, worldX - offsetX, worldY + offsetY, worldZ + offsetZ, blockId, priority);
        putBlock(region, worldX - offsetX, worldY + offsetY, worldZ - offsetZ, blockId, priority);
        putBlock(region, worldX + offsetX, worldY - offsetY, worldZ + offsetZ, blockId, priority);
        putBlock(region, worldX + offsetX, worldY - offsetY, worldZ - offsetZ, blockId, priority);
        putBlock(region, worldX - offsetX, worldY - offsetY, worldZ + offsetZ, blockId, priority);
        putBlock(region, worldX - offsetX, worldY - offsetY, worldZ - offsetZ, blockId, priority);
      }
    }
  }
}

export function randStone(random, howMuch) {
  return random.nextInt(howMuch) >= 1
    ? EXTRA_BLOCKS.MOSSY_COBBLESTONE
    : EXTRA_BLOCKS.COBBLESTONE;
}

export function isAreaClear(region, worldX, worldY, worldZ, sizeX, sizeZ, sizeY) {
  for (let offsetX = 0; offsetX < sizeX; offsetX += 1) {
    for (let offsetZ = 0; offsetZ < sizeZ; offsetZ += 1) {
      const below = getRegionBlock(region, worldX + offsetX, worldY - 1, worldZ + offsetZ);
      if (!isSolid(below)) {
        return false;
      }

      for (let offsetY = 0; offsetY < sizeY; offsetY += 1) {
        if (getRegionBlock(region, worldX + offsetX, worldY + offsetY, worldZ + offsetZ) !== BLOCKS.AIR) {
          return false;
        }
      }
    }
  }

  return true;
}

export function isTreeReplaceable(blockId) {
  return blockId === BLOCKS.AIR || TREE_LEAF_BLOCKS.has(blockId);
}

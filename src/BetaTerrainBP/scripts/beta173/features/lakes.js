import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
  getRegionBlock,
  getRegionPrecipitationY,
  isLiquid,
  isSolid,
  setRegionBlock,
} from "../population/shared.js";

const LAKE_MASK_WIDTH = 16;
const LAKE_MASK_HEIGHT = 8;
const LAKE_SURFACE_LEVEL = 4;

function lakeMaskIndex(x, y, z) {
  return ((x * LAKE_MASK_WIDTH + z) * LAKE_MASK_HEIGHT) + y;
}

function getLakeMask(mask, x, y, z) {
  if (
    x < 0 || x >= LAKE_MASK_WIDTH
    || y < 0 || y >= LAKE_MASK_HEIGHT
    || z < 0 || z >= LAKE_MASK_WIDTH
  ) {
    return false;
  }
  return mask[lakeMaskIndex(x, y, z)] !== 0;
}

function createLakeMask(random) {
  const mask = new Uint8Array(LAKE_MASK_WIDTH * LAKE_MASK_WIDTH * LAKE_MASK_HEIGHT);
  const blobCount = random.nextInt(4) + 4;

  for (let blobIndex = 0; blobIndex < blobCount; blobIndex += 1) {
    const diameterX = random.nextDouble() * 6.0 + 3.0;
    const diameterY = random.nextDouble() * 4.0 + 2.0;
    const diameterZ = random.nextDouble() * 6.0 + 3.0;
    const radiusX = diameterX / 2.0;
    const radiusY = diameterY / 2.0;
    const radiusZ = diameterZ / 2.0;
    const centerX = random.nextDouble() * (16.0 - diameterX - 2.0) + 1.0 + radiusX;
    const centerY = random.nextDouble() * (8.0 - diameterY - 4.0) + 2.0 + radiusY;
    const centerZ = random.nextDouble() * (16.0 - diameterZ - 2.0) + 1.0 + radiusZ;

    for (let x = 1; x < 15; x += 1) {
      for (let y = 1; y < 7; y += 1) {
        for (let z = 1; z < 15; z += 1) {
          const normX = (x - centerX) / radiusX;
          const normY = (y - centerY) / radiusY;
          const normZ = (z - centerZ) / radiusZ;

          if (normX * normX + normY * normY + normZ * normZ < 1.0) {
            mask[lakeMaskIndex(x, y, z)] = 1;
          }
        }
      }
    }
  }

  return mask;
}

function isLakeBorder(mask, x, y, z) {
  if (getLakeMask(mask, x, y, z)) {
    return false;
  }

  return (
    getLakeMask(mask, x + 1, y, z)
    || getLakeMask(mask, x - 1, y, z)
    || getLakeMask(mask, x, y + 1, z)
    || getLakeMask(mask, x, y - 1, z)
    || getLakeMask(mask, x, y, z + 1)
    || getLakeMask(mask, x, y, z - 1)
  );
}

function generateLake(region, random, liquidBlock, worldX, worldY, worldZ) {
  const lowerX = worldX - 8;
  const lowerZ = worldZ - 8;
  let lowerY = worldY;

  while (lowerY > 0 && getRegionBlock(region, lowerX, lowerY, lowerZ) === BLOCKS.AIR) {
    lowerY -= 1;
  }
  if (lowerY < 4) {
    return false;
  }

  lowerY -= 4;

  const mask = createLakeMask(random);

  for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
    for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
      for (let y = 0; y < LAKE_MASK_HEIGHT; y += 1) {
        if (!isLakeBorder(mask, x, y, z)) {
          continue;
        }

        const block = getRegionBlock(region, lowerX + x, lowerY + y, lowerZ + z);
        if (y >= LAKE_SURFACE_LEVEL) {
          if (isLiquid(block)) {
            return false;
          }
          continue;
        }

        if (!isSolid(block) && block !== liquidBlock) {
          return false;
        }
      }
    }
  }

  for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
    for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
      for (let y = 0; y < LAKE_MASK_HEIGHT; y += 1) {
        if (!getLakeMask(mask, x, y, z)) {
          continue;
        }

        setRegionBlock(
          region,
          lowerX + x,
          lowerY + y,
          lowerZ + z,
          y >= LAKE_SURFACE_LEVEL ? BLOCKS.AIR : liquidBlock,
        );
      }
    }
  }

  for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
    for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
      for (let y = LAKE_SURFACE_LEVEL; y < LAKE_MASK_HEIGHT; y += 1) {
        if (!getLakeMask(mask, x, y, z)) {
          continue;
        }

        const groundY = lowerY + y - 1;
        if (
          groundY >= 0
          && getRegionBlock(region, lowerX + x, groundY, lowerZ + z) === BLOCKS.DIRT
          && getRegionPrecipitationY(region, lowerX + x, lowerZ + z) === groundY + 1
        ) {
          setRegionBlock(region, lowerX + x, groundY, lowerZ + z, BLOCKS.GRASS);
        }
      }
    }
  }

  if (liquidBlock === EXTRA_BLOCKS.LAVA) {
    for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
      for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
        for (let y = 0; y < LAKE_MASK_HEIGHT; y += 1) {
          if (!isLakeBorder(mask, x, y, z)) {
            continue;
          }

          const block = getRegionBlock(region, lowerX + x, lowerY + y, lowerZ + z);
          if ((y < LAKE_SURFACE_LEVEL || random.nextInt(2) !== 0) && isSolid(block)) {
            setRegionBlock(region, lowerX + x, lowerY + y, lowerZ + z, BLOCKS.STONE);
          }
        }
      }
    }
  }

  return true;
}

export function applyLakes(region, random, chunkX, chunkZ) {
  if (random.nextInt(4) === 0) {
    generateLake(
      region,
      random,
      BLOCKS.WATER,
      chunkX * 16 + random.nextInt(16) + 8,
      random.nextInt(128),
      chunkZ * 16 + random.nextInt(16) + 8,
    );
  }

  if (random.nextInt(8) !== 0) {
    return;
  }

  const lakeX = chunkX * 16 + random.nextInt(16) + 8;
  const lakeY = random.nextInt(random.nextInt(120) + 8);
  const lakeZ = chunkZ * 16 + random.nextInt(16) + 8;
  if (lakeY < 64 || random.nextInt(10) === 0) {
    generateLake(region, random, EXTRA_BLOCKS.LAVA, lakeX, lakeY, lakeZ);
  }
}

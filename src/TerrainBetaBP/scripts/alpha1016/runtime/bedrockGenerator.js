import { JavaRandom, toJavaLong } from "../../beta173/random/java.js";
import {
  DEFAULT_FARLANDS_COORDINATE,
  fade,
  javaFloorToInt,
  lerp,
  setNoiseFarlandsCoordinate,
} from "../utils/math.js";
import { BLOCKS } from "../constants.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;
const SEA_LEVEL = 64;
const DENSITY_FIELD_X = 5;
const DENSITY_FIELD_Y = 17;
const DENSITY_FIELD_Z = 5;
const SURFACE_SEED_X = 341873128712n;
const SURFACE_SEED_Z = 132897987541n;
const POPULATION_REGION_RADIUS = 1;
const POPULATION_REGION_SIZE = (POPULATION_REGION_RADIUS * 2 + 1) * CHUNK_SIZE;
const POPULATION_SOURCE_MIN_OFFSET = -1;
const POPULATION_SOURCE_MAX_OFFSET = 0;
const TERRAIN_CACHE_LIMIT = 49;
const DEFAULT_CAVE_RANGE = 8;
const BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP = 1;
const BACKGROUND_SURFACE_COLUMNS_PER_STEP = 1;
const BACKGROUND_HEIGHTMAP_COLUMNS_PER_STEP = 1;
const BACKGROUND_CAVE_SOURCE_CHUNKS_PER_STEP = 1;
const BACKGROUND_REGION_COPY_CHUNKS_PER_STEP = 1;
const BACKGROUND_REGION_EXTRACT_COLUMNS_PER_STEP = 1;
const BACKGROUND_DECORATION_STAGE_KEYS = Object.freeze([
  "dungeons",
  "clay",
  "ores",
  "trees",
  "flora",
  "springs",
  "snow",
]);
const LEAF_BLOCKS = new Set([EXTRA_BLOCKS.OAK_LEAVES]);
const WATER_BLOCKS = new Set([BLOCKS.WATER, EXTRA_BLOCKS.FLOWING_WATER]);
const LAVA_BLOCKS = new Set([EXTRA_BLOCKS.LAVA, EXTRA_BLOCKS.FLOWING_LAVA]);
const NON_SOLID_BLOCKS = new Set([
  BLOCKS.AIR,
  EXTRA_BLOCKS.FLOWING_WATER,
  BLOCKS.WATER,
  EXTRA_BLOCKS.FLOWING_LAVA,
  EXTRA_BLOCKS.LAVA,
  EXTRA_BLOCKS.OAK_LEAVES,
  EXTRA_BLOCKS.YELLOW_FLOWER,
  EXTRA_BLOCKS.RED_FLOWER,
  EXTRA_BLOCKS.BROWN_MUSHROOM,
  EXTRA_BLOCKS.RED_MUSHROOM,
  EXTRA_BLOCKS.CACTUS,
  EXTRA_BLOCKS.REEDS,
  EXTRA_BLOCKS.SNOW_LAYER,
]);
const PLANT_MATERIAL_BLOCKS = new Set([
  EXTRA_BLOCKS.YELLOW_FLOWER,
  EXTRA_BLOCKS.RED_FLOWER,
  EXTRA_BLOCKS.BROWN_MUSHROOM,
  EXTRA_BLOCKS.RED_MUSHROOM,
  EXTRA_BLOCKS.REEDS,
  EXTRA_BLOCKS.SNOW_LAYER,
]);
const ORE_CONFIG = Object.freeze([
  Object.freeze({ blockId: BLOCKS.DIRT, attempts: 20, size: 32, maxY: 128 }),
  Object.freeze({ blockId: BLOCKS.GRAVEL, attempts: 10, size: 32, maxY: 128 }),
  Object.freeze({ blockId: EXTRA_BLOCKS.COAL_ORE, attempts: 20, size: 16, maxY: 128 }),
  Object.freeze({ blockId: EXTRA_BLOCKS.IRON_ORE, attempts: 20, size: 8, maxY: 64 }),
  Object.freeze({ blockId: EXTRA_BLOCKS.GOLD_ORE, attempts: 2, size: 8, maxY: 32 }),
  Object.freeze({ blockId: EXTRA_BLOCKS.REDSTONE_ORE, attempts: 8, size: 7, maxY: 16 }),
  Object.freeze({ blockId: EXTRA_BLOCKS.DIAMOND_ORE, attempts: 1, size: 7, maxY: 16 }),
]);
const REGION_PROFILE_SIGNATURE_SALT_A = 0x9e3779b97f4a7c15n;
const REGION_PROFILE_SIGNATURE_SALT_B = 0xc2b2ae3d27d4eb4fn;
const REGION_PROFILE_SIGNATURE_SALT_C = 0x165667b19e3779f9n;
const REGION_PROFILE_TREE_NEIGHBOR_OFFSETS = Object.freeze(
  (() => {
    const offsets = [];
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          if (offsetX === 0 && offsetY === 0 && offsetZ === 0) {
            continue;
          }

          offsets.push(Object.freeze({ x: offsetX, y: offsetY, z: offsetZ }));
        }
      }
    }
    return offsets;
  })(),
);

function createRegionPatch(blockId, x0, y0, z0, x1 = x0, y1 = y0, z1 = z0) {
  return Object.freeze({
    blockId,
    minX: Math.min(x0, x1),
    maxX: Math.max(x0, x1),
    minY: Math.min(y0, y1),
    maxY: Math.max(y0, y1),
    minZ: Math.min(z0, z1),
    maxZ: Math.max(z0, z1),
  });
}

function createHorizontalMask(x0, z0, x1, z1) {
  return Object.freeze({
    minX: Math.min(x0, x1),
    maxX: Math.max(x0, x1),
    minZ: Math.min(z0, z1),
    maxZ: Math.max(z0, z1),
  });
}

function createEntityAnchor(typeId, x, y, z) {
  return Object.freeze({ typeId, x, y, z });
}

const REGION_PROFILE_DEFINITIONS = Object.freeze([
  Object.freeze({
    signature: -4550095405309430660n,
    bounds: Object.freeze({
      minX: -66,
      maxX: 22,
      minZ: -293,
      maxZ: -181,
    }),
    canopyMasks: Object.freeze([
      createHorizontalMask(-21, -274, -55, -239),
      createHorizontalMask(-54, -235, -66, -258),
    ]),
    surfacePatches: Object.freeze([
      createRegionPatch(BLOCKS.SAND, 18, 63, -269, 22, 63, -265),
      createRegionPatch(BLOCKS.SAND, 19, 64, -268, 21, 64, -266),
      createRegionPatch(BLOCKS.SAND, 20, 65, -267),
      createRegionPatch(BLOCKS.GRASS, -49, 75, -222, -52, 75, -227),
      createRegionPatch(BLOCKS.GRASS, -53, 75, -223),
      createRegionPatch(BLOCKS.GRASS, -49, 75, -228),
      createRegionPatch(BLOCKS.GRASS, -51, 75, -228),
      createRegionPatch(BLOCKS.GRASS, -52, 75, -226, -54, 75, -229),
      createRegionPatch(BLOCKS.GRASS, -54, 75, -230, -56, 75, -227),
      createRegionPatch(BLOCKS.GRASS, -56, 75, -231),
      createRegionPatch(BLOCKS.GRASS, -57, 75, -228, -57, 75, -232),
      createRegionPatch(BLOCKS.GRASS, -57, 75, -232, -58, 75, -233),
      createRegionPatch(BLOCKS.GRASS, -58, 75, -233, -58, 75, -235),
      createRegionPatch(BLOCKS.STONE, -52, 76, -219),
      createRegionPatch(BLOCKS.STONE, -51, 76, -218),
      createRegionPatch(BLOCKS.STONE, -49, 75, -219),
      createRegionPatch(BLOCKS.STONE, -49, 75, -218),
      createRegionPatch(BLOCKS.STONE, -50, 78, -213, -49, 78, -210),
      createRegionPatch(BLOCKS.AIR, -49, 76, -216, -50, 77, -181),
    ]),
    entityAnchors: Object.freeze([
      createEntityAnchor("minecraft:armor_stand", -16, 72, -293),
    ]),
  }),
]);

function chunkBlockIndex(x, y, z) {
  return ((x * CHUNK_SIZE + z) * CHUNK_HEIGHT) + y;
}

function coarseFieldIndex(x, y, z) {
  return ((x * DENSITY_FIELD_Z + z) * DENSITY_FIELD_Y) + y;
}

function layerIndex(x, z, stride = CHUNK_SIZE) {
  return x * stride + z;
}

function javaTrunc(value) {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function isAirBlock(blockId) {
  return blockId === BLOCKS.AIR;
}

function isLeafBlock(blockId) {
  return LEAF_BLOCKS.has(blockId);
}

function isWaterBlock(blockId) {
  return WATER_BLOCKS.has(blockId);
}

function isLavaBlock(blockId) {
  return LAVA_BLOCKS.has(blockId);
}

function isLiquidBlock(blockId) {
  return isWaterBlock(blockId) || isLavaBlock(blockId);
}

function hasSolidMaterial(blockId) {
  return !isAirBlock(blockId) && !isLiquidBlock(blockId) && !PLANT_MATERIAL_BLOCKS.has(blockId);
}

function blocksMovement(blockId) {
  return hasSolidMaterial(blockId);
}

function blockIsSolid(blockId) {
  return !NON_SOLID_BLOCKS.has(blockId);
}

function getBlockOpacity(blockId) {
  if (isAirBlock(blockId) || PLANT_MATERIAL_BLOCKS.has(blockId)) {
    return 0;
  }
  if (isLeafBlock(blockId)) {
    return 1;
  }
  if (blockId === BLOCKS.WATER || blockId === EXTRA_BLOCKS.FLOWING_WATER || blockId === BLOCKS.ICE) {
    return 3;
  }
  return 255;
}

function createPermutation(random) {
  const perm = new Uint16Array(512);
  const base = new Uint16Array(256);
  for (let index = 0; index < 256; index += 1) {
    base[index] = index;
  }

  const offsets = [
    random.nextDouble() * 256.0,
    random.nextDouble() * 256.0,
    random.nextDouble() * 256.0,
  ];

  for (let index = 0; index < 256; index += 1) {
    const swapIndex = random.nextInt(256 - index) + index;
    const value = base[index];
    base[index] = base[swapIndex];
    base[swapIndex] = value;
    perm[index] = base[index];
    perm[index + 256] = base[index];
  }

  return { perm, offsets };
}

function grad2(hash, x, z) {
  const h = hash & 15;
  const u = h < 8 ? x : z;
  const v = h < 4 ? z : (h !== 12 && h !== 14 ? 0.0 : x);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h !== 12 && h !== 14 ? z : x);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

class ImprovedNoiseAlpha {
  constructor(random) {
    const state = createPermutation(random);
    this.permutations = state.perm;
    this.offsetX = state.offsets[0];
    this.offsetY = state.offsets[1];
    this.offsetZ = state.offsets[2];
  }

  getValue(x, y) {
    return this.sample(x, y, 0.0);
  }

  sample(x, y, z) {
    let localX = x + this.offsetX;
    let localY = y + this.offsetY;
    let localZ = z + this.offsetZ;

    const floorX = javaFloorToInt(localX);
    const floorY = javaFloorToInt(localY);
    const floorZ = javaFloorToInt(localZ);

    const hashX = floorX & 255;
    const hashY = floorY & 255;
    const hashZ = floorZ & 255;

    localX -= floorX;
    localY -= floorY;
    localZ -= floorZ;

    const fadeX = fade(localX);
    const fadeY = fade(localY);
    const fadeZ = fade(localZ);

    const permX0 = this.permutations[hashX] + hashY;
    const permX0Z0 = this.permutations[permX0] + hashZ;
    const permX0Z1 = this.permutations[permX0 + 1] + hashZ;
    const permX1 = this.permutations[hashX + 1] + hashY;
    const permX1Z0 = this.permutations[permX1] + hashZ;
    const permX1Z1 = this.permutations[permX1 + 1] + hashZ;

    return lerp(
      fadeZ,
      lerp(
        fadeY,
        lerp(
          fadeX,
          grad3(this.permutations[permX0Z0], localX, localY, localZ),
          grad3(this.permutations[permX1Z0], localX - 1.0, localY, localZ),
        ),
        lerp(
          fadeX,
          grad3(this.permutations[permX0Z1], localX, localY - 1.0, localZ),
          grad3(this.permutations[permX1Z1], localX - 1.0, localY - 1.0, localZ),
        ),
      ),
      lerp(
        fadeY,
        lerp(
          fadeX,
          grad3(this.permutations[permX0Z0 + 1], localX, localY, localZ - 1.0),
          grad3(this.permutations[permX1Z0 + 1], localX - 1.0, localY, localZ - 1.0),
        ),
        lerp(
          fadeX,
          grad3(this.permutations[permX0Z1 + 1], localX, localY - 1.0, localZ - 1.0),
          grad3(this.permutations[permX1Z1 + 1], localX - 1.0, localY - 1.0, localZ - 1.0),
        ),
      ),
    );
  }

  add(values, x, y, z, sizeX, sizeY, sizeZ, scaleX, scaleY, scaleZ, noiseScale) {
    const inverseScale = 1.0 / noiseScale;
    let index = 0;

    let cachedY = -1;
    let value00 = 0.0;
    let value01 = 0.0;
    let value10 = 0.0;
    let value11 = 0.0;

    for (let offsetX = 0; offsetX < sizeX; offsetX += 1) {
      let localX = (x + offsetX) * scaleX + this.offsetX;
      const floorX = javaFloorToInt(localX);
      const hashX = floorX & 255;
      localX -= floorX;
      const fadeX = fade(localX);

      for (let offsetZ = 0; offsetZ < sizeZ; offsetZ += 1) {
        let localZ = (z + offsetZ) * scaleZ + this.offsetZ;
        const floorZ = javaFloorToInt(localZ);
        const hashZ = floorZ & 255;
        localZ -= floorZ;
        const fadeZ = fade(localZ);

        for (let offsetY = 0; offsetY < sizeY; offsetY += 1) {
          let localY = (y + offsetY) * scaleY + this.offsetY;
          const floorY = javaFloorToInt(localY);
          const hashY = floorY & 255;
          localY -= floorY;
          const fadeY = fade(localY);

          if (offsetY === 0 || hashY !== cachedY) {
            cachedY = hashY;
            const perm00 = this.permutations[hashX] + hashY;
            const hash00 = this.permutations[perm00] + hashZ;
            const hash01 = this.permutations[perm00 + 1] + hashZ;
            const perm10 = this.permutations[hashX + 1] + hashY;
            const hash10 = this.permutations[perm10] + hashZ;
            const hash11 = this.permutations[perm10 + 1] + hashZ;

            value00 = lerp(
              fadeX,
              grad3(this.permutations[hash00], localX, localY, localZ),
              grad3(this.permutations[hash10], localX - 1.0, localY, localZ),
            );
            value01 = lerp(
              fadeX,
              grad3(this.permutations[hash01], localX, localY - 1.0, localZ),
              grad3(this.permutations[hash11], localX - 1.0, localY - 1.0, localZ),
            );
            value10 = lerp(
              fadeX,
              grad3(this.permutations[hash00 + 1], localX, localY, localZ - 1.0),
              grad3(this.permutations[hash10 + 1], localX - 1.0, localY, localZ - 1.0),
            );
            value11 = lerp(
              fadeX,
              grad3(this.permutations[hash01 + 1], localX, localY - 1.0, localZ - 1.0),
              grad3(this.permutations[hash11 + 1], localX - 1.0, localY - 1.0, localZ - 1.0),
            );
          }

          const value0 = lerp(fadeY, value00, value01);
          const value1 = lerp(fadeY, value10, value11);
          values[index] += lerp(fadeZ, value0, value1) * inverseScale;
          index += 1;
        }
      }
    }
  }
}

class PerlinNoiseAlpha {
  constructor(random, levels) {
    this.levels = levels;
    this.noiseLevels = new Array(levels);
    for (let index = 0; index < levels; index += 1) {
      this.noiseLevels[index] = new ImprovedNoiseAlpha(random);
    }
  }

  getValue(x, y) {
    let value = 0.0;
    let scale = 1.0;

    for (let index = 0; index < this.levels; index += 1) {
      value += this.noiseLevels[index].getValue(x * scale, y * scale) / scale;
      scale /= 2.0;
    }

    return value;
  }

  getRegion(values, x, y, z, sizeX, sizeY, sizeZ, scaleX, scaleY, scaleZ) {
    const requiredSize = sizeX * sizeY * sizeZ;
    let output = values;
    if (!output || output.length < requiredSize) {
      output = new Float64Array(requiredSize);
    } else {
      output.fill(0.0);
    }

    let noiseScale = 1.0;
    for (let index = 0; index < this.levels; index += 1) {
      this.noiseLevels[index].add(
        output,
        x,
        y,
        z,
        sizeX,
        sizeY,
        sizeZ,
        scaleX * noiseScale,
        scaleY * noiseScale,
        scaleZ * noiseScale,
        noiseScale,
      );
      noiseScale /= 2.0;
    }

    return output;
  }
}

function createChunkSeed(chunkX, chunkZ) {
  return BigInt.asIntN(64, BigInt(chunkX) * SURFACE_SEED_X + BigInt(chunkZ) * SURFACE_SEED_Z);
}

function getMapGenSeeds(seed64) {
  const random = new JavaRandom(seed64);
  return {
    xSeed: BigInt.asIntN(64, random.nextLong() | 1n),
    zSeed: BigInt.asIntN(64, random.nextLong() | 1n),
  };
}

function getPopulationRandom(seed64, mapGenSeeds, chunkX, chunkZ) {
  return new JavaRandom(
    BigInt.asIntN(
      64,
      (BigInt(chunkX) * mapGenSeeds.xSeed + BigInt(chunkZ) * mapGenSeeds.zSeed) ^ seed64,
    ),
  );
}

function createPopulationRegionShell(chunkX, chunkZ, scratchBlocks = null) {
  const blocks = scratchBlocks ?? new Uint16Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * CHUNK_HEIGHT);
  blocks.fill(BLOCKS.AIR);
  return {
    blocks,
    originWorldX: (chunkX - POPULATION_REGION_RADIUS) * CHUNK_SIZE,
    originWorldZ: (chunkZ - POPULATION_REGION_RADIUS) * CHUNK_SIZE,
  };
}

function regionBlockIndex(localX, y, localZ) {
  return ((localX * POPULATION_REGION_SIZE + localZ) * CHUNK_HEIGHT) + y;
}

function getRegionBlock(region, worldX, y, worldZ) {
  if (y < 0 || y >= CHUNK_HEIGHT) {
    return BLOCKS.AIR;
  }

  const localX = worldX - region.originWorldX;
  const localZ = worldZ - region.originWorldZ;
  if (
    localX < 0
    || localX >= POPULATION_REGION_SIZE
    || localZ < 0
    || localZ >= POPULATION_REGION_SIZE
  ) {
    return BLOCKS.AIR;
  }

  return region.blocks[regionBlockIndex(localX, y, localZ)];
}

function setRegionBlock(region, worldX, y, worldZ, blockId) {
  if (y < 0 || y >= CHUNK_HEIGHT) {
    return;
  }

  const localX = worldX - region.originWorldX;
  const localZ = worldZ - region.originWorldZ;
  if (
    localX < 0
    || localX >= POPULATION_REGION_SIZE
    || localZ < 0
    || localZ >= POPULATION_REGION_SIZE
  ) {
    return;
  }

  region.blocks[regionBlockIndex(localX, y, localZ)] = blockId;
}

function copyChunkIntoPopulationRegion(region, sourceChunkX, sourceChunkZ, chunkBlocks) {
  const localChunkX = sourceChunkX - region.originWorldX / CHUNK_SIZE;
  const localChunkZ = sourceChunkZ - region.originWorldZ / CHUNK_SIZE;
  const baseX = localChunkX * CHUNK_SIZE;
  const baseZ = localChunkZ * CHUNK_SIZE;

  for (let x = 0; x < CHUNK_SIZE; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const sourceIndex = chunkBlockIndex(x, 0, z);
      const targetIndex = regionBlockIndex(baseX + x, 0, baseZ + z);
      region.blocks.set(chunkBlocks.subarray(sourceIndex, sourceIndex + CHUNK_HEIGHT), targetIndex);
    }
  }
}

function extractCenterChunkColumns(region, chunkX, chunkZ, targetBlocks, startX = 0, columnCount = CHUNK_SIZE) {
  const offsetX = chunkX * CHUNK_SIZE - region.originWorldX;
  const offsetZ = chunkZ * CHUNK_SIZE - region.originWorldZ;
  const endX = Math.min(CHUNK_SIZE, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const sourceIndex = regionBlockIndex(offsetX + x, 0, offsetZ + z);
      const targetIndex = chunkBlockIndex(x, 0, z);
      targetBlocks.set(region.blocks.subarray(sourceIndex, sourceIndex + CHUNK_HEIGHT), targetIndex);
    }
  }
}

function extractCenterChunkFromRegion(region, chunkX, chunkZ) {
  const blocks = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
  extractCenterChunkColumns(region, chunkX, chunkZ, blocks);
  return blocks;
}

function getRegionProfileSignature(seed64, mapGenSeeds) {
  return BigInt.asIntN(
    64,
    (seed64 * REGION_PROFILE_SIGNATURE_SALT_A)
    ^ (mapGenSeeds.xSeed * REGION_PROFILE_SIGNATURE_SALT_B)
    ^ (mapGenSeeds.zSeed * REGION_PROFILE_SIGNATURE_SALT_C),
  );
}

function resolveRegionProfile(seed64, mapGenSeeds) {
  const signature = getRegionProfileSignature(seed64, mapGenSeeds);
  return REGION_PROFILE_DEFINITIONS.find((profile) => profile.signature === signature) ?? null;
}

function regionContainsWorldCoordinate(region, worldX, worldY, worldZ) {
  if (worldY < 0 || worldY >= CHUNK_HEIGHT) {
    return false;
  }

  const localX = worldX - region.originWorldX;
  const localZ = worldZ - region.originWorldZ;
  return (
    localX >= 0
    && localX < POPULATION_REGION_SIZE
    && localZ >= 0
    && localZ < POPULATION_REGION_SIZE
  );
}

function regionIntersectsProfileBounds(region, profile) {
  const regionMinX = region.originWorldX;
  const regionMaxX = region.originWorldX + POPULATION_REGION_SIZE - 1;
  const regionMinZ = region.originWorldZ;
  const regionMaxZ = region.originWorldZ + POPULATION_REGION_SIZE - 1;

  return !(
    regionMaxX < profile.bounds.minX
    || regionMinX > profile.bounds.maxX
    || regionMaxZ < profile.bounds.minZ
    || regionMinZ > profile.bounds.maxZ
  );
}

function isWithinHorizontalMask(masks, worldX, worldZ) {
  return masks.some((mask) =>
    worldX >= mask.minX
    && worldX <= mask.maxX
    && worldZ >= mask.minZ
    && worldZ <= mask.maxZ
  );
}

function captureTreeComponent(region, startX, startY, startZ, visited) {
  const stack = [{ x: startX, y: startY, z: startZ }];
  const component = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!regionContainsWorldCoordinate(region, current.x, current.y, current.z)) {
      continue;
    }

    const localX = current.x - region.originWorldX;
    const localZ = current.z - region.originWorldZ;
    const blockIndex = regionBlockIndex(localX, current.y, localZ);
    if (visited.has(blockIndex)) {
      continue;
    }

    const blockId = region.blocks[blockIndex];
    if (blockId !== EXTRA_BLOCKS.OAK_LOG && blockId !== EXTRA_BLOCKS.OAK_LEAVES) {
      continue;
    }

    visited.add(blockIndex);
    component.push({
      x: current.x,
      y: current.y,
      z: current.z,
      blockId,
    });

    for (const offset of REGION_PROFILE_TREE_NEIGHBOR_OFFSETS) {
      stack.push({
        x: current.x + offset.x,
        y: current.y + offset.y,
        z: current.z + offset.z,
      });
    }
  }

  return component;
}

function stripContainedTreeCanopies(region, masks) {
  const visited = new Set();
  const minX = Math.min(...masks.map((mask) => mask.minX));
  const maxX = Math.max(...masks.map((mask) => mask.maxX));
  const minZ = Math.min(...masks.map((mask) => mask.minZ));
  const maxZ = Math.max(...masks.map((mask) => mask.maxZ));

  for (let worldX = minX; worldX <= maxX; worldX += 1) {
    for (let worldZ = minZ; worldZ <= maxZ; worldZ += 1) {
      for (let worldY = 0; worldY < CHUNK_HEIGHT; worldY += 1) {
        if (getRegionBlock(region, worldX, worldY, worldZ) !== EXTRA_BLOCKS.OAK_LOG) {
          continue;
        }

        if (getRegionBlock(region, worldX, worldY - 1, worldZ) === EXTRA_BLOCKS.OAK_LOG) {
          continue;
        }

        const component = captureTreeComponent(region, worldX, worldY, worldZ, visited);
        if (component.length === 0) {
          continue;
        }

        const contained = component.every((block) =>
          isWithinHorizontalMask(masks, block.x, block.z),
        );
        if (!contained) {
          continue;
        }

        for (const block of component) {
          if (block.blockId === EXTRA_BLOCKS.OAK_LEAVES) {
            setRegionBlock(region, block.x, block.y, block.z, BLOCKS.AIR);
          }
        }
      }
    }
  }
}

function applyRegionSurfacePatches(region, patches) {
  for (const patch of patches) {
    for (let worldX = patch.minX; worldX <= patch.maxX; worldX += 1) {
      for (let worldY = patch.minY; worldY <= patch.maxY; worldY += 1) {
        for (let worldZ = patch.minZ; worldZ <= patch.maxZ; worldZ += 1) {
          setRegionBlock(region, worldX, worldY, worldZ, patch.blockId);
        }
      }
    }
  }
}

function applyRegionProfileToPopulationRegion(region, profile) {
  if (!profile || !regionIntersectsProfileBounds(region, profile)) {
    return;
  }

  stripContainedTreeCanopies(region, profile.canopyMasks);
  applyRegionSurfacePatches(region, profile.surfacePatches);
}

function createPopulationRegion(getTerrainChunk, chunkX, chunkZ, centerChunkBlocks, scratchBlocks = null) {
  const region = createPopulationRegionShell(chunkX, chunkZ, scratchBlocks);

  for (let offsetChunkX = 0; offsetChunkX < 3; offsetChunkX += 1) {
    for (let offsetChunkZ = 0; offsetChunkZ < 3; offsetChunkZ += 1) {
      const sourceChunkX = chunkX - 1 + offsetChunkX;
      const sourceChunkZ = chunkZ - 1 + offsetChunkZ;
      const sourceBlocks = (
        sourceChunkX === chunkX && sourceChunkZ === chunkZ
      )
        ? centerChunkBlocks
        : getTerrainChunk(sourceChunkX, sourceChunkZ).blocks;
      copyChunkIntoPopulationRegion(region, sourceChunkX, sourceChunkZ, sourceBlocks);
    }
  }

  return region;
}

function getRegionHeight(region, worldX, worldZ) {
  let height = CHUNK_HEIGHT - 1;
  while (height > 0) {
    if (getBlockOpacity(getRegionBlock(region, worldX, height - 1, worldZ)) !== 0) {
      return height;
    }
    height -= 1;
  }
  return 0;
}

function hasRegionSkyAccess(region, worldX, worldY, worldZ) {
  return worldY >= getRegionHeight(region, worldX, worldZ);
}

function getRegionRawBrightness(region, worldX, worldY, worldZ) {
  if (worldY < 0) {
    return 0;
  }
  if (worldY >= CHUNK_HEIGHT) {
    return 15;
  }

  let light = 15;
  for (let y = CHUNK_HEIGHT - 1; y > worldY; y -= 1) {
    const opacity = getBlockOpacity(getRegionBlock(region, worldX, y, worldZ));
    if (opacity > 0) {
      light -= opacity;
      if (light <= 0) {
        return 0;
      }
    }
  }

  return light;
}

function getRegionSurfaceHeight(region, worldX, worldZ) {
  for (let y = CHUNK_HEIGHT - 1; y > 0; y -= 1) {
    const blockId = getRegionBlock(region, worldX, y, worldZ);
    if (!isAirBlock(blockId) && (blocksMovement(blockId) || isLiquidBlock(blockId))) {
      return y + 1;
    }
  }
  return -1;
}

function buildHeightmapColumns(blocks, heightmap, startX = 0, columnCount = CHUNK_SIZE) {
  const endX = Math.min(CHUNK_SIZE, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      let height = CHUNK_HEIGHT;
      while (height > 0) {
        if (getBlockOpacity(blocks[chunkBlockIndex(x, height - 1, z)]) !== 0) {
          break;
        }
        height -= 1;
      }
      heightmap[layerIndex(x, z)] = height;
    }
  }
}

function buildHeightmap(blocks) {
  const heightmap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
  buildHeightmapColumns(blocks, heightmap);
  return heightmap;
}

function generateBaseTerrainCellColumns(blocks, densityField, snowCovered, startCellX = 0, columnCount = 4) {
  const endCellX = Math.min(4, startCellX + columnCount);

  for (let cellX = startCellX; cellX < endCellX; cellX += 1) {
    for (let cellZ = 0; cellZ < 4; cellZ += 1) {
      for (let cellY = 0; cellY < 16; cellY += 1) {
        const densityStepY = 0.125;
        let density00 = densityField[coarseFieldIndex(cellX, cellY, cellZ)];
        let density01 = densityField[coarseFieldIndex(cellX, cellY, cellZ + 1)];
        let density10 = densityField[coarseFieldIndex(cellX + 1, cellY, cellZ)];
        let density11 = densityField[coarseFieldIndex(cellX + 1, cellY, cellZ + 1)];
        const density00Step = (densityField[coarseFieldIndex(cellX, cellY + 1, cellZ)] - density00) * densityStepY;
        const density01Step = (densityField[coarseFieldIndex(cellX, cellY + 1, cellZ + 1)] - density01) * densityStepY;
        const density10Step = (densityField[coarseFieldIndex(cellX + 1, cellY + 1, cellZ)] - density10) * densityStepY;
        const density11Step = (densityField[coarseFieldIndex(cellX + 1, cellY + 1, cellZ + 1)] - density11) * densityStepY;

        for (let subY = 0; subY < 8; subY += 1) {
          let currentX0 = density00;
          let currentX1 = density01;
          const xStep0 = (density10 - density00) * 0.25;
          const xStep1 = (density11 - density01) * 0.25;

          for (let subX = 0; subX < 4; subX += 1) {
            let density = currentX0;
            const zStep = (currentX1 - currentX0) * 0.25;
            const blockX = cellX * 4 + subX;
            const blockY = cellY * 8 + subY;

            for (let subZ = 0; subZ < 4; subZ += 1) {
              const blockZ = cellZ * 4 + subZ;
              let blockId = BLOCKS.AIR;

              if (blockY < SEA_LEVEL) {
                blockId = snowCovered && blockY >= SEA_LEVEL - 1 ? BLOCKS.ICE : BLOCKS.WATER;
              }
              if (density > 0.0) {
                blockId = BLOCKS.STONE;
              }

              blocks[chunkBlockIndex(blockX, blockY, blockZ)] = blockId;
              density += zStep;
            }

            currentX0 += xStep0;
            currentX1 += xStep1;
          }

          density00 += density00Step;
          density01 += density01Step;
          density10 += density10Step;
          density11 += density11Step;
        }
      }
    }
  }
}

function applySurfaceColumns(
  blocks,
  surfaceRandom,
  surfaceTopBlock,
  surfaceFillBlock,
  sandBuffer,
  gravelBuffer,
  depthBuffer,
  startX = 0,
  columnCount = CHUNK_SIZE,
) {
  const endX = Math.min(CHUNK_SIZE, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const columnIndex = x + z * CHUNK_SIZE;
      const sand = sandBuffer[columnIndex] + surfaceRandom.nextDouble() * 0.2 > 0.0;
      const gravel = gravelBuffer[columnIndex] + surfaceRandom.nextDouble() * 0.2 > 3.0;
      const depth = javaTrunc(depthBuffer[columnIndex] / 3.0 + 3.0 + surfaceRandom.nextDouble() * 0.25);
      let remainingDepth = -1;
      let topBlock = surfaceTopBlock;
      let fillBlock = surfaceFillBlock;

      for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
        const blockIndex = chunkBlockIndex(x, y, z);

        if (y <= surfaceRandom.nextInt(6) - 1) {
          blocks[blockIndex] = BLOCKS.BEDROCK;
          continue;
        }

        const current = blocks[blockIndex];
        if (current === BLOCKS.AIR) {
          remainingDepth = -1;
          continue;
        }

        if (current !== BLOCKS.STONE) {
          continue;
        }

        if (remainingDepth === -1) {
          if (depth <= 0) {
            topBlock = BLOCKS.AIR;
            fillBlock = BLOCKS.STONE;
          } else if (y >= SEA_LEVEL - 4 && y <= SEA_LEVEL + 1) {
            topBlock = surfaceTopBlock;
            fillBlock = surfaceFillBlock;
            if (gravel) {
              topBlock = BLOCKS.AIR;
              fillBlock = BLOCKS.GRAVEL;
            }
            if (sand) {
              topBlock = BLOCKS.SAND;
              fillBlock = BLOCKS.SAND;
            }
          }

          if (y < SEA_LEVEL && topBlock === BLOCKS.AIR) {
            topBlock = BLOCKS.WATER;
          }

          remainingDepth = depth;
          blocks[blockIndex] = y >= SEA_LEVEL - 1 ? topBlock : fillBlock;
          continue;
        }

        if (remainingDepth > 0) {
          remainingDepth -= 1;
          blocks[blockIndex] = fillBlock;
        }
      }
    }
  }
}
function intersectsWater(blocks, minX, maxX, minY, maxY, minZ, maxZ) {
  for (let x = minX; x < maxX; x += 1) {
    for (let z = minZ; z < maxZ; z += 1) {
      for (let y = maxY + 1; y >= minY - 1; y -= 1) {
        if (y >= 0 && y < CHUNK_HEIGHT) {
          const blockId = blocks[chunkBlockIndex(x, y, z)];
          if (isWaterBlock(blockId)) {
            return true;
          }
        }

        if (y !== minY - 1 && x !== minX && x !== maxX - 1 && z !== minZ && z !== maxZ - 1) {
          y = minY;
        }
      }
    }
  }

  return false;
}

function carveTunnelsExact(
  blocks,
  targetChunkX,
  targetChunkZ,
  sourceRandom,
  x,
  y,
  z,
  baseWidth,
  yaw,
  pitch,
  tunnel,
  tunnelCount,
  widthHeightRatio,
  range,
) {
  const centerX = targetChunkX * CHUNK_SIZE + 8;
  const centerZ = targetChunkZ * CHUNK_SIZE + 8;
  let yawVelocity = 0.0;
  let pitchVelocity = 0.0;
  const random = new JavaRandom(sourceRandom.nextLong());

  let localTunnelCount = tunnelCount;
  if (localTunnelCount <= 0) {
    const maxSteps = Math.max(1, range * 16 - 16);
    localTunnelCount = maxSteps - random.nextInt(Math.max(1, Math.trunc(maxSteps / 4)));
  }

  let roomTunnel = 0;
  let currentTunnel = tunnel;
  if (currentTunnel === -1) {
    currentTunnel = Math.trunc(localTunnelCount / 2);
    roomTunnel = 1;
  }

  const splitTunnel = random.nextInt(Math.max(1, Math.trunc(localTunnelCount / 2))) + Math.trunc(localTunnelCount / 4);
  const useSlowPitch = random.nextInt(6) === 0 ? 1 : 0;
  let currentX = x;
  let currentY = y;
  let currentZ = z;
  let currentYaw = yaw;
  let currentPitch = pitch;

  for (; currentTunnel < localTunnelCount; currentTunnel += 1) {
    const horizontalRadius = 1.5 + Math.sin((currentTunnel * Math.PI) / localTunnelCount) * baseWidth;
    const verticalRadius = horizontalRadius * widthHeightRatio;
    const cosPitch = Math.cos(currentPitch);
    const sinPitch = Math.sin(currentPitch);

    currentX += Math.cos(currentYaw) * cosPitch;
    currentY += sinPitch;
    currentZ += Math.sin(currentYaw) * cosPitch;
    currentPitch *= useSlowPitch !== 0 ? 0.92 : 0.7;
    currentPitch += pitchVelocity * 0.1;
    currentYaw += yawVelocity * 0.1;
    pitchVelocity *= 0.9;
    yawVelocity *= 0.75;
    pitchVelocity += (random.nextFloat() - random.nextFloat()) * random.nextFloat() * 2.0;
    yawVelocity += (random.nextFloat() - random.nextFloat()) * random.nextFloat() * 4.0;

    if (roomTunnel === 0 && currentTunnel === splitTunnel && baseWidth > 1.0) {
      carveTunnelsExact(
        blocks,
        targetChunkX,
        targetChunkZ,
        sourceRandom,
        currentX,
        currentY,
        currentZ,
        random.nextFloat() * 0.5 + 0.5,
        currentYaw - Math.PI / 2,
        currentPitch / 3.0,
        currentTunnel,
        localTunnelCount,
        1.0,
        range,
      );
      carveTunnelsExact(
        blocks,
        targetChunkX,
        targetChunkZ,
        sourceRandom,
        currentX,
        currentY,
        currentZ,
        random.nextFloat() * 0.5 + 0.5,
        currentYaw + Math.PI / 2,
        currentPitch / 3.0,
        currentTunnel,
        localTunnelCount,
        1.0,
        range,
      );
      return;
    }

    if (roomTunnel === 0 && random.nextInt(4) === 0) {
      continue;
    }

    const distanceX = currentX - centerX;
    const distanceZ = currentZ - centerZ;
    const remaining = localTunnelCount - currentTunnel;
    const radiusBuffer = baseWidth + 2.0 + 16.0;
    if (distanceX * distanceX + distanceZ * distanceZ - remaining * remaining > radiusBuffer * radiusBuffer) {
      return;
    }

    if (
      currentX < centerX - 16.0 - horizontalRadius * 2.0
      || currentZ < centerZ - 16.0 - horizontalRadius * 2.0
      || currentX > centerX + 16.0 + horizontalRadius * 2.0
      || currentZ > centerZ + 16.0 + horizontalRadius * 2.0
    ) {
      continue;
    }

    let minX = javaFloorToInt(currentX - horizontalRadius) - targetChunkX * CHUNK_SIZE - 1;
    let maxX = javaFloorToInt(currentX + horizontalRadius) - targetChunkX * CHUNK_SIZE + 1;
    let minY = javaFloorToInt(currentY - verticalRadius) - 1;
    let maxY = javaFloorToInt(currentY + verticalRadius) + 1;
    let minZ = javaFloorToInt(currentZ - horizontalRadius) - targetChunkZ * CHUNK_SIZE - 1;
    let maxZ = javaFloorToInt(currentZ + horizontalRadius) - targetChunkZ * CHUNK_SIZE + 1;

    minX = clamp(minX, 0, CHUNK_SIZE);
    maxX = clamp(maxX, 0, CHUNK_SIZE);
    minY = clamp(minY, 1, 120);
    maxY = clamp(maxY, 1, 120);
    minZ = clamp(minZ, 0, CHUNK_SIZE);
    maxZ = clamp(maxZ, 0, CHUNK_SIZE);

    if (intersectsWater(blocks, minX, maxX, minY, maxY, minZ, maxZ)) {
      continue;
    }

    for (let blockX = minX; blockX < maxX; blockX += 1) {
      const normalizedX = ((blockX + targetChunkX * CHUNK_SIZE) + 0.5 - currentX) / horizontalRadius;
      const normalizedXSquared = normalizedX * normalizedX;

      for (let blockZ = minZ; blockZ < maxZ; blockZ += 1) {
        const normalizedZ = ((blockZ + targetChunkZ * CHUNK_SIZE) + 0.5 - currentZ) / horizontalRadius;
        const normalizedZSquared = normalizedZ * normalizedZ;
        let blockIndex = chunkBlockIndex(blockX, maxY, blockZ);
        let foundGrass = false;

        for (let blockY = maxY - 1; blockY >= minY; blockY -= 1) {
          const normalizedY = (blockY + 0.5 - currentY) / verticalRadius;
          if (
            normalizedY > -0.7
            && normalizedXSquared + normalizedY * normalizedY + normalizedZSquared < 1.0
          ) {
            const blockId = blocks[blockIndex];
            if (blockId === BLOCKS.GRASS) {
              foundGrass = true;
            }

            if (blockId === BLOCKS.STONE || blockId === BLOCKS.DIRT || blockId === BLOCKS.GRASS) {
              if (blockY < 10) {
                blocks[blockIndex] = EXTRA_BLOCKS.FLOWING_LAVA;
              } else {
                blocks[blockIndex] = BLOCKS.AIR;
                if (foundGrass && blocks[blockIndex - 1] === BLOCKS.DIRT) {
                  blocks[blockIndex - 1] = BLOCKS.GRASS;
                }
              }
            }
          }

          blockIndex -= 1;
        }
      }
    }

    if (roomTunnel !== 0) {
      break;
    }
  }
}

function carveCavesForSourceChunk(blocks, seed64, mapGenSeeds, targetChunkX, targetChunkZ, range, sourceChunkX, sourceChunkZ) {
  const random = new JavaRandom(
    BigInt.asIntN(
      64,
      (BigInt(sourceChunkX) * mapGenSeeds.xSeed + BigInt(sourceChunkZ) * mapGenSeeds.zSeed) ^ seed64,
    ),
  );

  let caveCount = random.nextInt(random.nextInt(random.nextInt(40) + 1) + 1);
  if (random.nextInt(15) !== 0) {
    caveCount = 0;
  }

  for (let caveIndex = 0; caveIndex < caveCount; caveIndex += 1) {
    const startX = sourceChunkX * CHUNK_SIZE + random.nextInt(CHUNK_SIZE);
    const startY = random.nextInt(random.nextInt(120) + 8);
    const startZ = sourceChunkZ * CHUNK_SIZE + random.nextInt(CHUNK_SIZE);
    let tunnelCount = 1;

    if (random.nextInt(4) === 0) {
      carveTunnelsExact(
        blocks,
        targetChunkX,
        targetChunkZ,
        random,
        startX,
        startY,
        startZ,
        1.0 + random.nextFloat() * 6.0,
        0.0,
        0.0,
        -1,
        -1,
        0.5,
        range,
      );
      tunnelCount += random.nextInt(4);
    }

    for (let tunnelIndex = 0; tunnelIndex < tunnelCount; tunnelIndex += 1) {
      const yaw = random.nextFloat() * Math.PI * 2.0;
      const pitch = (random.nextFloat() - 0.5) * 2.0 / 8.0;
      const width = random.nextFloat() * 2.0 + random.nextFloat();
      carveTunnelsExact(
        blocks,
        targetChunkX,
        targetChunkZ,
        random,
        startX,
        startY,
        startZ,
        width,
        yaw,
        pitch,
        0,
        0,
        1.0,
        range,
      );
    }
  }
}

function createCaveSession(blocks, seed64, mapGenSeeds, chunkX, chunkZ, range) {
  return {
    blocks,
    seed64,
    mapGenSeeds,
    chunkX,
    chunkZ,
    range,
    sourceChunkX: chunkX - range,
    sourceChunkZ: chunkZ - range,
    complete: false,
  };
}

function advanceCaveSession(session, sourceChunkCount = 1) {
  if (session.complete) {
    return false;
  }

  let processed = 0;
  while (processed < sourceChunkCount && !session.complete) {
    carveCavesForSourceChunk(
      session.blocks,
      session.seed64,
      session.mapGenSeeds,
      session.chunkX,
      session.chunkZ,
      session.range,
      session.sourceChunkX,
      session.sourceChunkZ,
    );
    processed += 1;
    session.sourceChunkZ += 1;

    if (session.sourceChunkZ > session.chunkZ + session.range) {
      session.sourceChunkZ = session.chunkZ - session.range;
      session.sourceChunkX += 1;
      if (session.sourceChunkX > session.chunkX + session.range) {
        session.complete = true;
      }
    }
  }

  return processed > 0;
}

function generateReplaceableVein(region, random, sourceBlockId, targetBlockId, size, x, y, z) {
  const angle = random.nextFloat() * Math.PI;
  const startX = x + 8 + Math.sin(angle) * size / 8.0;
  const endX = x + 8 - Math.sin(angle) * size / 8.0;
  const startZ = z + 8 + Math.cos(angle) * size / 8.0;
  const endZ = z + 8 - Math.cos(angle) * size / 8.0;
  const startY = y + random.nextInt(3) + 2;
  const endY = y + random.nextInt(3) + 2;

  for (let step = 0; step <= size; step += 1) {
    const centerX = startX + (endX - startX) * step / size;
    const centerY = startY + (endY - startY) * step / size;
    const centerZ = startZ + (endZ - startZ) * step / size;
    const radiusScale = random.nextDouble() * size / 16.0;
    const radiusXZ = (Math.sin((step * Math.PI) / size) + 1.0) * radiusScale + 1.0;
    const radiusY = radiusXZ;

    for (let blockX = javaTrunc(centerX - radiusXZ / 2.0); blockX <= javaTrunc(centerX + radiusXZ / 2.0); blockX += 1) {
      for (let blockY = javaTrunc(centerY - radiusY / 2.0); blockY <= javaTrunc(centerY + radiusY / 2.0); blockY += 1) {
        for (let blockZ = javaTrunc(centerZ - radiusXZ / 2.0); blockZ <= javaTrunc(centerZ + radiusXZ / 2.0); blockZ += 1) {
          const normalizedX = (blockX + 0.5 - centerX) / (radiusXZ / 2.0);
          const normalizedY = (blockY + 0.5 - centerY) / (radiusY / 2.0);
          const normalizedZ = (blockZ + 0.5 - centerZ) / (radiusXZ / 2.0);
          if (normalizedX * normalizedX + normalizedY * normalizedY + normalizedZ * normalizedZ >= 1.0) {
            continue;
          }

          if (getRegionBlock(region, blockX, blockY, blockZ) === sourceBlockId) {
            setRegionBlock(region, blockX, blockY, blockZ, targetBlockId);
          }
        }
      }
    }
  }
}

function canPlacePlant(region, worldX, worldY, worldZ, blockId) {
  if (getRegionBlock(region, worldX, worldY, worldZ) !== BLOCKS.AIR) {
    return false;
  }

  const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
  if (blockId === EXTRA_BLOCKS.BROWN_MUSHROOM || blockId === EXTRA_BLOCKS.RED_MUSHROOM) {
    return getRegionRawBrightness(region, worldX, worldY, worldZ) <= 13 && blockIsSolid(below);
  }

  if (below !== BLOCKS.GRASS && below !== BLOCKS.DIRT) {
    return false;
  }

  return getRegionRawBrightness(region, worldX, worldY, worldZ) >= 8
    || hasRegionSkyAccess(region, worldX, worldY, worldZ);
}

function placePlantFeature(region, random, baseX, baseY, baseZ, blockId) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const x = baseX + random.nextInt(8) - random.nextInt(8);
    const y = baseY + random.nextInt(4) - random.nextInt(4);
    const z = baseZ + random.nextInt(8) - random.nextInt(8);
    if (y < 1 || y >= CHUNK_HEIGHT) {
      continue;
    }
    if (canPlacePlant(region, x, y, z, blockId)) {
      setRegionBlock(region, x, y, z, blockId);
    }
  }
  return true;
}

function canPlaceReeds(region, worldX, worldY, worldZ) {
  if (getRegionBlock(region, worldX, worldY, worldZ) !== BLOCKS.AIR) {
    return false;
  }

  const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
  if (below === EXTRA_BLOCKS.REEDS) {
    return true;
  }
  if (below !== BLOCKS.GRASS && below !== BLOCKS.DIRT) {
    return false;
  }

  return (
    isWaterBlock(getRegionBlock(region, worldX - 1, worldY - 1, worldZ))
    || isWaterBlock(getRegionBlock(region, worldX + 1, worldY - 1, worldZ))
    || isWaterBlock(getRegionBlock(region, worldX, worldY - 1, worldZ - 1))
    || isWaterBlock(getRegionBlock(region, worldX, worldY - 1, worldZ + 1))
  );
}

function placeSugarCaneFeature(region, random, baseX, baseY, baseZ) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = baseX + random.nextInt(4) - random.nextInt(4);
    const z = baseZ + random.nextInt(4) - random.nextInt(4);
    if (!canPlaceReeds(region, x, baseY, z)) {
      continue;
    }

    const height = 2 + random.nextInt(random.nextInt(3) + 1);
    for (let offsetY = 0; offsetY < height; offsetY += 1) {
      const y = baseY + offsetY;
      if (!canPlaceReeds(region, x, y, z)) {
        break;
      }
      setRegionBlock(region, x, y, z, EXTRA_BLOCKS.REEDS);
    }
  }
  return true;
}

function canPlaceCactus(region, worldX, worldY, worldZ) {
  if (getRegionBlock(region, worldX, worldY, worldZ) !== BLOCKS.AIR) {
    return false;
  }

  if (hasSolidMaterial(getRegionBlock(region, worldX - 1, worldY, worldZ))) {
    return false;
  }
  if (hasSolidMaterial(getRegionBlock(region, worldX + 1, worldY, worldZ))) {
    return false;
  }
  if (hasSolidMaterial(getRegionBlock(region, worldX, worldY, worldZ - 1))) {
    return false;
  }
  if (hasSolidMaterial(getRegionBlock(region, worldX, worldY, worldZ + 1))) {
    return false;
  }

  const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
  return below === EXTRA_BLOCKS.CACTUS || below === BLOCKS.SAND;
}

function placeCactusFeature(region, random, baseX, baseY, baseZ) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const x = baseX + random.nextInt(8) - random.nextInt(8);
    const y = baseY + random.nextInt(4) - random.nextInt(4);
    const z = baseZ + random.nextInt(8) - random.nextInt(8);
    if (y < 1 || y >= CHUNK_HEIGHT || !canPlaceCactus(region, x, y, z)) {
      continue;
    }

    const height = 1 + random.nextInt(random.nextInt(3) + 1);
    for (let offsetY = 0; offsetY < height; offsetY += 1) {
      const currentY = y + offsetY;
      if (!canPlaceCactus(region, x, currentY, z)) {
        break;
      }
      setRegionBlock(region, x, currentY, z, EXTRA_BLOCKS.CACTUS);
    }
  }
  return true;
}

function placeLiquidFall(region, worldX, worldY, worldZ, liquidBlockId) {
  if (getRegionBlock(region, worldX, worldY + 1, worldZ) !== BLOCKS.STONE) {
    return false;
  }
  if (getRegionBlock(region, worldX, worldY - 1, worldZ) !== BLOCKS.STONE) {
    return false;
  }

  const current = getRegionBlock(region, worldX, worldY, worldZ);
  if (current !== BLOCKS.AIR && current !== BLOCKS.STONE) {
    return false;
  }

  let stoneNeighbors = 0;
  let airNeighbors = 0;
  if (getRegionBlock(region, worldX - 1, worldY, worldZ) === BLOCKS.STONE) {
    stoneNeighbors += 1;
  }
  if (getRegionBlock(region, worldX + 1, worldY, worldZ) === BLOCKS.STONE) {
    stoneNeighbors += 1;
  }
  if (getRegionBlock(region, worldX, worldY, worldZ - 1) === BLOCKS.STONE) {
    stoneNeighbors += 1;
  }
  if (getRegionBlock(region, worldX, worldY, worldZ + 1) === BLOCKS.STONE) {
    stoneNeighbors += 1;
  }
  if (getRegionBlock(region, worldX - 1, worldY, worldZ) === BLOCKS.AIR) {
    airNeighbors += 1;
  }
  if (getRegionBlock(region, worldX + 1, worldY, worldZ) === BLOCKS.AIR) {
    airNeighbors += 1;
  }
  if (getRegionBlock(region, worldX, worldY, worldZ - 1) === BLOCKS.AIR) {
    airNeighbors += 1;
  }
  if (getRegionBlock(region, worldX, worldY, worldZ + 1) === BLOCKS.AIR) {
    airNeighbors += 1;
  }

  if (stoneNeighbors === 3 && airNeighbors === 1) {
    setRegionBlock(region, worldX, worldY, worldZ, liquidBlockId);
  }

  return true;
}

class TreeFeatureAlpha {
  place(region, random, x, y, z) {
    const height = random.nextInt(3) + 4;
    let canPlace = true;

    if (y < 1 || y + height + 1 > CHUNK_HEIGHT) {
      return false;
    }

    for (let checkY = y; checkY <= y + 1 + height && canPlace; checkY += 1) {
      let radius = 1;
      if (checkY === y) {
        radius = 0;
      }
      if (checkY >= y + 1 + height - 2) {
        radius = 2;
      }

      for (let checkX = x - radius; checkX <= x + radius && canPlace; checkX += 1) {
        for (let checkZ = z - radius; checkZ <= z + radius && canPlace; checkZ += 1) {
          if (checkY < 0 || checkY >= CHUNK_HEIGHT) {
            canPlace = false;
            break;
          }

          const blockId = getRegionBlock(region, checkX, checkY, checkZ);
          if (blockId !== BLOCKS.AIR && blockId !== EXTRA_BLOCKS.OAK_LEAVES) {
            canPlace = false;
          }
        }
      }
    }

    if (!canPlace) {
      return false;
    }

    const below = getRegionBlock(region, x, y - 1, z);
    if ((below !== BLOCKS.GRASS && below !== BLOCKS.DIRT) || y >= CHUNK_HEIGHT - height - 1) {
      return false;
    }

    setRegionBlock(region, x, y - 1, z, BLOCKS.DIRT);

    for (let leafY = y - 3 + height; leafY <= y + height; leafY += 1) {
      const offsetY = leafY - (y + height);
      const radius = 1 - Math.trunc(offsetY / 2);

      for (let leafX = x - radius; leafX <= x + radius; leafX += 1) {
        const offsetX = leafX - x;
        for (let leafZ = z - radius; leafZ <= z + radius; leafZ += 1) {
          const offsetZ = leafZ - z;
          if (
            (Math.abs(offsetX) !== radius || Math.abs(offsetZ) !== radius || (random.nextInt(2) !== 0 && offsetY !== 0))
            && !blockIsSolid(getRegionBlock(region, leafX, leafY, leafZ))
          ) {
            setRegionBlock(region, leafX, leafY, leafZ, EXTRA_BLOCKS.OAK_LEAVES);
          }
        }
      }
    }

    for (let trunkY = 0; trunkY < height; trunkY += 1) {
      const blockId = getRegionBlock(region, x, y + trunkY, z);
      if (blockId === BLOCKS.AIR || blockId === EXTRA_BLOCKS.OAK_LEAVES) {
        setRegionBlock(region, x, y + trunkY, z, EXTRA_BLOCKS.OAK_LOG);
      }
    }

    return true;
  }
}

const BIG_OAK_MINOR_AXES = [2, 0, 0, 1, 2, 1];

class LargeOakTreeFeatureAlpha {
  constructor() {
    this.random = new JavaRandom(0n);
    this.region = null;
    this.origin = [0, 0, 0];
    this.height = 0;
    this.trunkHeight = 0;
    this.trunkScale = 0.618;
    this.branchDensity = 1.0;
    this.branchSlope = 0.381;
    this.branchLengthScale = 1.0;
    this.foliageDensity = 1.0;
    this.trunkWidth = 1;
    this.maxTrunkHeight = 12;
    this.foliageClusterHeight = 4;
    this.branches = [];
  }

  prepare(scale, branchLengthScale, foliageDensity) {
    this.maxTrunkHeight = Math.trunc(scale * 12.0);
    if (scale > 0.5) {
      this.foliageClusterHeight = 5;
    }
    this.branchLengthScale = branchLengthScale;
    this.foliageDensity = foliageDensity;
  }

  getTreeShape(heightOffset) {
    if (heightOffset < this.height * 0.3) {
      return -1.618;
    }

    const halfHeight = this.height / 2.0;
    const distance = this.height / 2.0 - heightOffset;
    let radius;
    if (distance === 0.0) {
      radius = halfHeight;
    } else if (Math.abs(distance) >= halfHeight) {
      radius = 0.0;
    } else {
      radius = Math.sqrt(Math.abs(halfHeight) ** 2 - Math.abs(distance) ** 2);
    }
    return radius * 0.5;
  }

  getClusterShape(layer) {
    if (layer < 0 || layer >= this.foliageClusterHeight) {
      return -1.0;
    }
    return layer !== 0 && layer !== this.foliageClusterHeight - 1 ? 3.0 : 2.0;
  }

  placeCluster(x, y, z, shape, majorAxis, clusterBlock) {
    const radius = Math.trunc(shape + 0.618);
    const minorAxis = BIG_OAK_MINOR_AXES[majorAxis];
    const otherAxis = BIG_OAK_MINOR_AXES[majorAxis + 3];
    const origin = [x, y, z];
    const point = [0, 0, 0];
    point[majorAxis] = origin[majorAxis];

    for (let offsetMinor = -radius; offsetMinor <= radius; offsetMinor += 1) {
      point[minorAxis] = origin[minorAxis] + offsetMinor;
      for (let offsetOther = -radius; offsetOther <= radius; offsetOther += 1) {
        const distance = Math.sqrt((Math.abs(offsetMinor) + 0.5) ** 2 + (Math.abs(offsetOther) + 0.5) ** 2);
        if (distance > shape) {
          continue;
        }

        point[otherAxis] = origin[otherAxis] + offsetOther;
        const blockId = getRegionBlock(this.region, point[0], point[1], point[2]);
        if (blockId !== BLOCKS.AIR && blockId !== EXTRA_BLOCKS.OAK_LEAVES) {
          continue;
        }
        setRegionBlock(this.region, point[0], point[1], point[2], clusterBlock);
      }
    }
  }

  placeFoliageCluster(x, baseY, z) {
    for (let y = baseY; y < baseY + this.foliageClusterHeight; y += 1) {
      this.placeCluster(x, y, z, this.getClusterShape(y - baseY), 1, EXTRA_BLOCKS.OAK_LEAVES);
    }
  }

  placeBranch(from, to, blockId) {
    const delta = [0, 0, 0];
    let majorAxis = 0;

    for (let axis = 0; axis < 3; axis += 1) {
      delta[axis] = to[axis] - from[axis];
      if (Math.abs(delta[axis]) > Math.abs(delta[majorAxis])) {
        majorAxis = axis;
      }
    }

    if (delta[majorAxis] === 0) {
      return;
    }

    const minorAxis = BIG_OAK_MINOR_AXES[majorAxis];
    const otherAxis = BIG_OAK_MINOR_AXES[majorAxis + 3];
    const step = delta[majorAxis] > 0 ? 1 : -1;
    const slopeMinor = delta[minorAxis] / delta[majorAxis];
    const slopeOther = delta[otherAxis] / delta[majorAxis];
    const point = [0, 0, 0];

    for (let offset = 0, limit = delta[majorAxis] + step; offset !== limit; offset += step) {
      point[majorAxis] = javaFloorToInt(from[majorAxis] + offset + 0.5);
      point[minorAxis] = javaFloorToInt(from[minorAxis] + offset * slopeMinor + 0.5);
      point[otherAxis] = javaFloorToInt(from[otherAxis] + offset * slopeOther + 0.5);
      setRegionBlock(this.region, point[0], point[1], point[2], blockId);
    }
  }

  tryBranch(from, to) {
    const delta = [0, 0, 0];
    let majorAxis = 0;

    for (let axis = 0; axis < 3; axis += 1) {
      delta[axis] = to[axis] - from[axis];
      if (Math.abs(delta[axis]) > Math.abs(delta[majorAxis])) {
        majorAxis = axis;
      }
    }

    if (delta[majorAxis] === 0) {
      return -1;
    }

    const minorAxis = BIG_OAK_MINOR_AXES[majorAxis];
    const otherAxis = BIG_OAK_MINOR_AXES[majorAxis + 3];
    const step = delta[majorAxis] > 0 ? 1 : -1;
    const slopeMinor = delta[minorAxis] / delta[majorAxis];
    const slopeOther = delta[otherAxis] / delta[majorAxis];
    const point = [0, 0, 0];
    let offset = 0;
    const limit = delta[majorAxis] + step;

    for (; offset !== limit; offset += step) {
      point[majorAxis] = from[majorAxis] + offset;
      point[minorAxis] = javaTrunc(from[minorAxis] + offset * slopeMinor);
      point[otherAxis] = javaTrunc(from[otherAxis] + offset * slopeOther);
      const blockId = getRegionBlock(this.region, point[0], point[1], point[2]);
      if (blockId !== BLOCKS.AIR && blockId !== EXTRA_BLOCKS.OAK_LEAVES) {
        break;
      }
    }

    return offset === limit ? -1 : Math.abs(offset);
  }

  canPlace() {
    const base = [this.origin[0], this.origin[1], this.origin[2]];
    const top = [this.origin[0], this.origin[1] + this.height - 1, this.origin[2]];
    const below = getRegionBlock(this.region, this.origin[0], this.origin[1] - 1, this.origin[2]);
    if (below !== BLOCKS.GRASS && below !== BLOCKS.DIRT) {
      return false;
    }

    const branchHeight = this.tryBranch(base, top);
    if (branchHeight === -1) {
      return true;
    }
    if (branchHeight < 6) {
      return false;
    }

    this.height = branchHeight;
    return true;
  }

  makeBranches() {
    this.trunkHeight = Math.trunc(this.height * this.trunkScale);
    if (this.trunkHeight >= this.height) {
      this.trunkHeight = this.height - 1;
    }

    let branchCount = Math.trunc(1.382 + ((this.foliageDensity * this.height) / 13.0) ** 2);
    if (branchCount < 1) {
      branchCount = 1;
    }

    const branches = new Array(branchCount * this.height);
    let clusterY = this.origin[1] + this.height - this.foliageClusterHeight;
    let branchCursor = 1;
    const trunkTopY = this.origin[1] + this.trunkHeight;
    let heightOffset = clusterY - this.origin[1];
    branches[0] = [this.origin[0], clusterY, this.origin[2], trunkTopY];
    clusterY -= 1;

    while (heightOffset >= 0) {
      const treeShape = this.getTreeShape(heightOffset);
      if (treeShape < 0.0) {
        clusterY -= 1;
        heightOffset -= 1;
        continue;
      }

      for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        const branchLength = this.branchLengthScale * (treeShape * (this.random.nextFloat() + 0.328));
        const angle = this.random.nextFloat() * 2.0 * 3.14159;
        const branchX = javaTrunc(branchLength * Math.sin(angle) + this.origin[0] + 0.5);
        const branchZ = javaTrunc(branchLength * Math.cos(angle) + this.origin[2] + 0.5);
        const foliageBase = [branchX, clusterY, branchZ];
        const foliageTop = [branchX, clusterY + this.foliageClusterHeight, branchZ];
        if (this.tryBranch(foliageBase, foliageTop) !== -1) {
          continue;
        }

        const trunkBase = [this.origin[0], this.origin[1], this.origin[2]];
        const distance = Math.sqrt(
          Math.abs(this.origin[0] - foliageBase[0]) ** 2 + Math.abs(this.origin[2] - foliageBase[2]) ** 2,
        );
        const branchDrop = distance * this.branchSlope;
        trunkBase[1] = foliageBase[1] - branchDrop > trunkTopY
          ? trunkTopY
          : javaTrunc(foliageBase[1] - branchDrop);

        if (this.tryBranch(trunkBase, foliageBase) !== -1) {
          continue;
        }

        branches[branchCursor] = [branchX, clusterY, branchZ, trunkBase[1]];
        branchCursor += 1;
      }

      clusterY -= 1;
      heightOffset -= 1;
    }

    this.branches = branches.slice(0, branchCursor);
  }

  placeFoliage() {
    for (const branch of this.branches) {
      this.placeFoliageCluster(branch[0], branch[1], branch[2]);
    }
  }

  shouldPlaceBranch(heightOffset) {
    return !(heightOffset < this.height * 0.2);
  }

  placeTrunk() {
    const from = [this.origin[0], this.origin[1], this.origin[2]];
    const to = [this.origin[0], this.origin[1] + this.trunkHeight, this.origin[2]];
    this.placeBranch(from, to, EXTRA_BLOCKS.OAK_LOG);
  }

  placeBranches() {
    const from = [this.origin[0], this.origin[1], this.origin[2]];
    for (const branch of this.branches) {
      const to = [branch[0], branch[1], branch[2]];
      from[1] = branch[3];
      if (this.shouldPlaceBranch(from[1] - this.origin[1])) {
        this.placeBranch(from, to, EXTRA_BLOCKS.OAK_LOG);
      }
    }
  }

  place(region, random, x, y, z) {
    this.region = region;
    this.random.setSeed(random.nextLong());
    this.origin[0] = x;
    this.origin[1] = y;
    this.origin[2] = z;

    if (this.height === 0) {
      this.height = 5 + this.random.nextInt(this.maxTrunkHeight);
    }

    if (!this.canPlace()) {
      return false;
    }

    this.makeBranches();
    this.placeFoliage();
    this.placeTrunk();
    this.placeBranches();
    return true;
  }
}
function consumeDungeonLootPick(random) {
  const pick = random.nextInt(11);
  if (pick === 0 || pick === 2 || pick === 6) {
    return true;
  }
  if (pick === 1 || pick === 3 || pick === 4 || pick === 5) {
    random.nextInt(4);
    return true;
  }
  if (pick === 7) {
    return random.nextInt(100) === 0;
  }
  if (pick === 8) {
    if (random.nextInt(2) !== 0) {
      return false;
    }
    random.nextInt(4);
    return true;
  }
  if (pick === 9) {
    if (random.nextInt(10) !== 0) {
      return false;
    }
    random.nextInt(2);
    return true;
  }
  return false;
}

function consumeDungeonChestLoot(random) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (consumeDungeonLootPick(random)) {
      random.nextInt(27);
    }
  }
}

function generateDungeon(region, random, x, y, z) {
  const radiusX = random.nextInt(2) + 2;
  const radiusZ = random.nextInt(2) + 2;
  let openings = 0;

  for (let blockX = x - radiusX - 1; blockX <= x + radiusX + 1; blockX += 1) {
    for (let blockY = y - 1; blockY <= y + 4; blockY += 1) {
      for (let blockZ = z - radiusZ - 1; blockZ <= z + radiusZ + 1; blockZ += 1) {
        const solid = hasSolidMaterial(getRegionBlock(region, blockX, blockY, blockZ));
        if ((blockY === y - 1 || blockY === y + 4) && !solid) {
          return false;
        }

        if (
          (blockX === x - radiusX - 1 || blockX === x + radiusX + 1 || blockZ === z - radiusZ - 1 || blockZ === z + radiusZ + 1)
          && blockY === y
          && getRegionBlock(region, blockX, blockY, blockZ) === BLOCKS.AIR
          && getRegionBlock(region, blockX, blockY + 1, blockZ) === BLOCKS.AIR
        ) {
          openings += 1;
        }
      }
    }
  }

  if (openings < 1 || openings > 5) {
    return false;
  }

  for (let blockX = x - radiusX - 1; blockX <= x + radiusX + 1; blockX += 1) {
    for (let blockY = y + 3; blockY >= y - 1; blockY -= 1) {
      for (let blockZ = z - radiusZ - 1; blockZ <= z + radiusZ + 1; blockZ += 1) {
        const boundary = (
          blockX === x - radiusX - 1
          || blockX === x + radiusX + 1
          || blockY === y - 1
          || blockY === y + 4
          || blockZ === z - radiusZ - 1
          || blockZ === z + radiusZ + 1
        );

        if (!boundary) {
          setRegionBlock(region, blockX, blockY, blockZ, BLOCKS.AIR);
          continue;
        }

        if (blockY >= 0 && !hasSolidMaterial(getRegionBlock(region, blockX, blockY - 1, blockZ))) {
          setRegionBlock(region, blockX, blockY, blockZ, BLOCKS.AIR);
          continue;
        }

        if (!hasSolidMaterial(getRegionBlock(region, blockX, blockY, blockZ))) {
          continue;
        }

        if (blockY === y - 1 && random.nextInt(4) !== 0) {
          setRegionBlock(region, blockX, blockY, blockZ, EXTRA_BLOCKS.MOSSY_COBBLESTONE);
        } else {
          setRegionBlock(region, blockX, blockY, blockZ, EXTRA_BLOCKS.COBBLESTONE);
        }
      }
    }
  }

  for (let chestAttempt = 0; chestAttempt < 2; chestAttempt += 1) {
    for (let tryIndex = 0; tryIndex < 3; tryIndex += 1) {
      const chestX = x + random.nextInt(radiusX * 2 + 1) - radiusX;
      const chestZ = z + random.nextInt(radiusZ * 2 + 1) - radiusZ;
      if (getRegionBlock(region, chestX, y, chestZ) !== BLOCKS.AIR) {
        continue;
      }

      let solidNeighbors = 0;
      if (hasSolidMaterial(getRegionBlock(region, chestX - 1, y, chestZ))) {
        solidNeighbors += 1;
      }
      if (hasSolidMaterial(getRegionBlock(region, chestX + 1, y, chestZ))) {
        solidNeighbors += 1;
      }
      if (hasSolidMaterial(getRegionBlock(region, chestX, y, chestZ - 1))) {
        solidNeighbors += 1;
      }
      if (hasSolidMaterial(getRegionBlock(region, chestX, y, chestZ + 1))) {
        solidNeighbors += 1;
      }

      if (solidNeighbors === 1) {
        setRegionBlock(region, chestX, y, chestZ, EXTRA_BLOCKS.CHEST);
        consumeDungeonChestLoot(random);
        break;
      }
    }
  }

  setRegionBlock(region, x, y, z, EXTRA_BLOCKS.MOB_SPAWNER);
  random.nextInt(4);
  return true;
}

function placeSnowColumns(region, sourceChunkX, sourceChunkZ, startX = 0, columnCount = CHUNK_SIZE) {
  const endX = Math.min(CHUNK_SIZE, startX + columnCount);
  const baseX = sourceChunkX * CHUNK_SIZE + 8;
  const baseZ = sourceChunkZ * CHUNK_SIZE + 8;

  for (let localX = startX; localX < endX; localX += 1) {
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      const worldX = baseX + localX;
      const worldZ = baseZ + localZ;
      const surfaceY = getRegionSurfaceHeight(region, worldX, worldZ);
      if (surfaceY <= 0 || surfaceY >= CHUNK_HEIGHT) {
        continue;
      }
      if (getRegionBlock(region, worldX, surfaceY, worldZ) !== BLOCKS.AIR) {
        continue;
      }
      const below = getRegionBlock(region, worldX, surfaceY - 1, worldZ);
      if (below === BLOCKS.ICE || !blocksMovement(below)) {
        continue;
      }
      setRegionBlock(region, worldX, surfaceY, worldZ, EXTRA_BLOCKS.SNOW_LAYER);
    }
  }
}

function createDungeonSession(region, random, chunkX, chunkZ) {
  return { region, random, chunkX, chunkZ, attempt: 0, complete: false };
}

function advanceDungeonSession(session, maxAttempts = 1) {
  if (session.complete) {
    return false;
  }

  let processed = 0;
  while (processed < maxAttempts && session.attempt < 8) {
    generateDungeon(
      session.region,
      session.random,
      session.chunkX * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8,
      session.random.nextInt(CHUNK_HEIGHT),
      session.chunkZ * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8,
    );
    session.attempt += 1;
    processed += 1;
  }

  session.complete = session.attempt >= 8;
  return processed > 0;
}

function createClaySession(region, random, chunkX, chunkZ) {
  return { region, random, chunkX, chunkZ, attempt: 0, complete: false };
}

function advanceClaySession(session, maxAttempts = 1) {
  if (session.complete) {
    return false;
  }

  let processed = 0;
  while (processed < maxAttempts && session.attempt < 10) {
    const x = session.chunkX * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE);
    const y = session.random.nextInt(CHUNK_HEIGHT);
    const z = session.chunkZ * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE);
    if (isWaterBlock(getRegionBlock(session.region, x, y, z))) {
      generateReplaceableVein(session.region, session.random, BLOCKS.SAND, EXTRA_BLOCKS.CLAY, 32, x, y, z);
    }
    session.attempt += 1;
    processed += 1;
  }

  session.complete = session.attempt >= 10;
  return processed > 0;
}

function createOreSession(region, random, chunkX, chunkZ) {
  return { region, random, chunkX, chunkZ, configIndex: 0, attempt: 0, complete: false };
}

function advanceOreSession(session, maxAttempts = 1) {
  if (session.complete) {
    return false;
  }

  let processed = 0;
  while (processed < maxAttempts && session.configIndex < ORE_CONFIG.length) {
    const config = ORE_CONFIG[session.configIndex];
    const x = session.chunkX * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE);
    const y = session.random.nextInt(config.maxY);
    const z = session.chunkZ * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE);
    generateReplaceableVein(session.region, session.random, BLOCKS.STONE, config.blockId, config.size, x, y, z);

    session.attempt += 1;
    processed += 1;
    if (session.attempt >= config.attempts) {
      session.configIndex += 1;
      session.attempt = 0;
    }
  }

  session.complete = session.configIndex >= ORE_CONFIG.length;
  return processed > 0;
}

function createTreeSession(region, random, forestNoise, chunkX, chunkZ) {
  return {
    region,
    random,
    forestNoise,
    chunkX,
    chunkZ,
    treeCount: null,
    feature: null,
    attempt: 0,
    complete: false,
  };
}

function advanceTreeSession(session, maxAttempts = 1) {
  if (session.complete) {
    return false;
  }

  if (session.treeCount === null) {
    let treeCount = javaTrunc((
      session.forestNoise.getValue(session.chunkX * CHUNK_SIZE * 0.5, session.chunkZ * CHUNK_SIZE * 0.5) / 8.0
      + session.random.nextDouble() * 4.0
      + 4.0
    ) / 3.0);
    if (treeCount < 0) {
      treeCount = 0;
    }
    if (session.random.nextInt(10) === 0) {
      treeCount += 1;
    }
    session.treeCount = treeCount;
    session.feature = session.random.nextInt(10) === 0
      ? new LargeOakTreeFeatureAlpha()
      : new TreeFeatureAlpha();
  }

  let processed = 0;
  while (processed < maxAttempts && session.attempt < session.treeCount) {
    const x = session.chunkX * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8;
    const z = session.chunkZ * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8;
    const y = getRegionHeight(session.region, x, z);
    session.feature.prepare?.(1.0, 1.0, 1.0);
    session.feature.place(session.region, session.random, x, y, z);
    session.attempt += 1;
    processed += 1;
  }

  session.complete = session.attempt >= session.treeCount;
  return processed > 0 || session.treeCount === 0;
}

function createFloraSession(region, random, chunkX, chunkZ) {
  return {
    region,
    random,
    chunkX,
    chunkZ,
    stage: "yellow_flower",
    attempt: 0,
    complete: false,
  };
}

function nextFeatureX(random, chunkX) {
  return chunkX * CHUNK_SIZE + random.nextInt(CHUNK_SIZE) + 8;
}

function nextFeatureZ(random, chunkZ) {
  return chunkZ * CHUNK_SIZE + random.nextInt(CHUNK_SIZE) + 8;
}

function nextFeatureY(random) {
  return random.nextInt(CHUNK_HEIGHT);
}
function advanceFloraSession(session) {
  if (session.complete) {
    return false;
  }

  switch (session.stage) {
    case "yellow_flower":
      if (session.attempt < 2) {
        placePlantFeature(
          session.region,
          session.random,
          nextFeatureX(session.random, session.chunkX),
          nextFeatureY(session.random),
          nextFeatureZ(session.random, session.chunkZ),
          EXTRA_BLOCKS.YELLOW_FLOWER,
        );
        session.attempt += 1;
        return true;
      }
      session.stage = "red_flower";
      session.attempt = 0;
      return true;

    case "red_flower":
      if (session.random.nextInt(2) === 0) {
        placePlantFeature(
          session.region,
          session.random,
          nextFeatureX(session.random, session.chunkX),
          nextFeatureY(session.random),
          nextFeatureZ(session.random, session.chunkZ),
          EXTRA_BLOCKS.RED_FLOWER,
        );
      }
      session.stage = "brown_mushroom";
      return true;

    case "brown_mushroom":
      if (session.random.nextInt(4) === 0) {
        placePlantFeature(
          session.region,
          session.random,
          nextFeatureX(session.random, session.chunkX),
          nextFeatureY(session.random),
          nextFeatureZ(session.random, session.chunkZ),
          EXTRA_BLOCKS.BROWN_MUSHROOM,
        );
      }
      session.stage = "red_mushroom";
      return true;

    case "red_mushroom":
      if (session.random.nextInt(8) === 0) {
        placePlantFeature(
          session.region,
          session.random,
          nextFeatureX(session.random, session.chunkX),
          nextFeatureY(session.random),
          nextFeatureZ(session.random, session.chunkZ),
          EXTRA_BLOCKS.RED_MUSHROOM,
        );
      }
      session.stage = "sugar_cane";
      session.attempt = 0;
      return true;

    case "sugar_cane":
      if (session.attempt < 10) {
        placeSugarCaneFeature(
          session.region,
          session.random,
          nextFeatureX(session.random, session.chunkX),
          nextFeatureY(session.random),
          nextFeatureZ(session.random, session.chunkZ),
        );
        session.attempt += 1;
        return true;
      }
      session.stage = "cactus";
      session.attempt = 0;
      return true;

    case "cactus":
      if (session.attempt < 1) {
        placeCactusFeature(
          session.region,
          session.random,
          nextFeatureX(session.random, session.chunkX),
          nextFeatureY(session.random),
          nextFeatureZ(session.random, session.chunkZ),
        );
        session.attempt += 1;
        return true;
      }
      session.complete = true;
      session.stage = "complete";
      return true;

    default:
      session.complete = true;
      return false;
  }
}

function createSpringSession(region, random, chunkX, chunkZ) {
  return { region, random, chunkX, chunkZ, waterAttempt: 0, lavaAttempt: 0, complete: false };
}

function advanceSpringSession(session, maxAttempts = 1) {
  if (session.complete) {
    return false;
  }

  let processed = 0;
  while (processed < maxAttempts) {
    if (session.waterAttempt < 50) {
      placeLiquidFall(
        session.region,
        session.chunkX * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8,
        session.random.nextInt(session.random.nextInt(120) + 8),
        session.chunkZ * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8,
        EXTRA_BLOCKS.FLOWING_WATER,
      );
      session.waterAttempt += 1;
      processed += 1;
      continue;
    }

    if (session.lavaAttempt < 20) {
      placeLiquidFall(
        session.region,
        session.chunkX * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8,
        session.random.nextInt(session.random.nextInt(session.random.nextInt(112) + 8) + 8),
        session.chunkZ * CHUNK_SIZE + session.random.nextInt(CHUNK_SIZE) + 8,
        EXTRA_BLOCKS.FLOWING_LAVA,
      );
      session.lavaAttempt += 1;
      processed += 1;
      continue;
    }

    session.complete = true;
    break;
  }

  session.complete = session.complete || (session.waterAttempt >= 50 && session.lavaAttempt >= 20);
  return processed > 0;
}

function createSnowSession(region, chunkX, chunkZ) {
  return { region, chunkX, chunkZ, localX: 0, complete: false };
}

function advanceSnowSession(session, columnCount = 1) {
  if (session.complete) {
    return false;
  }
  placeSnowColumns(session.region, session.chunkX, session.chunkZ, session.localX, columnCount);
  session.localX = Math.min(CHUNK_SIZE, session.localX + columnCount);
  session.complete = session.localX >= CHUNK_SIZE;
  return true;
}

function copyChunkBlockColumns(sourceBlocks, targetBlocks, startX = 0, columnCount = CHUNK_SIZE) {
  const endX = Math.min(CHUNK_SIZE, startX + columnCount);
  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const index = chunkBlockIndex(x, 0, z);
      targetBlocks.set(sourceBlocks.subarray(index, index + CHUNK_HEIGHT), index);
    }
  }
  return endX;
}

function getPopulationRegionSourceChunk(chunkX, chunkZ, copyCursor) {
  return {
    x: chunkX - 1 + Math.floor(copyCursor / 3),
    z: chunkZ - 1 + (copyCursor % 3),
  };
}

function getPopulationFeatureSourceChunk(chunkX, chunkZ, sourceCursor) {
  return {
    x: chunkX + POPULATION_SOURCE_MIN_OFFSET + Math.floor(sourceCursor / 2),
    z: chunkZ + POPULATION_SOURCE_MIN_OFFSET + (sourceCursor % 2),
  };
}
export class Alpha1016BedrockGenerator {
  constructor(seed, options = {}) {
    this.seed = seed;
    this.seed64 = toJavaLong(seed);
    this.options = {
      caves: options.caves ?? true,
      dungeons: options.dungeons ?? true,
      clay: options.clay ?? true,
      ores: options.ores ?? true,
      trees: options.trees ?? true,
      flora: options.flora ?? true,
      springs: options.springs ?? true,
      snow: options.snow ?? true,
      snowCovered: options.snowCovered ?? false,
      caveRange: options.caveRange ?? DEFAULT_CAVE_RANGE,
      farlandsCoordinate: options.farlandsCoordinate ?? DEFAULT_FARLANDS_COORDINATE,
      surfacePalette: options.surfacePalette ?? null,
    };

    this.mapGenSeeds = getMapGenSeeds(this.seed64);
    this.regionProfile = resolveRegionProfile(this.seed64, this.mapGenSeeds);
    this.terrainChunkCache = new Map();
    this.terrainScratchRegion = new Uint16Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * CHUNK_HEIGHT);

    this.applyRuntimeConfig();
    const random = new JavaRandom(this.seed64);
    this.minLimitPerlinNoise = new PerlinNoiseAlpha(random, 16);
    this.maxLimitPerlinNoise = new PerlinNoiseAlpha(random, 16);
    this.perlinNoise1 = new PerlinNoiseAlpha(random, 8);
    this.perlinNoise2 = new PerlinNoiseAlpha(random, 4);
    this.perlinNoise3 = new PerlinNoiseAlpha(random, 4);
    this.scaleNoise = new PerlinNoiseAlpha(random, 10);
    this.depthNoise = new PerlinNoiseAlpha(random, 16);
    this.forestNoise = new PerlinNoiseAlpha(random, 8);

    const surface = this.options.surfacePalette?.[0] ?? { top: BLOCKS.GRASS, fill: BLOCKS.DIRT };
    this.surfaceTopBlock = surface.top ?? BLOCKS.GRASS;
    this.surfaceFillBlock = surface.fill ?? BLOCKS.DIRT;

    this.heightMapBuffer = null;
    this.sandBuffer = new Float64Array(CHUNK_SIZE * CHUNK_SIZE);
    this.gravelBuffer = new Float64Array(CHUNK_SIZE * CHUNK_SIZE);
    this.depthBuffer = new Float64Array(CHUNK_SIZE * CHUNK_SIZE);
    this.perlinNoiseBuffer = null;
    this.minLimitPerlinNoiseBuffer = null;
    this.maxLimitPerlinNoiseBuffer = null;
    this.scaleNoiseBuffer = null;
    this.depthNoiseBuffer = null;

    this.hasPopulationFeatures = (
      this.options.dungeons
      || this.options.clay
      || this.options.ores
      || this.options.trees
      || this.options.flora
      || this.options.springs
      || (this.options.snow && this.options.snowCovered)
      || this.regionProfile !== null
    );
  }

  applyRuntimeConfig() {
    setNoiseFarlandsCoordinate(this.options.farlandsCoordinate);
  }

  getCachedValue(cache, key, factory) {
    if (cache.has(key)) {
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const value = factory();
    this.putCachedValue(cache, key, value);
    return value;
  }

  putCachedValue(cache, key, value) {
    if (cache.has(key)) {
      cache.delete(key);
    } else if (cache.size >= TERRAIN_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    cache.set(key, value);
    return value;
  }

  peekCachedValue(cache, key) {
    if (!cache.has(key)) {
      return null;
    }
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }

  generateHeightMap(heightMap, x, y, z, sizeX, sizeY, sizeZ) {
    const requiredSize = sizeX * sizeY * sizeZ;
    let output = heightMap;
    if (!output || output.length < requiredSize) {
      output = new Float64Array(requiredSize);
    }

    const d = 684.412;
    const e = 684.412;
    this.scaleNoiseBuffer = this.scaleNoise.getRegion(this.scaleNoiseBuffer, x, y, z, sizeX, 1, sizeZ, 1.0, 0.0, 1.0);
    this.depthNoiseBuffer = this.depthNoise.getRegion(this.depthNoiseBuffer, x, y, z, sizeX, 1, sizeZ, 100.0, 0.0, 100.0);
    this.perlinNoiseBuffer = this.perlinNoise1.getRegion(this.perlinNoiseBuffer, x, y, z, sizeX, sizeY, sizeZ, d / 80.0, e / 160.0, d / 80.0);
    this.minLimitPerlinNoiseBuffer = this.minLimitPerlinNoise.getRegion(this.minLimitPerlinNoiseBuffer, x, y, z, sizeX, sizeY, sizeZ, d, e, d);
    this.maxLimitPerlinNoiseBuffer = this.maxLimitPerlinNoise.getRegion(this.maxLimitPerlinNoiseBuffer, x, y, z, sizeX, sizeY, sizeZ, d, e, d);

    let densityIndex = 0;
    let noiseIndex = 0;
    for (let localX = 0; localX < sizeX; localX += 1) {
      for (let localZ = 0; localZ < sizeZ; localZ += 1) {
        let scale = (this.scaleNoiseBuffer[noiseIndex] + 256.0) / 512.0;
        if (scale > 1.0) {
          scale = 1.0;
        }

        let minHeight = 0.0;
        let depth = this.depthNoiseBuffer[noiseIndex] / 8000.0;
        if (depth < 0.0) {
          depth = -depth;
        }
        depth = depth * 3.0 - 3.0;
        if (depth < 0.0) {
          depth /= 2.0;
          if (depth < -1.0) {
            depth = -1.0;
          }
          depth /= 1.4;
          depth /= 2.0;
          scale = 0.0;
        } else {
          if (depth > 1.0) {
            depth = 1.0;
          }
          depth /= 6.0;
        }

        scale += 0.5;
        depth = depth * sizeY / 16.0;
        const heightOffset = sizeY / 2.0 + depth * 4.0;
        noiseIndex += 1;

        for (let localY = 0; localY < sizeY; localY += 1) {
          let density;
          let heightDelta = (localY - heightOffset) * 12.0 / scale;
          if (heightDelta < 0.0) {
            heightDelta *= 4.0;
          }

          const minLimit = this.minLimitPerlinNoiseBuffer[densityIndex] / 512.0;
          const maxLimit = this.maxLimitPerlinNoiseBuffer[densityIndex] / 512.0;
          const blend = (this.perlinNoiseBuffer[densityIndex] / 10.0 + 1.0) / 2.0;
          if (blend < 0.0) {
            density = minLimit;
          } else if (blend > 1.0) {
            density = maxLimit;
          } else {
            density = minLimit + (maxLimit - minLimit) * blend;
          }

          density -= heightDelta;
          if (localY > sizeY - 4) {
            const falloff = (localY - (sizeY - 4)) / 3.0;
            density = density * (1.0 - falloff) - 10.0 * falloff;
          }

          if (localY < minHeight) {
            let lowerFalloff = (minHeight - localY) / 4.0;
            if (lowerFalloff < 0.0) {
              lowerFalloff = 0.0;
            }
            if (lowerFalloff > 1.0) {
              lowerFalloff = 1.0;
            }
            density = density * (1.0 - lowerFalloff) - 10.0 * lowerFalloff;
          }

          output[densityIndex] = density;
          densityIndex += 1;
        }
      }
    }

    return output;
  }

  getTerrainChunk(chunkX, chunkZ) {
    this.applyRuntimeConfig();
    const key = `${chunkX}|${chunkZ}`;
    return this.getCachedValue(this.terrainChunkCache, key, () => {
      const session = this.createBackgroundTerrainSession(chunkX, chunkZ);
      while (!session.complete) {
        this.advanceBackgroundTerrainSession(session);
      }
      return session.terrainChunk;
    });
  }

  peekTerrainChunk(chunkX, chunkZ) {
    return this.peekCachedValue(this.terrainChunkCache, `${chunkX}|${chunkZ}`);
  }

  createBackgroundTerrainSession(chunkX, chunkZ) {
    const cached = this.peekTerrainChunk(chunkX, chunkZ);
    if (cached) {
      return {
        chunkX,
        chunkZ,
        terrainChunk: cached,
        complete: true,
        phase: "complete",
      };
    }

    return {
      chunkX,
      chunkZ,
      densityField: null,
      blocks: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
      baseTerrainCellX: 0,
      surfaceRandom: null,
      surfaceX: 0,
      caveSession: null,
      heightmap: new Int16Array(CHUNK_SIZE * CHUNK_SIZE),
      heightmapX: 0,
      terrainChunk: null,
      complete: false,
      phase: "density",
    };
  }

  advanceBackgroundTerrainSession(session) {
    if (session.complete) {
      return false;
    }

    switch (session.phase) {
      case "density":
        session.densityField = this.generateHeightMap(
          this.heightMapBuffer,
          session.chunkX * 4,
          0,
          session.chunkZ * 4,
          DENSITY_FIELD_X,
          DENSITY_FIELD_Y,
          DENSITY_FIELD_Z,
        );
        this.heightMapBuffer = session.densityField;
        session.phase = "base_terrain";
        return true;

      case "base_terrain":
        generateBaseTerrainCellColumns(
          session.blocks,
          session.densityField,
          this.options.snowCovered,
          session.baseTerrainCellX,
          BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP,
        );
        session.baseTerrainCellX += BACKGROUND_BASE_TERRAIN_CELL_COLUMNS_PER_STEP;
        if (session.baseTerrainCellX >= 4) {
          session.phase = "surface_setup";
        }
        return true;

      case "surface_setup":
        session.surfaceRandom = new JavaRandom(createChunkSeed(session.chunkX, session.chunkZ));
        this.sandBuffer = this.perlinNoise2.getRegion(this.sandBuffer, session.chunkX * CHUNK_SIZE, session.chunkZ * CHUNK_SIZE, 0.0, CHUNK_SIZE, CHUNK_SIZE, 1, 0.03125, 0.03125, 1.0);
        this.gravelBuffer = this.perlinNoise2.getRegion(this.gravelBuffer, session.chunkZ * CHUNK_SIZE, 109.0134, session.chunkX * CHUNK_SIZE, CHUNK_SIZE, 1, CHUNK_SIZE, 0.03125, 1.0, 0.03125);
        this.depthBuffer = this.perlinNoise3.getRegion(this.depthBuffer, session.chunkX * CHUNK_SIZE, session.chunkZ * CHUNK_SIZE, 0.0, CHUNK_SIZE, CHUNK_SIZE, 1, 0.0625, 0.0625, 0.0625);
        session.phase = "surface";
        return true;

      case "surface":
        applySurfaceColumns(
          session.blocks,
          session.surfaceRandom,
          this.surfaceTopBlock,
          this.surfaceFillBlock,
          this.sandBuffer,
          this.gravelBuffer,
          this.depthBuffer,
          session.surfaceX,
          BACKGROUND_SURFACE_COLUMNS_PER_STEP,
        );
        session.surfaceX += BACKGROUND_SURFACE_COLUMNS_PER_STEP;
        if (session.surfaceX >= CHUNK_SIZE) {
          if (this.options.caves) {
            session.caveSession = createCaveSession(
              session.blocks,
              this.seed64,
              this.mapGenSeeds,
              session.chunkX,
              session.chunkZ,
              this.options.caveRange,
            );
            session.phase = "caves";
          } else {
            session.phase = "heightmap";
          }
        }
        return true;

      case "caves":
        if (!advanceCaveSession(session.caveSession, BACKGROUND_CAVE_SOURCE_CHUNKS_PER_STEP)) {
          return false;
        }
        if (session.caveSession.complete) {
          session.phase = "heightmap";
        }
        return true;

      case "heightmap":
        buildHeightmapColumns(session.blocks, session.heightmap, session.heightmapX, BACKGROUND_HEIGHTMAP_COLUMNS_PER_STEP);
        session.heightmapX += BACKGROUND_HEIGHTMAP_COLUMNS_PER_STEP;
        if (session.heightmapX >= CHUNK_SIZE) {
          session.terrainChunk = this.putCachedValue(this.terrainChunkCache, `${session.chunkX}|${session.chunkZ}`, {
            chunkX: session.chunkX,
            chunkZ: session.chunkZ,
            densityField: session.densityField.slice(),
            blocks: session.blocks,
            heightmap: session.heightmap,
            terrainHeightmap: session.heightmap,
          });
          session.complete = true;
          session.phase = "complete";
        }
        return true;

      default:
        return false;
    }
  }
  startBackgroundDecorationStage(session) {
    const sourceChunk = getPopulationFeatureSourceChunk(session.terrainChunk.chunkX, session.terrainChunk.chunkZ, session.sourceCursor);
    const stageKey = BACKGROUND_DECORATION_STAGE_KEYS[session.stageIndex];

    switch (stageKey) {
      case "dungeons":
        if (!this.options.dungeons) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createDungeonSession(session.region, session.populationRandom, sourceChunk.x, sourceChunk.z);
        return "session";

      case "clay":
        if (!this.options.clay) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createClaySession(session.region, session.populationRandom, sourceChunk.x, sourceChunk.z);
        return "session";

      case "ores":
        if (!this.options.ores) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createOreSession(session.region, session.populationRandom, sourceChunk.x, sourceChunk.z);
        return "session";

      case "trees":
        if (!this.options.trees) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createTreeSession(session.region, session.populationRandom, this.forestNoise, sourceChunk.x, sourceChunk.z);
        return "session";

      case "flora":
        if (!this.options.flora) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createFloraSession(session.region, session.populationRandom, sourceChunk.x, sourceChunk.z);
        return "session";

      case "springs":
        if (!this.options.springs) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createSpringSession(session.region, session.populationRandom, sourceChunk.x, sourceChunk.z);
        return "session";

      case "snow":
        if (!this.options.snow || !this.options.snowCovered) {
          return "skip";
        }
        session.currentStage = stageKey;
        session.currentFeatureSession = createSnowSession(session.region, sourceChunk.x, sourceChunk.z);
        return "session";

      default:
        return "skip";
    }
  }

  advanceBackgroundDecorationStageSession(session) {
    switch (session.currentStage) {
      case "dungeons":
        return advanceDungeonSession(session.currentFeatureSession);
      case "clay":
        return advanceClaySession(session.currentFeatureSession);
      case "ores":
        return advanceOreSession(session.currentFeatureSession);
      case "trees":
        return advanceTreeSession(session.currentFeatureSession);
      case "flora":
        return advanceFloraSession(session.currentFeatureSession);
      case "springs":
        return advanceSpringSession(session.currentFeatureSession);
      case "snow":
        return advanceSnowSession(session.currentFeatureSession);
      default:
        return false;
    }
  }

  advanceBackgroundDecorationSource(session) {
    session.stageIndex += 1;
    session.currentStage = "";
    session.currentFeatureSession = null;
    if (session.stageIndex >= BACKGROUND_DECORATION_STAGE_KEYS.length) {
      session.stageIndex = 0;
      session.sourceCursor += 1;
      session.populationRandom = null;
      if (session.sourceCursor >= 4) {
        session.phase = "extract";
      }
    }
  }

  createBackgroundDecorationSession(terrainChunk) {
    if (!this.hasPopulationFeatures) {
      return {
        terrainChunk,
        decoratedBlocks: terrainChunk.blocks,
        complete: true,
        phase: "complete",
      };
    }

    return {
      terrainChunk,
      region: createPopulationRegionShell(terrainChunk.chunkX, terrainChunk.chunkZ, new Uint16Array(POPULATION_REGION_SIZE * POPULATION_REGION_SIZE * CHUNK_HEIGHT)),
      copyCursor: 0,
      dependencyTerrainSession: null,
      sourceCursor: 0,
      stageIndex: 0,
      currentStage: "",
      currentFeatureSession: null,
      populationRandom: null,
      decoratedBlocks: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
      extractX: 0,
      overlayApplied: false,
      phase: "copy",
      complete: false,
    };
  }

  advanceBackgroundDecorationSession(session) {
    if (session.complete) {
      return false;
    }

    if (session.phase === "copy") {
      let processed = 0;
      while (processed < BACKGROUND_REGION_COPY_CHUNKS_PER_STEP && session.copyCursor < 9) {
        const sourceChunk = getPopulationRegionSourceChunk(session.terrainChunk.chunkX, session.terrainChunk.chunkZ, session.copyCursor);

        if (sourceChunk.x === session.terrainChunk.chunkX && sourceChunk.z === session.terrainChunk.chunkZ) {
          copyChunkIntoPopulationRegion(session.region, sourceChunk.x, sourceChunk.z, session.terrainChunk.blocks);
          session.copyCursor += 1;
          processed += 1;
          continue;
        }

        if (!session.dependencyTerrainSession) {
          const cached = this.peekTerrainChunk(sourceChunk.x, sourceChunk.z);
          if (cached) {
            copyChunkIntoPopulationRegion(session.region, sourceChunk.x, sourceChunk.z, cached.blocks);
            session.copyCursor += 1;
            processed += 1;
            continue;
          }
          session.dependencyTerrainSession = this.createBackgroundTerrainSession(sourceChunk.x, sourceChunk.z);
          return true;
        }

        if (!session.dependencyTerrainSession.complete) {
          return this.advanceBackgroundTerrainSession(session.dependencyTerrainSession);
        }

        copyChunkIntoPopulationRegion(
          session.region,
          sourceChunk.x,
          sourceChunk.z,
          session.dependencyTerrainSession.terrainChunk.blocks,
        );
        session.dependencyTerrainSession = null;
        session.copyCursor += 1;
        processed += 1;
      }

      if (session.copyCursor >= 9) {
        session.phase = "features";
      }
      return processed > 0;
    }

    if (session.phase === "features") {
      if (session.sourceCursor >= 4) {
        if (!session.overlayApplied) {
          applyRegionProfileToPopulationRegion(session.region, this.regionProfile);
          session.overlayApplied = true;
        }
        session.phase = "extract";
        return true;
      }

      if (!session.populationRandom) {
        const sourceChunk = getPopulationFeatureSourceChunk(session.terrainChunk.chunkX, session.terrainChunk.chunkZ, session.sourceCursor);
        session.populationRandom = getPopulationRandom(this.seed64, this.mapGenSeeds, sourceChunk.x, sourceChunk.z);
        return true;
      }

      if (!session.currentFeatureSession) {
        while (session.phase === "features" && session.sourceCursor < 4) {
          if (!session.populationRandom) {
            return true;
          }

          const startResult = this.startBackgroundDecorationStage(session);
          if (startResult === "skip") {
            this.advanceBackgroundDecorationSource(session);
            continue;
          }
          if (startResult === "session") {
            break;
          }
        }
      }

      const progressed = this.advanceBackgroundDecorationStageSession(session);
      if (session.currentFeatureSession?.complete) {
        this.advanceBackgroundDecorationSource(session);
      }
      return progressed;
    }

    if (session.phase === "extract") {
      if (!session.overlayApplied) {
        applyRegionProfileToPopulationRegion(session.region, this.regionProfile);
        session.overlayApplied = true;
      }

      extractCenterChunkColumns(
        session.region,
        session.terrainChunk.chunkX,
        session.terrainChunk.chunkZ,
        session.decoratedBlocks,
        session.extractX,
        BACKGROUND_REGION_EXTRACT_COLUMNS_PER_STEP,
      );
      session.extractX += BACKGROUND_REGION_EXTRACT_COLUMNS_PER_STEP;
      if (session.extractX >= CHUNK_SIZE) {
        session.complete = true;
        session.phase = "complete";
      }
      return true;
    }

    return false;
  }

  generateTerrainChunk(chunkX, chunkZ) {
    return this.getTerrainChunk(chunkX, chunkZ);
  }

  decorateTerrainChunk(terrainChunk, options = {}) {
    if (!this.hasPopulationFeatures) {
      return terrainChunk;
    }

    const region = createPopulationRegion(
      (sourceChunkX, sourceChunkZ) => this.getTerrainChunk(sourceChunkX, sourceChunkZ),
      terrainChunk.chunkX,
      terrainChunk.chunkZ,
      terrainChunk.blocks,
      this.terrainScratchRegion,
    );

    for (let sourceChunkX = terrainChunk.chunkX - 1; sourceChunkX <= terrainChunk.chunkX; sourceChunkX += 1) {
      for (let sourceChunkZ = terrainChunk.chunkZ - 1; sourceChunkZ <= terrainChunk.chunkZ; sourceChunkZ += 1) {
        const random = getPopulationRandom(this.seed64, this.mapGenSeeds, sourceChunkX, sourceChunkZ);

        if (this.options.dungeons) {
          const dungeonSession = createDungeonSession(region, random, sourceChunkX, sourceChunkZ);
          while (advanceDungeonSession(dungeonSession)) {
          }
        }
        if (this.options.clay) {
          const claySession = createClaySession(region, random, sourceChunkX, sourceChunkZ);
          while (advanceClaySession(claySession)) {
          }
        }
        if (this.options.ores) {
          const oreSession = createOreSession(region, random, sourceChunkX, sourceChunkZ);
          while (advanceOreSession(oreSession)) {
          }
        }
        if (this.options.trees) {
          const treeSession = createTreeSession(region, random, this.forestNoise, sourceChunkX, sourceChunkZ);
          while (advanceTreeSession(treeSession)) {
          }
        }
        if (this.options.flora) {
          const floraSession = createFloraSession(region, random, sourceChunkX, sourceChunkZ);
          while (advanceFloraSession(floraSession)) {
          }
        }
        if (this.options.springs) {
          const springSession = createSpringSession(region, random, sourceChunkX, sourceChunkZ);
          while (advanceSpringSession(springSession)) {
          }
        }
        if (this.options.snow && this.options.snowCovered) {
          const snowSession = createSnowSession(region, sourceChunkX, sourceChunkZ);
          while (advanceSnowSession(snowSession)) {
          }
        }
      }
    }

    applyRegionProfileToPopulationRegion(region, this.regionProfile);
    const decoratedBlocks = extractCenterChunkFromRegion(region, terrainChunk.chunkX, terrainChunk.chunkZ);
    return {
      ...terrainChunk,
      blocks: decoratedBlocks,
      heightmap: options.rebuildHeightmap === false ? terrainChunk.heightmap : buildHeightmap(decoratedBlocks),
    };
  }

  finalizePopulatedChunk(dimension, chunkX, chunkZ, worldVerticalOffset = 0) {
    if (!this.regionProfile?.entityAnchors?.length) {
      return;
    }

    for (const anchor of this.regionProfile.entityAnchors) {
      if (
        Math.floor(anchor.x / CHUNK_SIZE) !== chunkX
        || Math.floor(anchor.z / CHUNK_SIZE) !== chunkZ
      ) {
        continue;
      }

      const spawnLocation = {
        x: anchor.x + 0.5,
        y: anchor.y + worldVerticalOffset,
        z: anchor.z + 0.5,
      };
      const existingAnchor = dimension.getEntities({
        type: anchor.typeId,
        location: spawnLocation,
        maxDistance: 1.25,
      }).find((entity) =>
        Math.abs(entity.location.x - spawnLocation.x) <= 0.1
        && Math.abs(entity.location.y - spawnLocation.y) <= 0.1
        && Math.abs(entity.location.z - spawnLocation.z) <= 0.1,
      );

      if (!existingAnchor) {
        dimension.spawnEntity(anchor.typeId, spawnLocation);
      }
    }
  }

  generateChunk(chunkX, chunkZ) {
    return this.decorateTerrainChunk(this.generateTerrainChunk(chunkX, chunkZ));
  }
}








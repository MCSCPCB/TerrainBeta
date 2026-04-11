import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import { JavaRandom, toJavaLong } from "../random/java.js";
import { chunkBlockIndex } from "../utils/layout.js";
import { getMapGenSeeds } from "../population/seeding.js";

const CAVE_REPLACEABLE = new Set([
  BLOCKS.STONE,
  BLOCKS.GRASS,
  BLOCKS.DIRT,
]);

const OCEAN_BLOCKS = new Set([
  BLOCKS.WATER,
]);

export const DEFAULT_CAVE_RANGE = 8;

function inBounds(x, y, z) {
  return x >= 0 && x < 16 && y >= 0 && y < 128 && z >= 0 && z < 16;
}

function getBlock(blocks, x, y, z) {
  if (!inBounds(x, y, z)) {
    return BLOCKS.AIR;
  }
  return blocks[chunkBlockIndex(x, y, z)];
}

function setBlock(blocks, x, y, z, blockId) {
  if (inBounds(x, y, z)) {
    blocks[chunkBlockIndex(x, y, z)] = blockId;
  }
}

function isOceanBlock(blockId) {
  return OCEAN_BLOCKS.has(blockId);
}

function caveTunnelMaxSteps(random, range) {
  const maxBlockRadius = range * 16 - 16;
  return maxBlockRadius - random.nextInt(Math.max(1, Math.trunc(maxBlockRadius / 4)));
}

function caveSplitStep(random, maxSteps, width) {
  if (width <= 1.0) {
    return -1;
  }

  return Math.trunc(maxSteps / 4) + random.nextInt(Math.max(1, Math.trunc(maxSteps / 2)));
}

function intersectsOcean(blocks, minX, maxX, minY, maxY, minZ, maxZ) {
  for (let z = minZ; z < maxZ; z += 1) {
    for (let x = minX; x < maxX; x += 1) {
      let y = maxY + 1;

      while (y >= minY - 1) {
        if (y >= 0 && y < 128 && isOceanBlock(getBlock(blocks, x, y, z))) {
          return true;
        }

        if (
          y !== minY - 1
          && x !== minX
          && x !== maxX - 1
          && z !== minZ
          && z !== maxZ - 1
        ) {
          y = minY;
        }

        y -= 1;
      }
    }
  }

  return false;
}

function carveBlob(blocks, targetChunkX, targetChunkZ, centerX, centerY, centerZ, radiusH, radiusV) {
  const minX = Math.max(Math.floor(centerX - radiusH) - targetChunkX * 16 - 1, 0);
  const maxX = Math.min(Math.floor(centerX + radiusH) - targetChunkX * 16 + 1, 16);
  const minY = Math.max(Math.floor(centerY - radiusV) - 1, 1);
  const maxY = Math.min(Math.floor(centerY + radiusV) + 1, 126);
  const minZ = Math.max(Math.floor(centerZ - radiusH) - targetChunkZ * 16 - 1, 0);
  const maxZ = Math.min(Math.floor(centerZ + radiusH) - targetChunkZ * 16 + 1, 16);

  if (intersectsOcean(blocks, minX, maxX, minY, maxY, minZ, maxZ)) {
    return;
  }

  for (let x = minX; x < maxX; x += 1) {
    const normX = ((targetChunkX * 16 + x) + 0.5 - centerX) / radiusH;
    const normXSq = normX * normX;
    if (normXSq >= 1.0) {
      continue;
    }

    for (let z = minZ; z < maxZ; z += 1) {
      const normZ = ((targetChunkZ * 16 + z) + 0.5 - centerZ) / radiusH;
      const normZSq = normZ * normZ;
      if (normXSq + normZSq >= 1.0) {
        continue;
      }

      for (let y = maxY; y >= minY; y -= 1) {
        const normY = (y + 0.5 - centerY) / radiusV;
        if (normY <= -0.7 || normXSq + normZSq + normY * normY >= 1.0) {
          continue;
        }

        const existing = getBlock(blocks, x, y, z);
        if (!CAVE_REPLACEABLE.has(existing)) {
          continue;
        }

        setBlock(blocks, x, y, z, y < 10 ? EXTRA_BLOCKS.FLOWING_LAVA : BLOCKS.AIR);
        if (existing === BLOCKS.GRASS && y > 0 && getBlock(blocks, x, y - 1, z) === BLOCKS.DIRT) {
          setBlock(blocks, x, y - 1, z, BLOCKS.GRASS);
        }
      }
    }
  }
}

function carveTunnel(
  blocks,
  targetChunkX,
  targetChunkZ,
  pathRandom,
  rootRandom,
  startX,
  startY,
  startZ,
  width,
  yaw,
  pitch,
  maxSteps,
  step = 0,
  verticalScale = 1.0,
  splitStep = -1,
  pitchKeep = pathRandom.nextInt(6) === 0 ? 0.92 : 0.7,
) {
  let centerX = startX;
  let centerY = startY;
  let centerZ = startZ;
  let currentYaw = yaw;
  let currentPitch = pitch;
  let yawChange = 0.0;
  let pitchChange = 0.0;
  const isRoom = step === -1;

  let workingStep = step;
  if (isRoom) {
    workingStep = Math.trunc(maxSteps / 2);
  }

  let branchPoint = splitStep;
  if (branchPoint === -1) {
    branchPoint = caveSplitStep(pathRandom, maxSteps, width);
  }

  for (; workingStep < maxSteps; workingStep += 1) {
    const horizontalRadius = 1.5 + Math.sin((workingStep * Math.PI) / maxSteps) * width;
    const verticalRadius = horizontalRadius * verticalScale;
    const cosPitch = Math.cos(currentPitch);

    centerX += Math.cos(currentYaw) * cosPitch;
    centerY += Math.sin(currentPitch);
    centerZ += Math.sin(currentYaw) * cosPitch;

    currentPitch *= pitchKeep;
    currentPitch += pitchChange * 0.1;
    currentYaw += yawChange * 0.1;
    pitchChange *= 0.9;
    yawChange *= 0.75;
    pitchChange += (pathRandom.nextFloat() - pathRandom.nextFloat()) * pathRandom.nextFloat() * 2.0;
    yawChange += (pathRandom.nextFloat() - pathRandom.nextFloat()) * pathRandom.nextFloat() * 4.0;

    if (!isRoom && branchPoint !== -1 && workingStep === branchPoint) {
      const childLeftRandom = new JavaRandom(rootRandom.nextLong());
      const childRightRandom = new JavaRandom(rootRandom.nextLong());
      const childLeftWidth = pathRandom.nextFloat() * 0.5 + 0.5;
      const childRightWidth = pathRandom.nextFloat() * 0.5 + 0.5;

      carveTunnel(
        blocks,
        targetChunkX,
        targetChunkZ,
        childLeftRandom,
        rootRandom,
        centerX,
        centerY,
        centerZ,
        childLeftWidth,
        currentYaw - Math.PI / 2,
        currentPitch / 3,
        maxSteps,
        workingStep,
        verticalScale,
        caveSplitStep(childLeftRandom, maxSteps, childLeftWidth),
        childLeftRandom.nextInt(6) === 0 ? 0.92 : 0.7,
      );
      carveTunnel(
        blocks,
        targetChunkX,
        targetChunkZ,
        childRightRandom,
        rootRandom,
        centerX,
        centerY,
        centerZ,
        childRightWidth,
        currentYaw + Math.PI / 2,
        currentPitch / 3,
        maxSteps,
        workingStep,
        verticalScale,
        caveSplitStep(childRightRandom, maxSteps, childRightWidth),
        childRightRandom.nextInt(6) === 0 ? 0.92 : 0.7,
      );
      return;
    }

    if (!isRoom && pathRandom.nextInt(4) === 0) {
      continue;
    }

    const distanceX = centerX - (targetChunkX * 16 + 8);
    const distanceZ = centerZ - (targetChunkZ * 16 + 8);
    const remaining = maxSteps - workingStep;
    const buffer = width * 2.0 + 16.0;
    if (distanceX * distanceX + distanceZ * distanceZ - remaining * remaining > buffer * buffer) {
      return;
    }

    carveBlob(blocks, targetChunkX, targetChunkZ, centerX, centerY, centerZ, horizontalRadius, verticalRadius);

    if (isRoom) {
      break;
    }
  }
}

function carveCavesForSourceChunk(
  blocks,
  seed64,
  xSeed,
  zSeed,
  targetChunkX,
  targetChunkZ,
  range,
  sourceChunkX,
  sourceChunkZ,
) {
  const chunkSeed = BigInt.asIntN(
    64,
    (BigInt(sourceChunkX) * xSeed + BigInt(sourceChunkZ) * zSeed) ^ seed64,
  );
  const random = new JavaRandom(chunkSeed);

  let caveCount = random.nextInt(random.nextInt(random.nextInt(40) + 1) + 1);
  if (random.nextInt(15) !== 0) {
    caveCount = 0;
  }

  for (let caveIndex = 0; caveIndex < caveCount; caveIndex += 1) {
    const startX = sourceChunkX * 16 + random.nextInt(16);
    const startY = random.nextInt(random.nextInt(120) + 8);
    const startZ = sourceChunkZ * 16 + random.nextInt(16);
    let tunnelCount = 1;

    if (random.nextInt(4) === 0) {
      const roomSize = 1.0 + random.nextFloat() * 6.0;
      carveBlob(
        blocks,
        targetChunkX,
        targetChunkZ,
        startX + 1.0,
        startY,
        startZ,
        1.5 + roomSize,
        (1.5 + roomSize) * 0.5,
      );
      tunnelCount += random.nextInt(4);
    }

    for (let tunnelIndex = 0; tunnelIndex < tunnelCount; tunnelIndex += 1) {
      const yaw = random.nextFloat() * Math.PI * 2.0;
      const pitch = (random.nextFloat() - 0.5) / 4.0;
      const width = random.nextFloat() * 2.0 + random.nextFloat();
      const pathRandom = new JavaRandom(random.nextLong());
      const maxSteps = caveTunnelMaxSteps(pathRandom, range);

      carveTunnel(
        blocks,
        targetChunkX,
        targetChunkZ,
        pathRandom,
        random,
        startX,
        startY,
        startZ,
        width,
        yaw,
        pitch,
        maxSteps,
        0,
        1.0,
        caveSplitStep(pathRandom, maxSteps, width),
      );
    }
  }
}

export function createCaveCarverSession(blocks, seed, targetChunkX, targetChunkZ, range = DEFAULT_CAVE_RANGE) {
  const { xSeed, zSeed } = getMapGenSeeds(seed);

  return {
    blocks,
    targetChunkX,
    targetChunkZ,
    range,
    xSeed,
    zSeed,
    seed64: toJavaLong(seed),
    sourceChunkX: targetChunkX - range,
    sourceChunkZ: targetChunkZ - range,
    complete: false,
  };
}

export function advanceCaveCarverSession(session, sourceChunkCount = 1) {
  if (session.complete) {
    return false;
  }

  let processed = 0;
  while (processed < sourceChunkCount && !session.complete) {
    carveCavesForSourceChunk(
      session.blocks,
      session.seed64,
      session.xSeed,
      session.zSeed,
      session.targetChunkX,
      session.targetChunkZ,
      session.range,
      session.sourceChunkX,
      session.sourceChunkZ,
    );

    processed += 1;
    session.sourceChunkZ += 1;
    if (session.sourceChunkZ > session.targetChunkZ + session.range) {
      session.sourceChunkZ = session.targetChunkZ - session.range;
      session.sourceChunkX += 1;
      if (session.sourceChunkX > session.targetChunkX + session.range) {
        session.complete = true;
      }
    }
  }

  return processed > 0;
}

export function applyCaves(blocks, seed, targetChunkX, targetChunkZ, range = DEFAULT_CAVE_RANGE) {
  const session = createCaveCarverSession(blocks, seed, targetChunkX, targetChunkZ, range);
  while (advanceCaveCarverSession(session)) {
    // Run the exact same deterministic state machine to completion for synchronous callers.
  }
}

import {
  world,
  system,
  BlockPermutation,
  BlockVolume,
  ListBlockVolume,
} from "@minecraft/server";

import {
  BLOCK_GENERATION_CONFIG,
  createConfiguredWorldGenerator,
} from "./worldgen/index.js";

const activeWorldGenerator = createConfiguredWorldGenerator();
const activeRuntimeProfile = activeWorldGenerator.runtimeProfile ?? {};
const BLOCKS = activeWorldGenerator.blocks;
const BEDROCK_BLOCK_MAP = activeWorldGenerator.blockTypeMap;

const CHUNK_SIZE = activeWorldGenerator.dimensions.chunkSize;
const CHUNK_HEIGHT = activeWorldGenerator.dimensions.chunkHeight;
const MIN_WORLD_Y = activeWorldGenerator.dimensions.minWorldY;
const LOAD_RADIUS = 2;
const FULL_DETAIL_DISTANCE = 3;
const FOREGROUND_PRIORITY_NONE = 99;
const FOREGROUND_DIRECTION_MIN_SPEED = 0.05;
const MAX_PREPARE_PER_TICK = 1;
const MAX_ACTIVE_CHUNK_STEPS_PER_TICK = 8;
const MAX_NEAR_CHUNK_STEPS_PER_TICK = 5;
const GENERATION_INTERVAL_TICKS = 8;
const MAX_TERRAIN_STABLE_RUNS_PER_STEP = 768;
const MAX_TERRAIN_DEFERRED_RUNS_PER_STEP = 384;
const MAX_DECORATION_STABLE_RUNS_PER_STEP = 512;
const MAX_DECORATION_DEFERRED_RUNS_PER_STEP = 256;
const MAX_PENDING_CHUNK_TASKS = 48;
const MAX_BACKGROUND_TERRAIN_STABLE_RUNS_PER_STEP = 4;
const MAX_BACKGROUND_TERRAIN_DEFERRED_RUNS_PER_STEP = 4;
const MAX_BACKGROUND_DECORATION_STABLE_RUNS_PER_STEP = 4;
const MAX_BACKGROUND_DECORATION_DEFERRED_RUNS_PER_STEP = 4; // 3
const MAX_BACKGROUND_VERTICAL_BLOCKS_PER_OPERATION = 24; // 16
const MAX_BACKGROUND_WORLD_WRITES_PER_TICK = 5;
const MAX_BACKGROUND_DECORATION_PLANS_PER_TICK = 2;
const BACKGROUND_LOOKAHEAD_CHUNKS = Number.isInteger(activeRuntimeProfile.backgroundLookaheadChunks)
  ? Math.max(0, activeRuntimeProfile.backgroundLookaheadChunks)
  : 3;
const BACKGROUND_IDLE_BUDGET_BOOST_TICKS = 20;
const BACKGROUND_DEEP_IDLE_BUDGET_BOOST_TICKS = 60;
const INITIALIZATION_MAX_DURATION_MS = 60_000;
const INITIALIZATION_PROGRESS_REPORT_INTERVAL_MS = 1_000;
const INITIALIZATION_MAX_CHUNK_STEPS_PER_TICK = 32;
const INITIALIZATION_PLAYER_LOADING_HEIGHT = 320;
const CHUNK_STATUS_STORAGE_KEY = activeWorldGenerator.storageKey;
const CHUNK_STATUS_STORAGE_BUCKET_COUNT = 256;
const TERRAIN_CHUNK_STORAGE_KEY = `${CHUNK_STATUS_STORAGE_KEY}:terrain`;
const POPULATED_CHUNK_STORAGE_KEY = `${CHUNK_STATUS_STORAGE_KEY}:population`;
const INITIALIZATION_TRIGGERED_PROPERTY = `${CHUNK_STATUS_STORAGE_KEY}:initialization_triggered`;
const INITIALIZATION_PLAYER_RETURN_PROPERTY = `${CHUNK_STATUS_STORAGE_KEY}:initialization_return`;
const FALLBACK_BLOCK_TYPE_ID = BLOCK_GENERATION_CONFIG.fallbackBlockTypeId;
const BLOCK_ACCESS_SAMPLE_Y = 64;
const BACKGROUND_TICKINGAREA_RADIUS_CHUNKS = 1;
const BACKGROUND_TICKINGAREA_NAME = `${CHUNK_STATUS_STORAGE_KEY}_background`
  .replace(/[^0-9A-Za-z_]/g, "_");
const DETAIL_PHASE_TERRAIN = "terrain";
const DETAIL_PHASE_COMPLETE = "complete";
const INITIALIZATION_COMPLETION_MODE = activeRuntimeProfile.initializationCompletionMode ?? "center_landing";
const WRITE_CATEGORY_STABLE = "stable";
const WRITE_CATEGORY_DEFERRED = "deferred";
const TREE_DECORATION_BLOCK_TYPE_IDS = new Set([
  "minecraft:oak_log",
  "minecraft:birch_log",
  "minecraft:spruce_log",
  "minecraft:oak_leaves",
  "minecraft:birch_leaves",
  "minecraft:spruce_leaves",
]);

const DEFERRED_BLOCK_TYPES = new Set(BLOCK_GENERATION_CONFIG.deferredBlockTypeIds);

const BLOCK_TYPE_ID_BY_ID = [];
const DEFERRED_BLOCK_BY_ID = [];
const permutationCache = new Map();
const pendingChunkTasks = new Map();
const backgroundChunkTasks = new Map();
const activeGenerator = activeWorldGenerator.generator;

const unresolvedBlockTypeWarnings = new Set();
const backgroundTickingAreaState = {
  busy: false,
  loaded: false,
  centerChunkX: 0,
  centerChunkZ: 0,
};
const initializationAnchorState = {
  playerId: "",
  targetQueue: [],
  targetCursor: 0,
  queuedRadius: 0,
  originChunkX: 0,
  originChunkZ: 0,
};
let initializationDeadlineMs = 0;
let observedPlayerCount = 0;
let initializationStartedAtMs = 0;
let initializationLastReportedAtMs = 0;
let initializationCompletedChunkCount = 0;
let initializationWindowRunning = false;
let initializationReturnPending = false;
let initializationFinishReason = "";
const FOREGROUND_STEP_LIMITS = Object.freeze({
  terrainStableRunsPerStep: MAX_TERRAIN_STABLE_RUNS_PER_STEP,
  terrainDeferredRunsPerStep: MAX_TERRAIN_DEFERRED_RUNS_PER_STEP,
  decorationStableRunsPerStep: MAX_DECORATION_STABLE_RUNS_PER_STEP,
  decorationDeferredRunsPerStep: MAX_DECORATION_DEFERRED_RUNS_PER_STEP,
});
const BACKGROUND_STEP_LIMITS = Object.freeze({
  terrainStableRunsPerStep: MAX_BACKGROUND_TERRAIN_STABLE_RUNS_PER_STEP,
  terrainDeferredRunsPerStep: MAX_BACKGROUND_TERRAIN_DEFERRED_RUNS_PER_STEP,
  decorationStableRunsPerStep: MAX_BACKGROUND_DECORATION_STABLE_RUNS_PER_STEP,
  decorationDeferredRunsPerStep: MAX_BACKGROUND_DECORATION_DEFERRED_RUNS_PER_STEP,
  verticalBlocksPerOperation: MAX_BACKGROUND_VERTICAL_BLOCKS_PER_OPERATION,
  singleOperationPerCall: true,
});
const INITIALIZATION_STEP_LIMITS = Object.freeze({
  terrainStableRunsPerStep: MAX_TERRAIN_STABLE_RUNS_PER_STEP * 2,
  terrainDeferredRunsPerStep: MAX_TERRAIN_DEFERRED_RUNS_PER_STEP * 2,
  decorationStableRunsPerStep: MAX_DECORATION_STABLE_RUNS_PER_STEP * 2,
  decorationDeferredRunsPerStep: MAX_DECORATION_DEFERRED_RUNS_PER_STEP * 2,
});
let foregroundDemandActive = false;
let generationPass = 0;
let backgroundTickSequence = 0;
let backgroundStartedChunkCount = 0;
let backgroundCompletedChunkCount = 0;
const CARDINAL_CHUNK_OFFSETS = Object.freeze([
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: -1, z: 0 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: 0, z: -1 }),
]);
const BACKGROUND_NEIGHBOR_OFFSETS_BY_DIRECTION = new Map();

for (const [blockIdText, typeId] of Object.entries(BEDROCK_BLOCK_MAP)) {
  const blockId = Number(blockIdText);
  BLOCK_TYPE_ID_BY_ID[blockId] = typeId;
  DEFERRED_BLOCK_BY_ID[blockId] = blockId !== BLOCKS.AIR && DEFERRED_BLOCK_TYPES.has(typeId);
}

for (let forwardX = -1; forwardX <= 1; forwardX += 1) {
  for (let forwardZ = -1; forwardZ <= 1; forwardZ += 1) {
    const orderedOffsets = CARDINAL_CHUNK_OFFSETS
      .slice()
      .sort((left, right) => {
        const leftDot = left.x * forwardX + left.z * forwardZ;
        const rightDot = right.x * forwardX + right.z * forwardZ;
        if (leftDot !== rightDot) {
          return rightDot - leftDot;
        }

        const leftAxisBias = Math.abs(left.x) * Math.abs(forwardX) + Math.abs(left.z) * Math.abs(forwardZ);
        const rightAxisBias = Math.abs(right.x) * Math.abs(forwardX) + Math.abs(right.z) * Math.abs(forwardZ);
        if (leftAxisBias !== rightAxisBias) {
          return rightAxisBias - leftAxisBias;
        }

        if (left.x !== right.x) {
          return right.x - left.x;
        }
        return right.z - left.z;
      });

    BACKGROUND_NEIGHBOR_OFFSETS_BY_DIRECTION.set(
      `${forwardX}|${forwardZ}`,
      Object.freeze(orderedOffsets),
    );
  }
}

function chunkBlockIndex(x, y, z) {
  return ((x * CHUNK_SIZE + z) * CHUNK_HEIGHT) + (y - MIN_WORLD_Y);
}

function chunkKey(chunkX, chunkZ) {
  return `${chunkX}|${chunkZ}`;
}

function getGeneratedChunkBucketIndex(key) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 31) + key.charCodeAt(index)) >>> 0;
  }
  return hash % CHUNK_STATUS_STORAGE_BUCKET_COUNT;
}

function getPlayerChunk(player) {
  const { x, z } = player.location;
  return {
    x: Math.floor(x / CHUNK_SIZE),
    z: Math.floor(z / CHUNK_SIZE),
  };
}

function getChunkForLocation(location) {
  return {
    x: Math.floor(location.x / CHUNK_SIZE),
    z: Math.floor(location.z / CHUNK_SIZE),
  };
}

function quantizeDirectionComponent(value) {
  if (value >= 0.3826834323650898) {
    return 1;
  }
  if (value <= -0.3826834323650898) {
    return -1;
  }
  return 0;
}

function getPlayerBackgroundDirection(player) {
  const viewDirection = player.getViewDirection();
  const horizontalLength = Math.hypot(viewDirection.x, viewDirection.z);
  if (horizontalLength <= 0.0001) {
    return { x: 0, z: 0 };
  }

  const normalizedX = viewDirection.x / horizontalLength;
  const normalizedZ = viewDirection.z / horizontalLength;
  let chunkStepX = quantizeDirectionComponent(normalizedX);
  let chunkStepZ = quantizeDirectionComponent(normalizedZ);

  if (chunkStepX === 0 && chunkStepZ === 0) {
    if (Math.abs(normalizedX) >= Math.abs(normalizedZ)) {
      chunkStepX = normalizedX >= 0 ? 1 : -1;
    } else {
      chunkStepZ = normalizedZ >= 0 ? 1 : -1;
    }
  }

  return { x: chunkStepX, z: chunkStepZ };
}

function getPlayerForegroundMovementDirection(player) {
  const velocity = player.getVelocity();
  const horizontalLength = Math.hypot(velocity.x, velocity.z);
  if (horizontalLength <= FOREGROUND_DIRECTION_MIN_SPEED) {
    return null;
  }

  const normalizedX = velocity.x / horizontalLength;
  const normalizedZ = velocity.z / horizontalLength;
  let chunkStepX = quantizeDirectionComponent(normalizedX);
  let chunkStepZ = quantizeDirectionComponent(normalizedZ);

  if (chunkStepX === 0 && chunkStepZ === 0) {
    if (Math.abs(normalizedX) >= Math.abs(normalizedZ)) {
      chunkStepX = normalizedX >= 0 ? 1 : -1;
    } else {
      chunkStepZ = normalizedZ >= 0 ? 1 : -1;
    }
  }

  return { x: chunkStepX, z: chunkStepZ };
}

function appendForegroundPriorityOffset(offsets, seen, x, z) {
  if (Math.abs(x) > LOAD_RADIUS || Math.abs(z) > LOAD_RADIUS) {
    return;
  }

  const key = chunkKey(x, z);
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  offsets.push({ x, z });
}

function createForegroundPriorityOffsets(stepX, stepZ) {
  const row1 = [];
  const row2 = [];
  const seenRow1 = new Set();
  const seenRow2 = new Set();

  appendForegroundPriorityOffset(row1, seenRow1, stepX, stepZ);

  if (stepX !== 0 && stepZ !== 0) {
    appendForegroundPriorityOffset(row1, seenRow1, stepX, 0);
    appendForegroundPriorityOffset(row1, seenRow1, 0, stepZ);
    appendForegroundPriorityOffset(row2, seenRow2, stepX * 2, stepZ * 2);
    appendForegroundPriorityOffset(row2, seenRow2, stepX * 2, stepZ);
    appendForegroundPriorityOffset(row2, seenRow2, stepX, stepZ * 2);
  } else {
    const perpendicularA = { x: -stepZ, z: stepX };
    const perpendicularB = { x: stepZ, z: -stepX };
    appendForegroundPriorityOffset(
      row1,
      seenRow1,
      stepX + perpendicularA.x,
      stepZ + perpendicularA.z,
    );
    appendForegroundPriorityOffset(
      row1,
      seenRow1,
      stepX + perpendicularB.x,
      stepZ + perpendicularB.z,
    );
    appendForegroundPriorityOffset(row2, seenRow2, stepX * 2, stepZ * 2);
    appendForegroundPriorityOffset(
      row2,
      seenRow2,
      stepX * 2 + perpendicularA.x,
      stepZ * 2 + perpendicularA.z,
    );
    appendForegroundPriorityOffset(
      row2,
      seenRow2,
      stepX * 2 + perpendicularB.x,
      stepZ * 2 + perpendicularB.z,
    );
  }

  return { row1, row2 };
}

function setForegroundPriorityRank(priorityRanks, dx, dz, rank) {
  const key = chunkKey(dx, dz);
  const existingRank = priorityRanks.get(key);
  if (existingRank === undefined || rank < existingRank) {
    priorityRanks.set(key, rank);
  }
}

function createForegroundPriorityContexts(players, generationQueue) {
  if (generationQueue.length === 0) {
    return [];
  }

  const requestKeySet = new Set(generationQueue.map((request) => request.key));
  const contexts = [];

  for (const player of players) {
    if (!player.isSprinting) {
      continue;
    }

    const direction = getPlayerForegroundMovementDirection(player);
    if (!direction) {
      continue;
    }

    const offsets = createForegroundPriorityOffsets(direction.x, direction.z);
    if (offsets.row1.length === 0) {
      continue;
    }

    const center = getPlayerChunk(player);
    const hasFrontPressure = offsets.row1.some((offset) =>
      requestKeySet.has(chunkKey(center.x + offset.x, center.z + offset.z))
    );
    if (!hasFrontPressure) {
      continue;
    }

    const priorityRanks = new Map();
    setForegroundPriorityRank(priorityRanks, 0, 0, 0);

    const [row1Main, ...row1SideOffsets] = offsets.row1;
    if (row1Main) {
      setForegroundPriorityRank(priorityRanks, row1Main.x, row1Main.z, 1);
    }
    for (const offset of row1SideOffsets) {
      setForegroundPriorityRank(priorityRanks, offset.x, offset.z, 2);
    }

    const [row2Main, ...row2SideOffsets] = offsets.row2;
    if (row2Main) {
      setForegroundPriorityRank(priorityRanks, row2Main.x, row2Main.z, 3);
    }
    for (const offset of row2SideOffsets) {
      setForegroundPriorityRank(priorityRanks, offset.x, offset.z, 4);
    }

    contexts.push({
      chunkX: center.x,
      chunkZ: center.z,
      priorityRanks,
    });
  }

  return contexts;
}

function getForegroundRequestSortData(request, priorityContexts) {
  let rank = FOREGROUND_PRIORITY_NONE;
  let contextualDistance = request.distance;

  for (const context of priorityContexts) {
    const dx = request.x - context.chunkX;
    const dz = request.z - context.chunkZ;
    const candidateRank = context.priorityRanks.get(chunkKey(dx, dz));
    if (candidateRank === undefined) {
      continue;
    }

    const candidateDistance = Math.hypot(dx, dz);
    if (
      candidateRank < rank
      || (candidateRank === rank && candidateDistance < contextualDistance)
    ) {
      rank = candidateRank;
      contextualDistance = candidateDistance;
    }
  }

  return {
    rank,
    contextualDistance,
  };
}

function getPlayerChunkSignature(players) {
  return players
    .map((player) => {
      const chunk = getPlayerChunk(player);
      return chunkKey(chunk.x, chunk.z);
    })
    .sort()
    .join(",");
}

function getChunkCenterBlockX(chunkX) {
  return (chunkX * CHUNK_SIZE) + Math.floor(CHUNK_SIZE / 2);
}

function getChunkCenterBlockZ(chunkZ) {
  return (chunkZ * CHUNK_SIZE) + Math.floor(CHUNK_SIZE / 2);
}

function getInitializationLoadingLocation(chunkX, chunkZ) {
  return {
    x: getChunkCenterBlockX(chunkX) + 0.5,
    y: INITIALIZATION_PLAYER_LOADING_HEIGHT,
    z: getChunkCenterBlockZ(chunkZ) + 0.5,
  };
}

function getTopmostLandingLocation(dimension, x, z) {
  try {
    const topBlock = dimension.getTopmostBlock({ x, z });
    if (!topBlock || !topBlock.isValid()) {
      return null;
    }

    return {
      x: topBlock.location.x + 0.5,
      y: topBlock.location.y + 1,
      z: topBlock.location.z + 0.5,
    };
  } catch (_error) {
    return null;
  }
}

function isInitializationTargetComplete(dimension, target) {
  const chunkState = getChunkState(target.x, target.z);
  if (!chunkState.hasPopulatedChunk) {
    return false;
  }

  switch (INITIALIZATION_COMPLETION_MODE) {
    case "populated":
      return true;

    case "center_landing":
    default:
      return getTopmostLandingLocation(
        dimension,
        getChunkCenterBlockX(target.x),
        getChunkCenterBlockZ(target.z),
      ) !== null;
  }
}

function isPlayerAtInitializationLoadingHeight(player) {
  return Math.abs(player.location.y - INITIALIZATION_PLAYER_LOADING_HEIGHT) <= 1;
}

function teleportPlayerToTopmostLanding(player, dimension, x, z, checkForBlocks = false) {
  const landingLocation = getTopmostLandingLocation(dimension, x, z);
  if (!landingLocation) {
    return false;
  }

  if (checkForBlocks) {
    return player.tryTeleport(
      landingLocation,
      {
        dimension,
        checkForBlocks: true,
      },
    );
  }

  player.teleport(
    landingLocation,
    {
      dimension,
      checkForBlocks: false,
    },
  );
  return true;
}

function getBlockTypeId(blockId) {
  const typeId = BLOCK_TYPE_ID_BY_ID[blockId];
  if (typeId === undefined) {
    throw new Error(`Unmapped block id ${blockId}`);
  }
  return typeId;
}

function getPermutation(typeId) {
  let permutation = permutationCache.get(typeId);
  if (!permutation) {
    try {
      permutation = BlockPermutation.resolve(typeId);
    } catch (error) {
      if (!unresolvedBlockTypeWarnings.has(typeId)) {
        console.warn(`Unresolved block type '${typeId}', using ${FALLBACK_BLOCK_TYPE_ID}: ${error}`);
        unresolvedBlockTypeWarnings.add(typeId);
      }
      permutation = BlockPermutation.resolve(FALLBACK_BLOCK_TYPE_ID);
    }
    permutationCache.set(typeId, permutation);
  }
  return permutation;
}

function placeVerticalRun(dimension, x, z, startY, endY, typeId) {
  if (startY > endY) {
    return;
  }

  dimension.fillBlocks(
    new BlockVolume(
      { x, y: startY, z },
      { x, y: endY, z },
    ),
    getPermutation(typeId),
  );
}

function placeVerticalRunStep(
  dimension,
  x,
  z,
  startY,
  endY,
  typeId,
  maxVerticalBlocks = 0,
) {
  if (startY > endY) {
    return {
      nextY: null,
      complete: true,
      progressed: false,
    };
  }

  const stepEndY = maxVerticalBlocks > 0
    ? Math.min(endY, startY + maxVerticalBlocks - 1)
    : endY;

  placeVerticalRun(dimension, x, z, startY, stepEndY, typeId);
  return {
    nextY: stepEndY >= endY ? null : stepEndY + 1,
    complete: stepEndY >= endY,
    progressed: true,
  };
}

function isChunkWritable(dimension, startX, startZ) {
  return Boolean(
    dimension.getBlock({
      x: startX + Math.floor(CHUNK_SIZE / 2),
      y: BLOCK_ACCESS_SAMPLE_Y,
      z: startZ + Math.floor(CHUNK_SIZE / 2),
    }),
  );
}

function getChunkState(chunkX, chunkZ) {
  const key = chunkKey(chunkX, chunkZ);
  const hasPopulatedChunk = populatedChunks.has(chunkX, chunkZ);
  const hasTerrainChunk = terrainChunks.has(chunkX, chunkZ);

  return {
    key,
    hasPopulatedChunk,
    hasTerrainChunk,
    hasTerrainOnlyChunk: hasTerrainChunk && !hasPopulatedChunk,
  };
}

function createWriteRun(x, z, startY, endY, typeId) {
  return { x, z, startY, endY, typeId };
}

function getWriteCategoryForBlock(blockId) {
  return DEFERRED_BLOCK_BY_ID[blockId] ? WRITE_CATEGORY_DEFERRED : WRITE_CATEGORY_STABLE;
}

function sortWriteRuns(runs) {
  runs.sort((left, right) => {
    if (left.startY !== right.startY) {
      return left.startY - right.startY;
    }
    if (left.x !== right.x) {
      return left.x - right.x;
    }
    return left.z - right.z;
  });
}

function partitionTreeDecorationRuns(stableRuns, deferredRuns) {
  const treeRuns = [];
  const remainingStableRuns = [];
  const remainingDeferredRuns = [];

  for (const run of stableRuns) {
    if (TREE_DECORATION_BLOCK_TYPE_IDS.has(run.typeId)) {
      treeRuns.push(run);
    } else {
      remainingStableRuns.push(run);
    }
  }

  for (const run of deferredRuns) {
    if (TREE_DECORATION_BLOCK_TYPE_IDS.has(run.typeId)) {
      treeRuns.push(run);
    } else {
      remainingDeferredRuns.push(run);
    }
  }

  return {
    treeRuns,
    stableRuns: remainingStableRuns,
    deferredRuns: remainingDeferredRuns,
  };
}

function appendChunkWritePlanColumns(chunkData, startX, columnCount, stableRuns, deferredRuns) {
  const blocks = chunkData.blocks;
  const heightmap = chunkData.heightmap;
  const endX = Math.min(CHUNK_SIZE, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const columnTop = heightmap[x * CHUNK_SIZE + z];
      if (columnTop <= MIN_WORLD_Y) {
        continue;
      }

      const columnBase = chunkBlockIndex(x, MIN_WORLD_Y, z);
      const columnLimit = columnBase + (columnTop - MIN_WORLD_Y);
      let y = MIN_WORLD_Y;
      let index = columnBase;

      while (index < columnLimit) {
        const blockId = blocks[index];

        if (blockId === BLOCKS.AIR) {
          y += 1;
          index += 1;
          continue;
        }

        const category = getWriteCategoryForBlock(blockId);
        const runStart = y;
        let runEndY = y;
        let runEndIndex = index;

        while (runEndIndex + 1 < columnLimit && blocks[runEndIndex + 1] === blockId) {
          runEndIndex += 1;
          runEndY += 1;
        }

        const run = createWriteRun(x, z, runStart, runEndY, getBlockTypeId(blockId));
        if (category === WRITE_CATEGORY_DEFERRED) {
          deferredRuns.push(run);
        } else {
          stableRuns.push(run);
        }

        y = runEndY + 1;
        index = runEndIndex + 1;
      }
    }
  }

  return endX;
}

function buildChunkWritePlan(chunkData) {
  const stableRuns = [];
  const deferredRuns = [];
  appendChunkWritePlanColumns(chunkData, 0, CHUNK_SIZE, stableRuns, deferredRuns);
  sortWriteRuns(stableRuns);
  sortWriteRuns(deferredRuns);
  return { stableRuns, deferredRuns };
}

function createChunkWritePlanBuilder(chunkData) {
  return {
    chunkData,
    stableRuns: [],
    deferredRuns: [],
    cursorX: 0,
    complete: false,
  };
}

function advanceChunkWritePlanBuilder(builder, columnCount = 1) {
  if (builder.complete) {
    return false;
  }

  builder.cursorX = appendChunkWritePlanColumns(
    builder.chunkData,
    builder.cursorX,
    columnCount,
    builder.stableRuns,
    builder.deferredRuns,
  );
  builder.complete = builder.cursorX >= CHUNK_SIZE;

  if (builder.complete) {
    sortWriteRuns(builder.stableRuns);
    sortWriteRuns(builder.deferredRuns);
  }

  return true;
}

function appendDeltaWritePlanColumns(sourceBlocks, targetBlocks, startX, columnCount, stableRuns, deferredRuns) {
  const endX = Math.min(CHUNK_SIZE, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const columnBase = chunkBlockIndex(x, MIN_WORLD_Y, z);
      const columnLimit = columnBase + CHUNK_HEIGHT;
      let y = MIN_WORLD_Y;
      let index = columnBase;

      while (index < columnLimit) {
        const targetBlockId = targetBlocks[index];

        if (targetBlockId === sourceBlocks[index]) {
          y += 1;
          index += 1;
          continue;
        }

        const category = getWriteCategoryForBlock(targetBlockId);
        const runStart = y;
        let runEndY = y;
        let runEndIndex = index;

        while (runEndIndex + 1 < columnLimit) {
          const nextIndex = runEndIndex + 1;
          if (targetBlocks[nextIndex] !== targetBlockId) {
            break;
          }
          if (targetBlocks[nextIndex] === sourceBlocks[nextIndex]) {
            break;
          }
          runEndIndex = nextIndex;
          runEndY += 1;
        }

        const run = createWriteRun(x, z, runStart, runEndY, getBlockTypeId(targetBlockId));
        if (category === WRITE_CATEGORY_DEFERRED) {
          deferredRuns.push(run);
        } else {
          stableRuns.push(run);
        }

        y = runEndY + 1;
        index = runEndIndex + 1;
      }
    }
  }

  return endX;
}

function buildDeltaWritePlan(sourceBlocks, targetBlocks) {
  const stableRuns = [];
  const deferredRuns = [];
  appendDeltaWritePlanColumns(sourceBlocks, targetBlocks, 0, CHUNK_SIZE, stableRuns, deferredRuns);
  sortWriteRuns(stableRuns);
  sortWriteRuns(deferredRuns);
  return { stableRuns, deferredRuns };
}

function createDeltaWritePlanBuilder(sourceBlocks, targetBlocks) {
  return {
    sourceBlocks,
    targetBlocks,
    stableRuns: [],
    deferredRuns: [],
    cursorX: 0,
    complete: false,
  };
}

function advanceDeltaWritePlanBuilder(builder, columnCount = 1) {
  if (builder.complete) {
    return false;
  }

  builder.cursorX = appendDeltaWritePlanColumns(
    builder.sourceBlocks,
    builder.targetBlocks,
    builder.cursorX,
    columnCount,
    builder.stableRuns,
    builder.deferredRuns,
  );
  builder.complete = builder.cursorX >= CHUNK_SIZE;

  if (builder.complete) {
    sortWriteRuns(builder.stableRuns);
    sortWriteRuns(builder.deferredRuns);
  }

  return true;
}

class PendingChunkTask {
  constructor(chunkX, chunkZ, terrainChunk, terrainWritePlan, requestPass, skipTerrainWrite) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.key = chunkKey(chunkX, chunkZ);
    this.lastRequestedPass = requestPass;
    this.terrainChunk = terrainChunk;
    this.terrainBlocks = terrainChunk.blocks;
    this.hasWorldWrites = false;
    this.terrainStableRuns = terrainWritePlan?.stableRuns ?? [];
    this.terrainDeferredRuns = terrainWritePlan?.deferredRuns ?? [];
    this.terrainStableCursor = 0;
    this.terrainStableY = null;
    this.terrainDeferredCursor = 0;
    this.terrainDeferredY = null;
    this.terrainComplete = skipTerrainWrite;
    this.decorationPrepared = false;
    this.decorationStableRuns = [];
    this.decorationDeferredRuns = [];
    this.decorationStableCursor = 0;
    this.decorationDeferredCursor = 0;
  }
}

class BackgroundChunkTask {
  constructor(chunkX, chunkZ, requestPass, skipTerrainWrite) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.key = chunkKey(chunkX, chunkZ);
    this.lastRequestedPass = requestPass;
    this.skipTerrainWrite = skipTerrainWrite;
    this.hasWorldWrites = false;
    this.backgroundTerrainSession = activeGenerator.createBackgroundTerrainSession(chunkX, chunkZ);
    this.terrainChunk = null;
    this.terrainBlocks = null;
    this.terrainPlanBuilder = null;
    this.terrainStableRuns = [];
    this.terrainDeferredRuns = [];
    this.terrainStableCursor = 0;
    this.terrainStableY = null;
    this.terrainDeferredCursor = 0;
    this.terrainDeferredY = null;
    this.terrainComplete = false;
    this.backgroundDecorationSession = null;
    this.decorationPlanBuilder = null;
    this.decorationPrepared = false;
    this.decorationTreeRuns = [];
    this.decorationTreeComplete = true;
    this.decorationStableRuns = [];
    this.decorationDeferredRuns = [];
    this.decorationStableCursor = 0;
    this.decorationDeferredCursor = 0;
  }
}

class PersistentChunkSet {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.memory = new Set();
    this.persistedBuckets = new Array(CHUNK_STATUS_STORAGE_BUCKET_COUNT);
  }

  getBucketStorageKey(bucketIndex) {
    return `${this.storageKey}:${bucketIndex}`;
  }

  getPersistedBucket(bucketIndex) {
    let bucket = this.persistedBuckets[bucketIndex];
    if (bucket) {
      return bucket;
    }

    bucket = new Set();
    const raw = world.getDynamicProperty(this.getBucketStorageKey(bucketIndex));
    if (typeof raw === "string" && raw.length > 0) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error(`Invalid chunk status bucket ${this.storageKey}:${bucketIndex}`);
      }

      for (const key of parsed) {
        bucket.add(String(key));
      }
    }

    this.persistedBuckets[bucketIndex] = bucket;
    return bucket;
  }

  savePersistedBucket(bucketIndex) {
    const bucket = this.getPersistedBucket(bucketIndex);
    world.setDynamicProperty(
      this.getBucketStorageKey(bucketIndex),
      JSON.stringify(Array.from(bucket)),
    );
  }

  has(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ);
    if (this.memory.has(key)) {
      return true;
    }

    return this.getPersistedBucket(getGeneratedChunkBucketIndex(key)).has(key);
  }

  add(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ);
    this.memory.add(key);
    const bucketIndex = getGeneratedChunkBucketIndex(key);
    const bucket = this.getPersistedBucket(bucketIndex);
    if (bucket.has(key)) {
      return;
    }

    bucket.add(key);
    this.savePersistedBucket(bucketIndex);
  }

  delete(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ);
    const removedFromMemory = this.memory.delete(key);
    const bucketIndex = getGeneratedChunkBucketIndex(key);
    const bucket = this.getPersistedBucket(bucketIndex);
    const removedFromPersisted = bucket.delete(key);
    if (removedFromPersisted) {
      this.savePersistedBucket(bucketIndex);
    }

    return removedFromMemory || removedFromPersisted;
  }
}

const terrainChunks = new PersistentChunkSet(TERRAIN_CHUNK_STORAGE_KEY);
const populatedChunks = new PersistentChunkSet(POPULATED_CHUNK_STORAGE_KEY);

function isTaskTerrainComplete(task) {
  return task.terrainComplete;
}

function isTaskDecorationComplete(task) {
  return (
    task.decorationPrepared
    && (task.decorationTreeComplete ?? true)
    && task.decorationStableCursor >= task.decorationStableRuns.length
    && task.decorationDeferredCursor >= task.decorationDeferredRuns.length
  );
}

function isTaskComplete(task) {
  return isTaskTerrainComplete(task) && isTaskDecorationComplete(task);
}

function getRequiredDetailPhase(distance) {
  return distance <= FULL_DETAIL_DISTANCE ? DETAIL_PHASE_COMPLETE : DETAIL_PHASE_TERRAIN;
}

function createBackgroundScanQueue(players) {
  const queue = [];
  const visited = new Set();

  for (const player of players) {
    const chunk = getPlayerChunk(player);
    const direction = getPlayerBackgroundDirection(player);

    enqueueBackgroundChunk(queue, visited, chunk.x, chunk.z, direction.x, direction.z);
    if (direction.x === 0 && direction.z === 0) {
      continue;
    }

    for (let step = 1; step <= BACKGROUND_LOOKAHEAD_CHUNKS; step += 1) {
      enqueueBackgroundChunk(
        queue,
        visited,
        chunk.x + direction.x * step,
        chunk.z + direction.z * step,
        direction.x,
        direction.z,
      );
    }
  }

  return { queue, visited };
}

function enqueueBackgroundChunk(queue, visited, chunkX, chunkZ, forwardX = 0, forwardZ = 0) {
  const key = chunkKey(chunkX, chunkZ);
  if (visited.has(key)) {
    return;
  }

  visited.add(key);
  queue.push({ key, x: chunkX, z: chunkZ, forwardX, forwardZ });
}

function enqueueBackgroundNeighbors(queue, visited, request) {
  const neighborOffsets = BACKGROUND_NEIGHBOR_OFFSETS_BY_DIRECTION.get(
    `${request.forwardX}|${request.forwardZ}`,
  ) ?? CARDINAL_CHUNK_OFFSETS;

  for (const offset of neighborOffsets) {
    enqueueBackgroundChunk(
      queue,
      visited,
      request.x + offset.x,
      request.z + offset.z,
      request.forwardX,
      request.forwardZ,
    );
  }
}

function appendInitializationTargetRing(queue, centerChunkX, centerChunkZ, radius) {
  if (radius === 0) {
    queue.push({
      key: chunkKey(centerChunkX, centerChunkZ),
      x: centerChunkX,
      z: centerChunkZ,
    });
    return;
  }

  for (let dx = -radius; dx <= radius; dx += 1) {
    queue.push({
      key: chunkKey(centerChunkX + dx, centerChunkZ - radius),
      x: centerChunkX + dx,
      z: centerChunkZ - radius,
    });
  }

  for (let dz = -radius + 1; dz <= radius; dz += 1) {
    queue.push({
      key: chunkKey(centerChunkX + radius, centerChunkZ + dz),
      x: centerChunkX + radius,
      z: centerChunkZ + dz,
    });
  }

  for (let dx = radius - 1; dx >= -radius; dx -= 1) {
    queue.push({
      key: chunkKey(centerChunkX + dx, centerChunkZ + radius),
      x: centerChunkX + dx,
      z: centerChunkZ + radius,
    });
  }

  for (let dz = radius - 1; dz >= -radius + 1; dz -= 1) {
    queue.push({
      key: chunkKey(centerChunkX - radius, centerChunkZ + dz),
      x: centerChunkX - radius,
      z: centerChunkZ + dz,
    });
  }
}

function ensureInitializationTargetQueueLength(targetIndex) {
  while (initializationAnchorState.targetQueue.length <= targetIndex) {
    appendInitializationTargetRing(
      initializationAnchorState.targetQueue,
      initializationAnchorState.originChunkX,
      initializationAnchorState.originChunkZ,
      initializationAnchorState.queuedRadius,
    );
    initializationAnchorState.queuedRadius += 1;
  }
}

function advanceInitializationAnchorTarget() {
  initializationAnchorState.targetCursor += 1;
  ensureInitializationTargetQueueLength(initializationAnchorState.targetCursor);
}

function getInitializationReturnState(player) {
  const raw = player.getDynamicProperty(INITIALIZATION_PLAYER_RETURN_PROPERTY);
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }

  return JSON.parse(raw);
}

function setInitializationReturnState(player, state) {
  player.setDynamicProperty(
    INITIALIZATION_PLAYER_RETURN_PROPERTY,
    JSON.stringify(state),
  );
}

function clearInitializationReturnState(player) {
  player.setDynamicProperty(INITIALIZATION_PLAYER_RETURN_PROPERTY, undefined);
}

function saveInitializationReturnState(player) {
  if (getInitializationReturnState(player)) {
    return;
  }

  setInitializationReturnState(
    player,
    {
      x: player.location.x,
      z: player.location.z,
      dimensionId: player.dimension.id,
    },
  );
}

function restoreInitializationReturnState(player) {
  const state = getInitializationReturnState(player);
  if (!state) {
    return false;
  }

  const dimension = world.getDimension(state.dimensionId);
  const returnChunk = getChunkForLocation(state);
  const loadingLocation = getInitializationLoadingLocation(returnChunk.x, returnChunk.z);
  const playerIsInReturnDimension = player.dimension.id === state.dimensionId;
  const playerChunk = playerIsInReturnDimension ? getPlayerChunk(player) : null;
  if (!populatedChunks.has(returnChunk.x, returnChunk.z)) {
    if (
      !playerIsInReturnDimension
      || !playerChunk
      || playerChunk.x !== returnChunk.x
      || playerChunk.z !== returnChunk.z
      || !isPlayerAtInitializationLoadingHeight(player)
    ) {
      player.teleport(
        loadingLocation,
        {
          dimension,
          checkForBlocks: false,
        },
      );
    }

    return false;
  }

  if (!teleportPlayerToTopmostLanding(player, dimension, state.x, state.z, false)) {
    return false;
  }

  clearInitializationReturnState(player);
  return true;
}

function clearInitializationAnchorState() {
  initializationAnchorState.playerId = "";
  initializationAnchorState.targetQueue = [];
  initializationAnchorState.targetCursor = 0;
  initializationAnchorState.queuedRadius = 0;
  initializationAnchorState.originChunkX = 0;
  initializationAnchorState.originChunkZ = 0;
}

function getInitializationAnchorPlayer(players) {
  if (!initializationAnchorState.playerId) {
    return null;
  }

  return players.find((player) => player.id === initializationAnchorState.playerId) ?? null;
}

function ensureInitializationAnchorPlayer(players) {
  let player = getInitializationAnchorPlayer(players);
  if (player) {
    return player;
  }

  player = players[0] ?? null;
  if (!player) {
    return null;
  }

  saveInitializationReturnState(player);
  initializationAnchorState.playerId = player.id;
  initializationAnchorState.originChunkX = 0;
  initializationAnchorState.originChunkZ = 0;
  initializationAnchorState.targetQueue = [];
  initializationAnchorState.targetCursor = 0;
  initializationAnchorState.queuedRadius = 0;
  ensureInitializationTargetQueueLength(0);
  return player;
}

function restoreInitializationPlayersFromProperties(players = world.getAllPlayers()) {
  let restoredCount = 0;

  for (const player of players) {
    if (restoreInitializationReturnState(player)) {
      restoredCount += 1;
    }
  }

  if (restoredCount > 0) {
    console.warn(
      `Restored ${restoredCount} player(s) from a previous initialization teleport state.`,
    );
  }
}

function captureBackgroundTaskState(task) {
  return {
    terrainStableCursor: task.terrainStableCursor,
    terrainStableY: task.terrainStableY,
    terrainDeferredCursor: task.terrainDeferredCursor,
    terrainDeferredY: task.terrainDeferredY,
    decorationPrepared: task.decorationPrepared,
    decorationTreeComplete: task.decorationTreeComplete,
    decorationStableCursor: task.decorationStableCursor,
    decorationDeferredCursor: task.decorationDeferredCursor,
  };
}

function didBackgroundTaskWriteWorld(beforeState, task) {
  const treeBatchWritten = beforeState.decorationTreeComplete === false
    && task.decorationTreeComplete === true;

  return (
    beforeState.terrainStableCursor !== task.terrainStableCursor
    || beforeState.terrainStableY !== task.terrainStableY
    || beforeState.terrainDeferredCursor !== task.terrainDeferredCursor
    || beforeState.terrainDeferredY !== task.terrainDeferredY
    || treeBatchWritten
    || beforeState.decorationStableCursor !== task.decorationStableCursor
    || beforeState.decorationDeferredCursor !== task.decorationDeferredCursor
  );
}

function didBackgroundTaskPrepareDecorationPlan(beforeState, task) {
  return !beforeState.decorationPrepared && task.decorationPrepared;
}

function isChunkInsideTickingArea(tickingAreaState, chunkX, chunkZ, radiusChunks) {
  if (!tickingAreaState.loaded) {
    return false;
  }

  return (
    Math.abs(chunkX - tickingAreaState.centerChunkX) <= radiusChunks
    && Math.abs(chunkZ - tickingAreaState.centerChunkZ) <= radiusChunks
  );
}

function moveTickingArea(dimension, tickingAreaState, chunkX, chunkZ, radiusChunks, tickingAreaName) {
  if (isChunkInsideTickingArea(tickingAreaState, chunkX, chunkZ, radiusChunks)) {
    return "ready";
  }

  if (tickingAreaState.busy) {
    return "pending";
  }

  tickingAreaState.busy = true;
  const centerX = getChunkCenterBlockX(chunkX);
  const centerZ = getChunkCenterBlockZ(chunkZ);
  const removeCommand = `tickingarea remove ${tickingAreaName}`;
  const addCommand = `tickingarea add circle ${centerX} ${BLOCK_ACCESS_SAMPLE_Y} ${centerZ} ${radiusChunks} ${tickingAreaName} true`;

  const moveCommand = tickingAreaState.loaded
    ? dimension.runCommandAsync(removeCommand)
      .then(() => dimension.runCommandAsync(addCommand))
    : dimension.runCommandAsync(addCommand);

  moveCommand
    .then(() => {
      tickingAreaState.loaded = true;
      tickingAreaState.centerChunkX = chunkX;
      tickingAreaState.centerChunkZ = chunkZ;
      tickingAreaState.busy = false;
    })
    .catch((error) => {
      tickingAreaState.loaded = false;
      tickingAreaState.busy = false;
      throw error;
    });

  return "pending";
}

function moveBackgroundTickingArea(dimension, chunkX, chunkZ) {
  return moveTickingArea(
    dimension,
    backgroundTickingAreaState,
    chunkX,
    chunkZ,
    BACKGROUND_TICKINGAREA_RADIUS_CHUNKS,
    BACKGROUND_TICKINGAREA_NAME,
  );
}

function writeRunBatch(
  dimension,
  chunkX,
  chunkZ,
  runs,
  startCursor,
  maxRuns,
  startY = null,
  maxVerticalBlocks = 0,
) {
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  if (maxVerticalBlocks > 0) {
    let cursor = startCursor;
    let nextY = startY;
    let progressed = false;
    let processedRuns = 0;

    while (cursor < runs.length && processedRuns < maxRuns) {
      const run = runs[cursor];
      const step = placeVerticalRunStep(
        dimension,
        startX + run.x,
        startZ + run.z,
        nextY ?? run.startY,
        run.endY,
        run.typeId,
        maxVerticalBlocks,
      );

      progressed = step.progressed || progressed;
      processedRuns += 1;

      if (!step.complete) {
        nextY = step.nextY;
        break;
      }

      cursor += 1;
      nextY = null;
    }

    return {
      cursor,
      nextY,
      progressed,
    };
  }

  const endCursor = Math.min(runs.length, startCursor + maxRuns);

  for (let cursor = startCursor; cursor < endCursor; cursor += 1) {
    const run = runs[cursor];
    placeVerticalRun(
      dimension,
      startX + run.x,
      startZ + run.z,
      run.startY,
      run.endY,
      run.typeId,
    );
  }

  return {
    cursor: endCursor,
    nextY: null,
    progressed: endCursor > startCursor,
  };
}

function writeListVolumeBatch(dimension, chunkX, chunkZ, runs, startCursor, maxRuns) {
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;
  const endCursor = Math.min(runs.length, startCursor + maxRuns);
  const locationsByType = new Map();

  for (let cursor = startCursor; cursor < endCursor; cursor += 1) {
    const run = runs[cursor];
    let locations = locationsByType.get(run.typeId);
    if (!locations) {
      locations = [];
      locationsByType.set(run.typeId, locations);
    }

    for (let y = run.startY; y <= run.endY; y += 1) {
      locations.push({ x: startX + run.x, y, z: startZ + run.z });
    }
  }

  for (const [typeId, locations] of locationsByType.entries()) {
    if (locations.length === 0) {
      continue;
    }

    dimension.fillBlocks(new ListBlockVolume(locations), getPermutation(typeId));
  }

  return {
    cursor: endCursor,
    progressed: endCursor > startCursor,
  };
}

function addTerrainChunk(chunkX, chunkZ) {
  terrainChunks.add(chunkX, chunkZ);
}

function logBackgroundChunkStarted(chunkX, chunkZ) {
  backgroundStartedChunkCount += 1;
  console.warn(
    `Background generation started chunk #${backgroundStartedChunkCount}: ${chunkX}, ${chunkZ}`,
  );
}

function logBackgroundChunkCompleted(chunkX, chunkZ) {
  backgroundCompletedChunkCount += 1;
  console.warn(
    `Background generation completed chunk #${backgroundCompletedChunkCount}: ${chunkX}, ${chunkZ}`,
  );
}

function ensureBackgroundTaskCompatibility(task) {
  if (!Array.isArray(task.decorationTreeRuns)) {
    task.decorationTreeRuns = [];
  }

  if (typeof task.decorationTreeComplete !== "boolean") {
    task.decorationTreeComplete = true;
  }

  if (!("backgroundDecorationSession" in task)) {
    task.backgroundDecorationSession = null;
  }

  if (!("decorationPlanBuilder" in task)) {
    task.decorationPlanBuilder = null;
  }
}

function canForegroundAdoptBackgroundTask(task, requiredPhase) {
  if (
    !task
    || !task.terrainChunk
    || task.backgroundTerrainSession
    || task.terrainPlanBuilder
    || task.backgroundDecorationSession
    || task.decorationPlanBuilder
  ) {
    return false;
  }

  if (requiredPhase === DETAIL_PHASE_TERRAIN) {
    return true;
  }

  return !task.decorationPrepared || task.decorationTreeComplete === true;
}

function tryPromoteBackgroundTaskToPending(key, requestPass, requiredPhase) {
  const task = backgroundChunkTasks.get(key);
  if (!canForegroundAdoptBackgroundTask(task, requiredPhase)) {
    return false;
  }

  ensureBackgroundTaskCompatibility(task);
  backgroundChunkTasks.delete(key);
  pendingChunkTasks.set(key, task);
  task.lastRequestedPass = requestPass;
  return true;
}

function getBackgroundBudgetCaps(backgroundExclusiveTicks) {
  let worldWritesPerTick = MAX_BACKGROUND_WORLD_WRITES_PER_TICK;
  let decorationPlansPerTick = MAX_BACKGROUND_DECORATION_PLANS_PER_TICK;

  if (backgroundExclusiveTicks >= BACKGROUND_IDLE_BUDGET_BOOST_TICKS) {
    worldWritesPerTick += 1;
  }

  if (backgroundExclusiveTicks >= BACKGROUND_DEEP_IDLE_BUDGET_BOOST_TICKS) {
    worldWritesPerTick += 1;
    decorationPlansPerTick += 1;
  }

  return {
    worldWritesPerTick,
    decorationPlansPerTick,
  };
}

function prepareChunkTask(chunkX, chunkZ, requestPass, skipTerrainWrite) {
  const key = chunkKey(chunkX, chunkZ);
  if (populatedChunks.has(chunkX, chunkZ) || pendingChunkTasks.has(key)) {
    return false;
  }

  const terrainChunk = activeGenerator.generateTerrainChunk(chunkX, chunkZ);
  const terrainWritePlan = skipTerrainWrite ? null : buildChunkWritePlan(terrainChunk);
  pendingChunkTasks.set(
    key,
    new PendingChunkTask(
      chunkX,
      chunkZ,
      terrainChunk,
      terrainWritePlan,
      requestPass,
      skipTerrainWrite,
    ),
  );
  return true;
}

function prepareBackgroundChunkTask(chunkX, chunkZ, requestPass, skipTerrainWrite) {
  const key = chunkKey(chunkX, chunkZ);
  if (
    populatedChunks.has(chunkX, chunkZ)
    || pendingChunkTasks.has(key)
    || backgroundChunkTasks.has(key)
  ) {
    return false;
  }

  backgroundChunkTasks.set(
    key,
    new BackgroundChunkTask(
      chunkX,
      chunkZ,
      requestPass,
      skipTerrainWrite,
    ),
  );
  ensureBackgroundTaskCompatibility(backgroundChunkTasks.get(key));
  logBackgroundChunkStarted(chunkX, chunkZ);
  return true;
}

function finishDecoratedChunk(task) {
  addTerrainChunk(task.chunkX, task.chunkZ);
  populatedChunks.add(task.chunkX, task.chunkZ);
  pendingChunkTasks.delete(task.key);
}

function finishBackgroundDecoratedChunk(task) {
  addTerrainChunk(task.chunkX, task.chunkZ);
  populatedChunks.add(task.chunkX, task.chunkZ);
  backgroundChunkTasks.delete(task.key);
  logBackgroundChunkCompleted(task.chunkX, task.chunkZ);
}

function handOffPendingChunkTasksToBackground(currentPass) {
  for (const task of Array.from(pendingChunkTasks.values())) {
    if (task.lastRequestedPass === currentPass || isTaskComplete(task)) {
      continue;
    }

    pendingChunkTasks.delete(task.key);
    ensureBackgroundTaskCompatibility(task);
    backgroundChunkTasks.set(task.key, task);
    logBackgroundChunkStarted(task.chunkX, task.chunkZ);
  }
}

function prepareDecorationPlan(task) {
  const decoratedChunk = activeGenerator.decorateTerrainChunk(task.terrainChunk, {
    rebuildHeightmap: false,
  });
  const decorationPlan = buildDeltaWritePlan(task.terrainBlocks, decoratedChunk.blocks);
  task.decorationStableRuns = decorationPlan.stableRuns;
  task.decorationDeferredRuns = decorationPlan.deferredRuns;
  task.decorationPrepared = true;
}

function advanceBackgroundChunkTask(dimension, task) {
  const startX = task.chunkX * CHUNK_SIZE;
  const startZ = task.chunkZ * CHUNK_SIZE;

  if (!isChunkWritable(dimension, startX, startZ)) {
    return false;
  }

  if (!task.terrainChunk) {
    const terrainProgressed = activeGenerator.advanceBackgroundTerrainSession(task.backgroundTerrainSession);
    if (!terrainProgressed) {
      return false;
    }

    if (task.backgroundTerrainSession.complete) {
      task.terrainChunk = task.backgroundTerrainSession.terrainChunk;
      task.terrainBlocks = task.terrainChunk.blocks;
      task.backgroundTerrainSession = null;
      if (task.skipTerrainWrite) {
        task.terrainComplete = true;
      } else {
        task.terrainPlanBuilder = createChunkWritePlanBuilder(task.terrainChunk);
      }
    }

    return true;
  }

  if (!task.terrainComplete) {
    if (task.terrainPlanBuilder && !task.terrainPlanBuilder.complete) {
      if (!advanceChunkWritePlanBuilder(task.terrainPlanBuilder, 1)) {
        return false;
      }

      if (task.terrainPlanBuilder.complete) {
        task.terrainStableRuns = task.terrainPlanBuilder.stableRuns;
        task.terrainDeferredRuns = task.terrainPlanBuilder.deferredRuns;
        task.terrainPlanBuilder = null;
      }
      return true;
    }

    if (task.terrainStableCursor < task.terrainStableRuns.length) {
      const terrainStableStep = writeRunBatch(
        dimension,
        task.chunkX,
        task.chunkZ,
        task.terrainStableRuns,
        task.terrainStableCursor,
        BACKGROUND_STEP_LIMITS.terrainStableRunsPerStep,
        task.terrainStableY,
        BACKGROUND_STEP_LIMITS.verticalBlocksPerOperation ?? 0,
      );
      task.terrainStableCursor = terrainStableStep.cursor;
      task.terrainStableY = terrainStableStep.nextY;
      if (terrainStableStep.progressed) {
        task.hasWorldWrites = true;
      }
      return terrainStableStep.progressed;
    }

    if (task.terrainDeferredCursor < task.terrainDeferredRuns.length) {
      const terrainDeferredStep = writeRunBatch(
        dimension,
        task.chunkX,
        task.chunkZ,
        task.terrainDeferredRuns,
        task.terrainDeferredCursor,
        BACKGROUND_STEP_LIMITS.terrainDeferredRunsPerStep,
        task.terrainDeferredY,
        BACKGROUND_STEP_LIMITS.verticalBlocksPerOperation ?? 0,
      );
      task.terrainDeferredCursor = terrainDeferredStep.cursor;
      task.terrainDeferredY = terrainDeferredStep.nextY;
      if (terrainDeferredStep.progressed) {
        task.hasWorldWrites = true;
      }
      return terrainDeferredStep.progressed;
    }

    task.terrainComplete = true;
    addTerrainChunk(task.chunkX, task.chunkZ);
    return true;
  }

  if (!task.backgroundDecorationSession && !task.decorationPrepared) {
    task.backgroundDecorationSession = activeGenerator.createBackgroundDecorationSession(task.terrainChunk);
    return true;
  }

  if (!task.decorationPrepared) {
    if (task.backgroundDecorationSession && !task.backgroundDecorationSession.complete) {
      return activeGenerator.advanceBackgroundDecorationSession(task.backgroundDecorationSession);
    }

    if (task.backgroundDecorationSession && task.backgroundDecorationSession.complete && !task.decorationPlanBuilder) {
      const decoratedBlocks = task.backgroundDecorationSession.decoratedBlocks ?? task.terrainBlocks;
      task.decorationPlanBuilder = createDeltaWritePlanBuilder(task.terrainBlocks, decoratedBlocks);
      task.backgroundDecorationSession = null;
      return true;
    }

    if (task.decorationPlanBuilder && !task.decorationPlanBuilder.complete) {
      if (!advanceDeltaWritePlanBuilder(task.decorationPlanBuilder, 1)) {
        return false;
      }

      if (task.decorationPlanBuilder.complete) {
        const decorationRuns = partitionTreeDecorationRuns(
          task.decorationPlanBuilder.stableRuns,
          task.decorationPlanBuilder.deferredRuns,
        );
        task.decorationTreeRuns = decorationRuns.treeRuns;
        task.decorationTreeComplete = task.decorationTreeRuns.length === 0;
        task.decorationStableRuns = decorationRuns.stableRuns;
        task.decorationDeferredRuns = decorationRuns.deferredRuns;
        task.decorationPrepared = true;
        task.decorationPlanBuilder = null;

        if (
          task.decorationTreeComplete
          && task.decorationStableRuns.length === 0
          && task.decorationDeferredRuns.length === 0
        ) {
          finishBackgroundDecoratedChunk(task);
        }
      }

      return true;
    }
  }

  if (!task.decorationTreeComplete) {
    const decorationTreeStep = writeListVolumeBatch(
      dimension,
      task.chunkX,
      task.chunkZ,
      task.decorationTreeRuns,
      0,
      task.decorationTreeRuns.length,
    );
    if (decorationTreeStep.progressed) {
      task.hasWorldWrites = true;
      task.decorationTreeComplete = true;
    }

    if (
      task.decorationTreeComplete
      && task.decorationStableRuns.length === 0
      && task.decorationDeferredRuns.length === 0
    ) {
      finishBackgroundDecoratedChunk(task);
    }

    return decorationTreeStep.progressed;
  }

  if (task.decorationStableCursor < task.decorationStableRuns.length) {
    const decorationStableStep = writeListVolumeBatch(
      dimension,
      task.chunkX,
      task.chunkZ,
      task.decorationStableRuns,
      task.decorationStableCursor,
      BACKGROUND_STEP_LIMITS.decorationStableRunsPerStep,
    );
    task.decorationStableCursor = decorationStableStep.cursor;
    if (decorationStableStep.progressed) {
      task.hasWorldWrites = true;
    }
    if (isTaskComplete(task)) {
      finishBackgroundDecoratedChunk(task);
    }
    return decorationStableStep.progressed;
  }

  if (task.decorationDeferredCursor < task.decorationDeferredRuns.length) {
    const decorationDeferredStep = writeListVolumeBatch(
      dimension,
      task.chunkX,
      task.chunkZ,
      task.decorationDeferredRuns,
      task.decorationDeferredCursor,
      BACKGROUND_STEP_LIMITS.decorationDeferredRunsPerStep,
    );
    task.decorationDeferredCursor = decorationDeferredStep.cursor;
    if (decorationDeferredStep.progressed) {
      task.hasWorldWrites = true;
    }
    if (isTaskComplete(task)) {
      finishBackgroundDecoratedChunk(task);
    }
    return decorationDeferredStep.progressed;
  }

  finishBackgroundDecoratedChunk(task);
  return true;
}

function advanceChunkTask(
  dimension,
  task,
  requiredPhase,
  stepLimits = FOREGROUND_STEP_LIMITS,
) {
  const startX = task.chunkX * CHUNK_SIZE;
  const startZ = task.chunkZ * CHUNK_SIZE;

  if (!isChunkWritable(dimension, startX, startZ)) {
    return false;
  }

  let progressed = false;
  if (!task.terrainComplete) {
    if (task.terrainStableCursor < task.terrainStableRuns.length) {
      const terrainStableStep = writeRunBatch(
        dimension,
        task.chunkX,
        task.chunkZ,
        task.terrainStableRuns,
        task.terrainStableCursor,
        stepLimits.terrainStableRunsPerStep,
        task.terrainStableY,
        stepLimits.verticalBlocksPerOperation ?? 0,
      );
      task.terrainStableCursor = terrainStableStep.cursor;
      task.terrainStableY = terrainStableStep.nextY;
      if (terrainStableStep.progressed) {
        task.hasWorldWrites = true;
      }
      progressed = terrainStableStep.progressed || progressed;

      if (progressed && stepLimits.singleOperationPerCall) {
        return progressed;
      }

      if (task.terrainStableCursor < task.terrainStableRuns.length) {
        return progressed;
      }
    }

    if (task.terrainDeferredCursor < task.terrainDeferredRuns.length) {
      const terrainDeferredStep = writeRunBatch(
        dimension,
        task.chunkX,
        task.chunkZ,
        task.terrainDeferredRuns,
        task.terrainDeferredCursor,
        stepLimits.terrainDeferredRunsPerStep,
        task.terrainDeferredY,
        stepLimits.verticalBlocksPerOperation ?? 0,
      );
      task.terrainDeferredCursor = terrainDeferredStep.cursor;
      task.terrainDeferredY = terrainDeferredStep.nextY;
      if (terrainDeferredStep.progressed) {
        task.hasWorldWrites = true;
      }
      progressed = terrainDeferredStep.progressed || progressed;

      if (progressed && stepLimits.singleOperationPerCall) {
        return progressed;
      }

      if (task.terrainDeferredCursor < task.terrainDeferredRuns.length) {
        return progressed;
      }
    }

    task.terrainComplete = true;
    addTerrainChunk(task.chunkX, task.chunkZ);
    progressed = true;

    if (stepLimits.singleOperationPerCall) {
      return progressed;
    }

    if (requiredPhase !== DETAIL_PHASE_COMPLETE) {
      return progressed;
    }
  }

  if (requiredPhase !== DETAIL_PHASE_COMPLETE) {
    return progressed;
  }

  if (!task.decorationPrepared) {
    prepareDecorationPlan(task);
    progressed = true;

    if (
      task.decorationStableRuns.length === 0
      && task.decorationDeferredRuns.length === 0
    ) {
      finishDecoratedChunk(task);
      return true;
    }

    if (stepLimits.singleOperationPerCall) {
      return true;
    }
  }

  if (task.decorationStableCursor < task.decorationStableRuns.length) {
    const decorationStableStep = writeListVolumeBatch(
      dimension,
      task.chunkX,
      task.chunkZ,
      task.decorationStableRuns,
      task.decorationStableCursor,
      stepLimits.decorationStableRunsPerStep,
    );
    task.decorationStableCursor = decorationStableStep.cursor;
    if (decorationStableStep.progressed) {
      task.hasWorldWrites = true;
    }
    progressed = decorationStableStep.progressed || progressed;

    if (progressed && stepLimits.singleOperationPerCall) {
      return progressed;
    }

    if (task.decorationStableCursor < task.decorationStableRuns.length) {
      return progressed;
    }
  }

  if (task.decorationDeferredCursor < task.decorationDeferredRuns.length) {
    const decorationDeferredStep = writeListVolumeBatch(
      dimension,
      task.chunkX,
      task.chunkZ,
      task.decorationDeferredRuns,
      task.decorationDeferredCursor,
      stepLimits.decorationDeferredRunsPerStep,
    );
    task.decorationDeferredCursor = decorationDeferredStep.cursor;
    if (decorationDeferredStep.progressed) {
      task.hasWorldWrites = true;
    }
    progressed = decorationDeferredStep.progressed || progressed;

    if (progressed && stepLimits.singleOperationPerCall) {
      return progressed;
    }

    if (task.decorationDeferredCursor < task.decorationDeferredRuns.length) {
      return progressed;
    }
  }

  finishDecoratedChunk(task);
  return true;
}

function prunePendingChunkTasks(currentPass) {
  if (pendingChunkTasks.size <= MAX_PENDING_CHUNK_TASKS) {
    return;
  }

  const removableTasks = Array.from(pendingChunkTasks.values())
    .filter((task) => task.lastRequestedPass !== currentPass && !task.hasWorldWrites)
    .sort((left, right) => left.lastRequestedPass - right.lastRequestedPass);

  for (const task of removableTasks) {
    if (pendingChunkTasks.size <= MAX_PENDING_CHUNK_TASKS) {
      break;
    }
    pendingChunkTasks.delete(task.key);
  }
}

function pruneBackgroundChunkTasks(currentPass) {
  if (backgroundChunkTasks.size <= MAX_PENDING_CHUNK_TASKS) {
    return;
  }

  const removableTasks = Array.from(backgroundChunkTasks.values())
    .filter((task) => task.lastRequestedPass !== currentPass && !task.hasWorldWrites)
    .sort((left, right) => left.lastRequestedPass - right.lastRequestedPass);

  for (const task of removableTasks) {
    if (backgroundChunkTasks.size <= MAX_PENDING_CHUNK_TASKS) {
      break;
    }
    backgroundChunkTasks.delete(task.key);
  }
}

function triggerInitializationWindow(players = world.getAllPlayers()) {
  world.setDynamicProperty(INITIALIZATION_TRIGGERED_PROPERTY, true);
  initializationStartedAtMs = Date.now();
  initializationLastReportedAtMs = initializationStartedAtMs;
  initializationDeadlineMs = initializationStartedAtMs + INITIALIZATION_MAX_DURATION_MS;
  initializationCompletedChunkCount = 0;
  initializationWindowRunning = true;
  initializationReturnPending = false;
  initializationFinishReason = "";
  clearInitializationAnchorState();
  ensureInitializationAnchorPlayer(players);
  console.warn(
    `Initialization generation started: fixed duration ${INITIALIZATION_MAX_DURATION_MS}ms.`,
  );
}

function reportInitializationProgress(force = false) {
  if (!initializationWindowRunning && !initializationReturnPending) {
    return;
  }

  const now = Date.now();
  if (!force && (now - initializationLastReportedAtMs) < INITIALIZATION_PROGRESS_REPORT_INTERVAL_MS) {
    return;
  }

  initializationLastReportedAtMs = now;
  const elapsedMs = Math.max(0, now - initializationStartedAtMs);
  console.warn(
    `Initialization generation progress: ${initializationCompletedChunkCount} populated chunks completed in ${elapsedMs}/${INITIALIZATION_MAX_DURATION_MS}ms.`,
  );
}

function finishInitializationWindow(reason) {
  if (!initializationWindowRunning && !initializationReturnPending) {
    return;
  }

  const elapsedMs = Math.max(0, Date.now() - initializationStartedAtMs);
  reportInitializationProgress(true);
  initializationWindowRunning = false;
  initializationReturnPending = false;
  initializationFinishReason = "";
  initializationDeadlineMs = 0;
  clearInitializationAnchorState();
  console.warn(
    `Initialization generation finished (${reason}): ${initializationCompletedChunkCount} populated chunks completed in ${elapsedMs}ms.`,
  );
}

function beginInitializationReturnPhase(reason, players = world.getAllPlayers()) {
  if (initializationReturnPending) {
    return;
  }

  initializationWindowRunning = false;
  initializationReturnPending = true;
  initializationFinishReason = reason;
  initializationDeadlineMs = 0;

  const anchorPlayer = getInitializationAnchorPlayer(players);
  if (!anchorPlayer) {
    finishInitializationWindow(reason);
    return;
  }

  if (advanceInitializationReturnState(anchorPlayer)) {
    finishInitializationWindow(reason);
  }
}

function recordInitializationChunkCompletion() {
  if (!initializationWindowRunning) {
    return;
  }

  initializationCompletedChunkCount += 1;
}

function isInitializationBusy() {
  return initializationWindowRunning || initializationReturnPending;
}

function updateInitializationTriggerState() {
  const players = world.getAllPlayers();
  const playerCount = players.length;
  if (playerCount === 0) {
    observedPlayerCount = 0;
    finishInitializationWindow("no players online");
    return;
  }

  if (initializationReturnPending) {
    const anchorPlayer = getInitializationAnchorPlayer(players);
    if (!anchorPlayer || advanceInitializationReturnState(anchorPlayer)) {
      finishInitializationWindow(initializationFinishReason || "duration reached");
    }
    observedPlayerCount = playerCount;
    return;
  }

  if (!initializationWindowRunning) {
    restoreInitializationPlayersFromProperties(players);
  }

  if (observedPlayerCount === 0 && world.getDynamicProperty(INITIALIZATION_TRIGGERED_PROPERTY) !== true) {
    triggerInitializationWindow(players);
  }

  observedPlayerCount = playerCount;
}

function getActiveInitializationPlayers() {
  if (!initializationWindowRunning || initializationReturnPending) {
    return [];
  }

  if (initializationDeadlineMs <= Date.now()) {
    beginInitializationReturnPhase("duration reached");
    return [];
  }

  const players = world.getAllPlayers();
  if (players.length === 0) {
    observedPlayerCount = 0;
    finishInitializationWindow("no players online");
    return [];
  }

  return players;
}

function getCurrentInitializationAnchorTarget() {
  ensureInitializationTargetQueueLength(initializationAnchorState.targetCursor);
  return initializationAnchorState.targetQueue[initializationAnchorState.targetCursor];
}

function ensureInitializationAnchorAtTarget(player, dimension, target) {
  const loadingLocation = getInitializationLoadingLocation(target.x, target.z);
  const playerIsInTargetDimension = player.dimension.id === dimension.id;
  const playerChunk = playerIsInTargetDimension ? getPlayerChunk(player) : null;
  if (
    !playerIsInTargetDimension
    || !playerChunk
    || playerChunk.x !== target.x
    || playerChunk.z !== target.z
    || !isPlayerAtInitializationLoadingHeight(player)
  ) {
    player.teleport(
      loadingLocation,
      {
        dimension,
        checkForBlocks: false,
      },
    );
    return false;
  }

  return true;
}

function advanceInitializationChunkTarget(dimension, target) {
  const chunkState = getChunkState(target.x, target.z);
  if (chunkState.hasPopulatedChunk) {
    return true;
  }

  const startX = target.x * CHUNK_SIZE;
  const startZ = target.z * CHUNK_SIZE;
  if (!isChunkWritable(dimension, startX, startZ)) {
    return false;
  }

  let task = pendingChunkTasks.get(target.key);
  if (!task && backgroundChunkTasks.has(target.key)) {
    if (!tryPromoteBackgroundTaskToPending(
      target.key,
      generationPass,
      DETAIL_PHASE_COMPLETE,
    )) {
      backgroundChunkTasks.delete(target.key);
    }
    task = pendingChunkTasks.get(target.key);
  }

  if (!task) {
    prepareChunkTask(
      target.x,
      target.z,
      generationPass,
      chunkState.hasTerrainOnlyChunk,
    );
    task = pendingChunkTasks.get(target.key);
  }

  if (!task) {
    return false;
  }

  task.lastRequestedPass = generationPass;
  let remainingChunkSteps = INITIALIZATION_MAX_CHUNK_STEPS_PER_TICK;
  while (remainingChunkSteps > 0 && task && !isTaskComplete(task)) {
    const progressed = advanceChunkTask(
      dimension,
      task,
      DETAIL_PHASE_COMPLETE,
      INITIALIZATION_STEP_LIMITS,
    );
    if (!progressed) {
      break;
    }

    remainingChunkSteps -= 1;
    task = pendingChunkTasks.get(target.key);
    if (task) {
      task.lastRequestedPass = generationPass;
    }
  }

  return populatedChunks.has(target.x, target.z);
}

function advanceInitializationReturnState(player) {
  const state = getInitializationReturnState(player);
  if (!state) {
    return true;
  }

  const dimension = world.getDimension(state.dimensionId);
  const returnChunk = getChunkForLocation(state);
  const target = {
    key: chunkKey(returnChunk.x, returnChunk.z),
    x: returnChunk.x,
    z: returnChunk.z,
  };

  if (!ensureInitializationAnchorAtTarget(player, dimension, target)) {
    return false;
  }

  if (state.dimensionId === "overworld" && !advanceInitializationChunkTarget(dimension, target)) {
    return false;
  }

  if (!teleportPlayerToTopmostLanding(player, dimension, state.x, state.z, false)) {
    return false;
  }

  clearInitializationReturnState(player);
  return true;
}

function advanceInitializationAnchorMovement(players) {
  const anchorPlayer = ensureInitializationAnchorPlayer(players);
  if (!anchorPlayer) {
    return;
  }

  const dimension = world.getDimension("overworld");
  const target = getCurrentInitializationAnchorTarget();
  ensureInitializationAnchorAtTarget(anchorPlayer, dimension, target);
}

function* initializationAnchorMovementJob() {
  while (true) {
    const players = getActiveInitializationPlayers();
    if (players.length === 0) {
      yield;
      continue;
    }

    advanceInitializationAnchorMovement(players);
    yield;
  }
}

function* initializationGenerationJob() {
  while (true) {
    const players = getActiveInitializationPlayers();
    if (players.length === 0) {
      yield;
      continue;
    }

    reportInitializationProgress();

    const anchorPlayer = ensureInitializationAnchorPlayer(players);
    if (!anchorPlayer) {
      yield;
      continue;
    }

    const dimension = world.getDimension("overworld");
    const currentTarget = getCurrentInitializationAnchorTarget();
    if (!ensureInitializationAnchorAtTarget(anchorPlayer, dimension, currentTarget)) {
      yield;
      continue;
    }

    if (getChunkState(currentTarget.x, currentTarget.z).hasPopulatedChunk) {
      if (isInitializationTargetComplete(dimension, currentTarget)) {
        recordInitializationChunkCompletion();
        advanceInitializationAnchorTarget();
      }
      yield;
      continue;
    }

    if (
      advanceInitializationChunkTarget(dimension, currentTarget)
      && isInitializationTargetComplete(dimension, currentTarget)
    ) {
      recordInitializationChunkCompletion();
      advanceInitializationAnchorTarget();
    }

    yield;
  }
}

function* idleBackgroundGenerationJob() {
  let playerSignature = "";
  let boundaryWarningSignature = "";
  let scanQueue = [];
  let scanVisited = new Set();
  let scanCursor = 0;
  let budgetTick = -1;
  let backgroundExclusiveTick = -1;
  let backgroundExclusiveTicks = 0;
  let backgroundWorldWritesThisTick = 0;
  let backgroundDecorationPlansThisTick = 0;

  while (true) {
    if (budgetTick !== backgroundTickSequence) {
      budgetTick = backgroundTickSequence;
      backgroundWorldWritesThisTick = 0;
      backgroundDecorationPlansThisTick = 0;
    }

    if (backgroundExclusiveTick !== budgetTick) {
      backgroundExclusiveTick = budgetTick;
      backgroundExclusiveTicks += 1;
    }

    const backgroundBudgetCaps = getBackgroundBudgetCaps(backgroundExclusiveTicks);
    if (
      backgroundWorldWritesThisTick >= backgroundBudgetCaps.worldWritesPerTick
      || backgroundDecorationPlansThisTick >= backgroundBudgetCaps.decorationPlansPerTick
    ) {
      yield;
      continue;
    }

    if (isInitializationBusy()) {
      backgroundExclusiveTick = -1;
      backgroundExclusiveTicks = 0;
      playerSignature = "";
      boundaryWarningSignature = "";
      scanQueue = [];
      scanVisited = new Set();
      scanCursor = 0;
      yield;
      continue;
    }

    if (foregroundDemandActive) {
      backgroundExclusiveTick = -1;
      backgroundExclusiveTicks = 0;
      playerSignature = "";
      boundaryWarningSignature = "";
      scanQueue = [];
      scanVisited = new Set();
      scanCursor = 0;
      yield;
      continue;
    }

    const players = world.getAllPlayers();
    if (players.length === 0) {
      backgroundExclusiveTick = -1;
      backgroundExclusiveTicks = 0;
      playerSignature = "";
      boundaryWarningSignature = "";
      scanQueue = [];
      scanVisited = new Set();
      scanCursor = 0;
      yield;
      continue;
    }

    const nextPlayerSignature = getPlayerChunkSignature(players);
    if (nextPlayerSignature !== playerSignature) {
      playerSignature = nextPlayerSignature;
      boundaryWarningSignature = "";
      const backgroundScan = createBackgroundScanQueue(players);
      scanQueue = backgroundScan.queue;
      scanVisited = backgroundScan.visited;
      scanCursor = 0;
    }

    if (scanCursor >= scanQueue.length) {
      if (boundaryWarningSignature !== playerSignature) {
        console.warn(
          `Background generation reached the current script-accessible chunk boundary for ${playerSignature || "active players"} and is waiting for more chunks to become writable.`,
        );
        boundaryWarningSignature = playerSignature;
      }

      const backgroundScan = createBackgroundScanQueue(players);
      scanQueue = backgroundScan.queue;
      scanVisited = backgroundScan.visited;
      scanCursor = 0;
      yield;
      continue;
    }

    const dimension = world.getDimension("overworld");
    const request = scanQueue[scanCursor];
    scanCursor += 1;

    const startX = request.x * CHUNK_SIZE;
    const startZ = request.z * CHUNK_SIZE;
    if (!isChunkWritable(dimension, startX, startZ)) {
      const tickingAreaState = moveBackgroundTickingArea(dimension, request.x, request.z);
      if (tickingAreaState === "pending" || tickingAreaState === "ready") {
        scanCursor -= 1;
      }
      yield;
      continue;
    }

    enqueueBackgroundNeighbors(scanQueue, scanVisited, request);

    const chunkState = getChunkState(request.x, request.z);
    if (chunkState.hasPopulatedChunk) {
      yield;
      continue;
    }

    if (pendingChunkTasks.has(request.key)) {
      yield;
      continue;
    }

    let task = backgroundChunkTasks.get(request.key);
    if (task) {
      task.lastRequestedPass = generationPass;
    }

    if (!task) {
      if (!prepareBackgroundChunkTask(
        request.x,
        request.z,
        generationPass,
        chunkState.hasTerrainOnlyChunk,
      )) {
        yield;
        continue;
      }

      task = backgroundChunkTasks.get(request.key);
      if (task) {
        task.lastRequestedPass = generationPass;
      }
      yield;
    }

    while (task && !isTaskComplete(task)) {
      if (foregroundDemandActive) {
        break;
      }

      const stepBeforeState = captureBackgroundTaskState(task);
      const stepProgressed = advanceBackgroundChunkTask(dimension, task);
      if (!stepProgressed) {
        break;
      }

      if (didBackgroundTaskPrepareDecorationPlan(stepBeforeState, task)) {
        backgroundDecorationPlansThisTick += 1;
      }
      if (didBackgroundTaskWriteWorld(stepBeforeState, task)) {
        backgroundWorldWritesThisTick += 1;
      }

      yield;
      task = backgroundChunkTasks.get(request.key);
      if (task) {
        task.lastRequestedPass = generationPass;
      }
    }
  }
}

system.runInterval(() => {
  backgroundTickSequence += 1;
}, 1);

system.run(() => {
  restoreInitializationPlayersFromProperties();
});

world.afterEvents.playerSpawn.subscribe((event) => {
  system.run(() => {
    restoreInitializationReturnState(event.player);
  });
});

system.runInterval(() => {
  updateInitializationTriggerState();
}, 1);

system.runJob(initializationAnchorMovementJob());
system.runJob(initializationGenerationJob());
system.runJob(idleBackgroundGenerationJob());

system.runInterval(() => {
  if (isInitializationBusy()) {
    foregroundDemandActive = false;
    return;
  }

  const players = world.getAllPlayers();
  foregroundDemandActive = true;
  if (players.length === 0) {
    foregroundDemandActive = false;
    return;
  }

  generationPass += 1;
  const dimension = world.getDimension("overworld");
  const requestedChunks = new Map();

  for (const player of players) {
    const center = getPlayerChunk(player);

    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx += 1) {
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz += 1) {
        const targetX = center.x + dx;
        const targetZ = center.z + dz;
        const key = chunkKey(targetX, targetZ);
        const distance = Math.hypot(dx, dz);
        const existing = requestedChunks.get(key);

        if (!existing || distance < existing.distance) {
          requestedChunks.set(key, {
            key,
            x: targetX,
            z: targetZ,
            distance,
            requiredPhase: getRequiredDetailPhase(distance),
          });
        }
      }
    }
  }

  const generationQueue = [];
  for (const request of requestedChunks.values()) {
    const chunkState = getChunkState(request.x, request.z);
    if (chunkState.hasPopulatedChunk) {
      continue;
    }

    const task = pendingChunkTasks.get(chunkState.key);
    if (task) {
      task.lastRequestedPass = generationPass;
    }

    if (request.requiredPhase === DETAIL_PHASE_TERRAIN) {
      if ((task && isTaskTerrainComplete(task)) || chunkState.hasTerrainOnlyChunk) {
        continue;
      }
    } else if (task && isTaskComplete(task)) {
      continue;
    }

    generationQueue.push({
      ...request,
      skipTerrainWrite: chunkState.hasTerrainOnlyChunk,
    });
  }

  const foregroundPriorityContexts = createForegroundPriorityContexts(players, generationQueue);
  for (const request of generationQueue) {
    const sortData = getForegroundRequestSortData(request, foregroundPriorityContexts);
    request.sortRank = sortData.rank;
    request.sortContextualDistance = sortData.contextualDistance;
  }

  generationQueue.sort((left, right) => {
    if (left.sortRank !== right.sortRank) {
      return left.sortRank - right.sortRank;
    }
    if (left.sortContextualDistance !== right.sortContextualDistance) {
      return left.sortContextualDistance - right.sortContextualDistance;
    }
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    if (left.x !== right.x) {
      return left.x - right.x;
    }
    return left.z - right.z;
  });
  foregroundDemandActive = generationQueue.length > 0;

  let preparedThisTick = 0;
  for (const request of generationQueue) {
    if (preparedThisTick >= MAX_PREPARE_PER_TICK) {
      break;
    }
    if (pendingChunkTasks.has(request.key)) {
      continue;
    }
    if (backgroundChunkTasks.has(request.key)) {
      if (!tryPromoteBackgroundTaskToPending(
        request.key,
        generationPass,
        request.requiredPhase,
      )) {
        backgroundChunkTasks.delete(request.key);
      }
    }

    if (pendingChunkTasks.has(request.key)) {
      continue;
    }

    if (prepareChunkTask(
      request.x,
      request.z,
      generationPass,
      request.skipTerrainWrite,
    )) {
      preparedThisTick += 1;
    }
  }

  let remainingChunkSteps = MAX_ACTIVE_CHUNK_STEPS_PER_TICK;
  for (const request of generationQueue) {
    if (remainingChunkSteps <= 0) {
      break;
    }

    const task = pendingChunkTasks.get(request.key);
    if (!task) {
      continue;
    }

    const maxStepsForChunk = request.requiredPhase === DETAIL_PHASE_COMPLETE
      ? Math.min(MAX_NEAR_CHUNK_STEPS_PER_TICK, remainingChunkSteps)
      : 1;

    let usedSteps = 0;
    while (usedSteps < maxStepsForChunk && remainingChunkSteps > 0) {
      if (request.requiredPhase === DETAIL_PHASE_TERRAIN && isTaskTerrainComplete(task)) {
        break;
      }
      if (request.requiredPhase === DETAIL_PHASE_COMPLETE && isTaskComplete(task)) {
        break;
      }

      const progressed = advanceChunkTask(dimension, task, request.requiredPhase);
      if (!progressed) {
        break;
      }

      usedSteps += 1;
      remainingChunkSteps -= 1;
    }
  }

  handOffPendingChunkTasksToBackground(generationPass);
  prunePendingChunkTasks(generationPass);
  pruneBackgroundChunkTasks(generationPass);
}, GENERATION_INTERVAL_TICKS);

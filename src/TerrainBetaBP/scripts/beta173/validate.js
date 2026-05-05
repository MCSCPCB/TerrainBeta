import {
  BEDROCK_BLOCK_MAP,
  Beta173Generator,
  Beta173BedrockGenerator,
  BLOCKS,
  DEFAULT_FARLANDS_COORDINATE,
  getFarlandsCoordinate,
  setFarlandsCoordinate,
} from "./index.js";

const CORE_REFERENCE_CASES = [
  ["90389547180974", 6, -3],
  ["123456789", 0, 0],
  ["123456789", 784425, 0],
];

const DECORATED_REFERENCE_CASES = [
  ["123456789", 0, 0],
  ["123456789", 7, -9],
  ["90389547180974", 6, -3],
  ["123456789", 784426, 0],
];

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function advanceSessionToCompletion(session, advance, label, maxSteps = 20000) {
  let steps = 0;
  while (!session.complete) {
    if (!advance(session)) {
      throw new Error(`${label} stalled before completion`);
    }
    steps += 1;
    if (steps > maxSteps) {
      throw new Error(`${label} exceeded ${maxSteps} steps`);
    }
  }
}

function assertMappedBlocks(chunk, label) {
  for (const blockId of chunk.blocks) {
    if (!(blockId in BEDROCK_BLOCK_MAP)) {
      throw new Error(`${label} uses unmapped block id ${blockId}`);
    }
  }
}

function assertUndecoratedPassthrough() {
  console.log("Undecorated passthrough checks");

  for (const [seed, chunkX, chunkZ] of CORE_REFERENCE_CASES) {
    const base = new Beta173Generator(seed).generateChunk(chunkX, chunkZ);
    const wrapped = new Beta173BedrockGenerator(seed, {
      caves: false,
      dungeons: false,
      clay: false,
      ores: false,
      lakes: false,
      trees: false,
      flora: false,
      springs: false,
      snow: false,
    }).generateChunk(chunkX, chunkZ);

    if (!arraysEqual(base.blocks, wrapped.blocks)) {
      throw new Error(`base block mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }
    if (!arraysEqual(base.heightmap, wrapped.heightmap)) {
      throw new Error(`base heightmap mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }
    if (!arraysEqual(base.heightmap, wrapped.terrainHeightmap)) {
      throw new Error(`terrain heightmap mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }
    if (!arraysEqual(base.biomes, wrapped.biomes)) {
      throw new Error(`base biome mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }

    console.log(`  PASS ${seed} @ (${chunkX}, ${chunkZ})`);
  }
}

function assertDecoratedDeterminism() {
  console.log("Decorated determinism checks");

  for (const [seed, chunkX, chunkZ] of DECORATED_REFERENCE_CASES) {
    const first = new Beta173BedrockGenerator(seed).generateChunk(chunkX, chunkZ);
    const second = new Beta173BedrockGenerator(seed).generateChunk(chunkX, chunkZ);

    if (!arraysEqual(first.blocks, second.blocks)) {
      throw new Error(`decorated block mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }
    if (!arraysEqual(first.heightmap, second.heightmap)) {
      throw new Error(`decorated heightmap mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }
    if (!arraysEqual(first.terrainHeightmap, second.terrainHeightmap)) {
      throw new Error(`decorated terrain heightmap mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }
    if (!arraysEqual(first.biomes, second.biomes)) {
      throw new Error(`decorated biome mismatch for seed ${seed} chunk (${chunkX}, ${chunkZ})`);
    }

    assertMappedBlocks(first, `chunk (${chunkX}, ${chunkZ})`);
    console.log(`  PASS ${seed} @ (${chunkX}, ${chunkZ})`);
  }
}

function assertFarlandsSanity() {
  console.log("Decorated farlands checks");

  for (const [seed, chunkX, chunkZ] of DECORATED_REFERENCE_CASES.slice(-1)) {
    const chunk = new Beta173BedrockGenerator(seed).generateChunk(chunkX, chunkZ);

    if (chunk.blocks.length !== 16 * 16 * 128) {
      throw new Error(`unexpected block buffer size for chunk (${chunkX}, ${chunkZ})`);
    }

    for (const height of chunk.heightmap) {
      if (!Number.isInteger(height) || height < 0 || height > 128) {
        throw new Error(`invalid decorated height ${height} for chunk (${chunkX}, ${chunkZ})`);
      }
    }

    for (const blockId of chunk.blocks) {
      if (blockId !== BLOCKS.AIR && !Number.isInteger(blockId)) {
        throw new Error(`invalid block id ${blockId} for chunk (${chunkX}, ${chunkZ})`);
      }
    }

    console.log(`  PASS (${chunkX}, ${chunkZ}) -> stable chunk buffers`);
  }
}

function assertFarlandsCoordinateOverride() {
  console.log("Farlands coordinate override checks");

  const customFarlandsCoordinate = 105508;
  const defaultNearOrigin = new Beta173Generator("123456789").generateChunk(0, 0);
  const shiftedNearOrigin = new Beta173Generator("123456789", {
    farlandsCoordinate: customFarlandsCoordinate,
  }).generateChunk(0, 0);

  if (!arraysEqual(defaultNearOrigin.blocks, shiftedNearOrigin.blocks)) {
    throw new Error("farlands override changed near-origin terrain");
  }

  const customFarlandsChunkX = Math.floor(customFarlandsCoordinate / 16);
  const defaultFar = new Beta173Generator("123456789").generateChunk(customFarlandsChunkX, 0);
  const shiftedFar = new Beta173Generator("123456789", {
    farlandsCoordinate: customFarlandsCoordinate,
  }).generateChunk(customFarlandsChunkX, 0);

  if (arraysEqual(defaultFar.heightmap, shiftedFar.heightmap)) {
    throw new Error("farlands override did not move the farlands boundary");
  }

  if (getFarlandsCoordinate() !== customFarlandsCoordinate) {
    throw new Error(`expected configured farlands coordinate ${customFarlandsCoordinate}`);
  }

  setFarlandsCoordinate(DEFAULT_FARLANDS_COORDINATE);
  console.log(`  PASS custom farlands coordinate -> ${customFarlandsCoordinate}`);
}

function assertPopulationNeighborhoodStability() {
  console.log("Population neighborhood stability checks");

  const seed = "123456789";
  const chunkX = -8;
  const chunkZ = -5;
  const generator = new Beta173BedrockGenerator(seed);
  const before = generator.generateChunk(chunkX, chunkZ);

  generator.generateChunk(chunkX - 1, chunkZ);
  generator.generateChunk(chunkX, chunkZ - 1);
  generator.generateChunk(chunkX + 1, chunkZ + 1);

  const after = generator.generateChunk(chunkX, chunkZ);

  if (!arraysEqual(before.blocks, after.blocks)) {
    throw new Error(`neighbor generation changed blocks for chunk (${chunkX}, ${chunkZ})`);
  }
  if (!arraysEqual(before.heightmap, after.heightmap)) {
    throw new Error(`neighbor generation changed heightmap for chunk (${chunkX}, ${chunkZ})`);
  }

  console.log(`  PASS (${chunkX}, ${chunkZ}) remains stable after neighbor generation`);
}

function assertBackgroundSessionParityWithFormOptionsDisabled() {
  console.log("Background session disabled-option checks");

  const generator = new Beta173BedrockGenerator("123456789", {
    caves: false,
    ores: false,
    lakes: false,
    trees: false,
    flora: false,
    springs: false,
    snow: false,
  });
  const terrain = generator.generateTerrainChunk(0, 0);
  const decorated = generator.decorateTerrainChunk(terrain, { rebuildHeightmap: false });
  const decorationSession = generator.createBackgroundDecorationSession(terrain);

  advanceSessionToCompletion(
    decorationSession,
    (session) => generator.advanceBackgroundDecorationSession(session),
    "beta173 disabled-option background decoration session",
  );

  if (!arraysEqual(decorated.blocks, decorationSession.decoratedBlocks)) {
    throw new Error("disabled-option background decoration session blocks mismatch");
  }

  console.log("  PASS background decoration remains stable with form options disabled");
}

function assertExtendedDecoratorCoverage() {
  console.log("Extended decorator coverage checks");

  const generator = new Beta173BedrockGenerator("123456789");
  let foundClay = false;
  let foundDungeon = false;

  for (let chunkX = -16; chunkX <= -13 && (!foundClay || !foundDungeon); chunkX += 1) {
    for (let chunkZ = -10; chunkZ <= 6 && (!foundClay || !foundDungeon); chunkZ += 1) {
      const chunk = generator.generateChunk(chunkX, chunkZ);
      const unique = new Set(chunk.blocks);

      if (unique.has(82)) {
        foundClay = true;
      }
      if (unique.has(4) || unique.has(48) || unique.has(52)) {
        foundDungeon = true;
      }
    }
  }

  if (!foundClay) {
    throw new Error("did not find clay decoration in expected scan region");
  }
  if (!foundDungeon) {
    throw new Error("did not find dungeon wall decoration in expected scan region");
  }

  console.log("  PASS clay and dungeon decorations appear in expected scan region");
}

function assertFloraCoverage() {
  console.log("Flora, tree, and snow coverage checks");

  const generator = new Beta173BedrockGenerator("123456789");
  const coverageCases = [
    { chunkX: -96, chunkZ: 9, blockId: 37, label: "yellow flower" },
    { chunkX: -96, chunkZ: -52, blockId: 31, label: "tall grass" },
    { chunkX: -67, chunkZ: 28, blockId: 32, label: "dead bush" },
    { chunkX: -96, chunkZ: -90, blockId: 38, label: "red flower" },
    { chunkX: -96, chunkZ: -94, blockId: 39, label: "brown mushroom" },
    { chunkX: -96, chunkZ: -49, blockId: 40, label: "red mushroom" },
    { chunkX: -65, chunkZ: 11, blockId: 81, label: "cactus" },
    { chunkX: -96, chunkZ: -5, blockId: 83, label: "reeds" },
    { chunkX: -74, chunkZ: -63, blockId: 86, label: "pumpkin" },
    { chunkX: -96, chunkZ: -49, blockId: 201, label: "birch log" },
    { chunkX: -160, chunkZ: -116, blockId: 202, label: "spruce log" },
    { chunkX: -160, chunkZ: -141, blockId: 205, label: "snow layer" },
  ];

  for (const { chunkX, chunkZ, blockId, label } of coverageCases) {
    const chunk = generator.generateChunk(chunkX, chunkZ);
    if (!chunk.blocks.includes(blockId)) {
      throw new Error(`expected ${label} block ${blockId} in chunk (${chunkX}, ${chunkZ})`);
    }
  }

  console.log("  PASS flora, tree, and snow decorations appear in expected chunks");
}

function main() {
  assertUndecoratedPassthrough();
  assertDecoratedDeterminism();
  assertFarlandsSanity();
  assertFarlandsCoordinateOverride();
  assertPopulationNeighborhoodStability();
  assertBackgroundSessionParityWithFormOptionsDisabled();
  assertExtendedDecoratorCoverage();
  assertFloraCoverage();
}

main();

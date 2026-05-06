import {
  Alpha1016BedrockGenerator,
  DEFAULT_FARLANDS_COORDINATE,
  getNoiseFarlandsCoordinate,
  setNoiseFarlandsCoordinate,
} from "./index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

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

function findTopNonAirY(blocks, chunkX, chunkZ) {
  const columnBase = (chunkX * 16 + chunkZ) * 128;
  for (let y = 127; y >= 0; y -= 1) {
    const blockId = blocks[columnBase + y];
    if (blockId !== 0) {
      return y;
    }
  }
  return -1;
}

function testDeterministicChunk() {
  const generator = new Alpha1016BedrockGenerator("123456789");
  const first = generator.generateChunk(0, 0);
  const second = generator.generateChunk(0, 0);
  assert(arraysEqual(first.blocks, second.blocks), "generateChunk should be deterministic");
  assert(arraysEqual(first.heightmap, second.heightmap), "heightmap should be deterministic");
}

function testBackgroundTerrainParity() {
  const generator = new Alpha1016BedrockGenerator("123456789");
  const sync = generator.generateTerrainChunk(3, -2);
  const session = generator.createBackgroundTerrainSession(3, -2);
  while (!session.complete) {
    generator.advanceBackgroundTerrainSession(session);
  }
  assert(arraysEqual(sync.blocks, session.terrainChunk.blocks), "background terrain blocks mismatch");
  assert(arraysEqual(sync.heightmap, session.terrainChunk.heightmap), "background terrain heightmap mismatch");
}

function testBackgroundDecorationParity() {
  const generator = new Alpha1016BedrockGenerator("123456789");
  const terrain = generator.generateTerrainChunk(-1, 4);
  const sync = generator.decorateTerrainChunk(terrain);
  const session = generator.createBackgroundDecorationSession(terrain);
  while (!session.complete) {
    generator.advanceBackgroundDecorationSession(session);
  }
  assert(arraysEqual(sync.blocks, session.decoratedBlocks), "background decoration blocks mismatch");
}

function testSnowWorldSmoke() {
  const generator = new Alpha1016BedrockGenerator("123456789", { snowCovered: true });
  const chunk = generator.generateChunk(0, 0);
  assert(chunk.blocks.length === 32768, "snow world chunk size mismatch");
}

function testFarlandsCoordinateOverride() {
  const customFarlandsCoordinate = 105508;
  const defaultNearOrigin = new Alpha1016BedrockGenerator("123456789").generateChunk(0, 0);
  const shiftedNearOrigin = new Alpha1016BedrockGenerator("123456789", {
    farlandsCoordinate: customFarlandsCoordinate,
  }).generateChunk(0, 0);

  assert(
    arraysEqual(defaultNearOrigin.blocks, shiftedNearOrigin.blocks),
    "farlands override changed near-origin terrain",
  );

  const customFarlandsChunkX = Math.floor(customFarlandsCoordinate / 16);
  const defaultFar = new Alpha1016BedrockGenerator("123456789").generateChunk(customFarlandsChunkX, 0);
  const shiftedFar = new Alpha1016BedrockGenerator("123456789", {
    farlandsCoordinate: customFarlandsCoordinate,
  }).generateChunk(customFarlandsChunkX, 0);

  assert(
    !arraysEqual(defaultFar.heightmap, shiftedFar.heightmap),
    "farlands override did not move the farlands boundary",
  );
  assert(
    getNoiseFarlandsCoordinate() === customFarlandsCoordinate,
    `expected configured farlands coordinate ${customFarlandsCoordinate}`,
  );

  setNoiseFarlandsCoordinate(DEFAULT_FARLANDS_COORDINATE);
}

function testHeightmapIncludesTopLayer() {
  const generator = new Alpha1016BedrockGenerator("123456789", {
    farlandsCoordinate: 500,
  });
  const chunk = generator.generateTerrainChunk(32, 0);
  let foundCeilingColumn = false;

  for (let x = 0; x < 16; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const topSolidY = findTopNonAirY(chunk.blocks, x, z);
      const height = chunk.heightmap[x * 16 + z];
      assert(height === topSolidY + 1, `heightmap mismatch at local column (${x}, ${z})`);
      if (topSolidY === 127) {
        foundCeilingColumn = true;
        assert(height === 128, `expected ceiling column (${x}, ${z}) to produce height 128`);
      }
    }
  }

  assert(foundCeilingColumn, "expected farlands regression chunk to include at least one ceiling column");
}

function main() {
  testDeterministicChunk();
  testBackgroundTerrainParity();
  testBackgroundDecorationParity();
  testSnowWorldSmoke();
  testFarlandsCoordinateOverride();
  testHeightmapIncludesTopLayer();
  console.log("alpha1016 validate: PASS");
}

main();



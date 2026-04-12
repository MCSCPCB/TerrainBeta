import {
  BEDROCK_BLOCK_MAP,
  Beta173SkyBedrockGenerator,
  Beta173SkyGenerator,
  BIOME_IDS,
} from "./index.js";

const BASE_REFERENCE_CASES = [
  ["123456789", 0, 0, 564107647, 173676750],
  ["123456789", 6, -3, 2219560237, 710517890],
  ["123456789", 6594, 0, 2979290692, 255000994],
];

const DECORATED_REFERENCE_CASES = [
  ["123456789", 0, 0, 451441951, 36983703, 173676750],
  ["123456789", 7, -9, 2388976026, 2992188124, 4116104281],
  ["123456789", 6594, 0, 919112052, 1535718610, 255000994],
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

function hashArray(array) {
  let hash = 2166136261 >>> 0;

  for (const value of array) {
    hash ^= Number(value) & 0xff;
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= (Number(value) >>> 8) & 0xff;
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash >>> 0;
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

function assertFixedSkyClimate() {
  console.log("Fixed sky climate checks");

  const chunk = new Beta173SkyGenerator("123456789").generateChunk(0, 0);
  for (const biomeId of chunk.biomes) {
    if (biomeId !== BIOME_IDS.SKY) {
      throw new Error(`expected biome ${BIOME_IDS.SKY}, got ${biomeId}`);
    }
  }
  for (const temperature of chunk.temperature) {
    if (temperature !== 0.5) {
      throw new Error(`expected fixed temperature 0.5, got ${temperature}`);
    }
  }
  for (const rainfall of chunk.rainfall) {
    if (rainfall !== 0.0) {
      throw new Error(`expected fixed rainfall 0.0, got ${rainfall}`);
    }
  }

  console.log("  PASS fixed SKY biome and climate");
}

function assertBaseReferences() {
  console.log("Base terrain reference hash checks");

  for (const [seed, chunkX, chunkZ, blockHash, heightHash] of BASE_REFERENCE_CASES) {
    const chunk = new Beta173SkyGenerator(seed).generateChunk(chunkX, chunkZ);
    if (hashArray(chunk.blocks) !== blockHash) {
      throw new Error(`base block hash mismatch for (${chunkX}, ${chunkZ})`);
    }
    if (hashArray(chunk.heightmap) !== heightHash) {
      throw new Error(`base height hash mismatch for (${chunkX}, ${chunkZ})`);
    }
    console.log(`  PASS ${seed} @ (${chunkX}, ${chunkZ})`);
  }
}

function assertUndecoratedPassthrough() {
  console.log("Undecorated passthrough checks");

  for (const [seed, chunkX, chunkZ] of BASE_REFERENCE_CASES) {
    const base = new Beta173SkyGenerator(seed).generateChunk(chunkX, chunkZ);
    const wrapped = new Beta173SkyBedrockGenerator(seed, {
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
      throw new Error(`undecorated block mismatch for (${chunkX}, ${chunkZ})`);
    }
    if (!arraysEqual(base.heightmap, wrapped.heightmap)) {
      throw new Error(`undecorated height mismatch for (${chunkX}, ${chunkZ})`);
    }

    console.log(`  PASS ${seed} @ (${chunkX}, ${chunkZ})`);
  }
}

function assertDecoratedReferences() {
  console.log("Decorated reference hash checks");

  for (const [seed, chunkX, chunkZ, blockHash, heightHash, terrainHeightHash] of DECORATED_REFERENCE_CASES) {
    const chunk = new Beta173SkyBedrockGenerator(seed).generateChunk(chunkX, chunkZ);
    if (hashArray(chunk.blocks) !== blockHash) {
      throw new Error(`decorated block hash mismatch for (${chunkX}, ${chunkZ})`);
    }
    if (hashArray(chunk.heightmap) !== heightHash) {
      throw new Error(`decorated height hash mismatch for (${chunkX}, ${chunkZ})`);
    }
    if (hashArray(chunk.terrainHeightmap) !== terrainHeightHash) {
      throw new Error(`terrain height hash mismatch for (${chunkX}, ${chunkZ})`);
    }

    assertMappedBlocks(chunk, `chunk (${chunkX}, ${chunkZ})`);
    console.log(`  PASS ${seed} @ (${chunkX}, ${chunkZ})`);
  }
}

function assertBackgroundSessionParity() {
  console.log("Background session parity checks");

  const generator = new Beta173SkyBedrockGenerator("123456789");
  const terrain = generator.generateTerrainChunk(0, 0);

  const terrainSession = generator.createBackgroundTerrainSession(0, 0);
  advanceSessionToCompletion(
    terrainSession,
    (session) => generator.advanceBackgroundTerrainSession(session),
    "background terrain session",
  );

  if (!arraysEqual(terrain.blocks, terrainSession.terrainChunk.blocks)) {
    throw new Error("background terrain session blocks mismatch");
  }

  const decorated = generator.decorateTerrainChunk(terrain, { rebuildHeightmap: false });
  const decorationSession = generator.createBackgroundDecorationSession(terrain);
  advanceSessionToCompletion(
    decorationSession,
    (session) => generator.advanceBackgroundDecorationSession(session),
    "background decoration session",
  );
  if (!arraysEqual(decorated.blocks, decorationSession.decoratedBlocks)) {
    throw new Error("background decoration session blocks mismatch");
  }

  console.log("  PASS background terrain and decoration sessions");
}

function assertFarlandsCoordinateOverride() {
  console.log("Farlands coordinate override checks");

  const customFarlandsCoordinate = 105508;
  const defaultNearOrigin = new Beta173SkyGenerator("123456789").generateChunk(0, 0);
  const shiftedNearOrigin = new Beta173SkyGenerator("123456789", {
    farlandsCoordinate: customFarlandsCoordinate,
  }).generateChunk(0, 0);

  if (!arraysEqual(defaultNearOrigin.blocks, shiftedNearOrigin.blocks)) {
    throw new Error("farlands override changed near-origin terrain");
  }

  const customFarlandsChunkX = Math.floor(customFarlandsCoordinate / 16);
  const defaultFar = new Beta173SkyGenerator("123456789").generateChunk(customFarlandsChunkX, 0);
  const shiftedFar = new Beta173SkyGenerator("123456789", {
    farlandsCoordinate: customFarlandsCoordinate,
  }).generateChunk(customFarlandsChunkX, 0);

  if (arraysEqual(defaultFar.heightmap, shiftedFar.heightmap)) {
    throw new Error("farlands override did not move the farlands boundary");
  }

  console.log(`  PASS custom farlands coordinate -> ${customFarlandsCoordinate}`);
}

function main() {
  assertFixedSkyClimate();
  assertBaseReferences();
  assertUndecoratedPassthrough();
  assertDecoratedReferences();
  assertBackgroundSessionParity();
  assertFarlandsCoordinateOverride();
}

main();

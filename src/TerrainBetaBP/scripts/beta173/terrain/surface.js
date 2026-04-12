import { JavaRandom } from "../random/java.js";
import { BLOCKS, getSurfaceForBiome } from "../biome/index.js";
import {
  generateFixedPerlinNoise,
  generateNormalPerlinNoise,
} from "../reference/index.js";
import { SEA_LEVEL, chunkBlockIndex, layerIndex } from "../utils/layout.js";

const CHUNK_SEED_X = 341873128712n;
const CHUNK_SEED_Z = 132897987541n;

function surfaceNoiseIndex(x, z) {
  return x + z * 16;
}

function replaceBiomeSurfaceColumn(state, x) {
  const {
    blocks,
    climateData,
    surfaceRandom,
    sandField,
    gravelField,
    heightField,
    surfacePalette,
  } = state;

  for (let z = 0; z < 16; z += 1) {
    const columnIndex = layerIndex(x, z);
    const noiseIndex = surfaceNoiseIndex(x, z);
    const surface = getSurfaceForBiome(climateData.biomes[columnIndex], surfacePalette);
    const sandy = sandField[noiseIndex] + surfaceRandom.nextDouble() * 0.2 > 0.0;
    const gravelly = gravelField[noiseIndex] + surfaceRandom.nextDouble() * 0.2 > 3.0;
    const elevation = Math.trunc(heightField[noiseIndex] / 3.0 + 3.0 + surfaceRandom.nextDouble() * 0.25);

    let remainingDepth = -1;
    let topBlock = surface.top;
    let fillerBlock = surface.fill;

    for (let y = 127; y >= 0; y -= 1) {
      const blockIndex = chunkBlockIndex(x, y, z);

      if (y <= surfaceRandom.nextInt(5)) {
        blocks[blockIndex] = BLOCKS.BEDROCK;
        continue;
      }

      const existing = blocks[blockIndex];
      if (existing === BLOCKS.AIR) {
        remainingDepth = -1;
        continue;
      }
      if (existing !== BLOCKS.STONE) {
        continue;
      }

      if (remainingDepth === -1) {
        if (elevation <= 0) {
          topBlock = BLOCKS.AIR;
          fillerBlock = BLOCKS.STONE;
        } else if (y >= SEA_LEVEL - 4 && y <= SEA_LEVEL + 1) {
          topBlock = surface.top;
          fillerBlock = surface.fill;

          if (gravelly) {
            topBlock = BLOCKS.AIR;
            fillerBlock = BLOCKS.GRAVEL;
          }
          if (sandy) {
            topBlock = BLOCKS.SAND;
            fillerBlock = BLOCKS.SAND;
          }
        }

        if (y < SEA_LEVEL && topBlock === BLOCKS.AIR) {
          topBlock = climateData.temperature[columnIndex] < 0.5 ? BLOCKS.ICE : BLOCKS.WATER;
        }

        remainingDepth = elevation;
        blocks[blockIndex] = y >= SEA_LEVEL - 1 ? topBlock : fillerBlock;
        continue;
      }

      if (remainingDepth > 0) {
        remainingDepth -= 1;
        blocks[blockIndex] = fillerBlock;

        if (remainingDepth === 0 && fillerBlock === BLOCKS.SAND) {
          remainingDepth = surfaceRandom.nextInt(4);
          fillerBlock = BLOCKS.SANDSTONE;
        }
      }
    }
  }
}

export function createSurfaceReplacementSession(blocks, terrainTables, climateData, chunkX, chunkZ, surfacePalette = null) {
  const surfaceRandom = new JavaRandom(BigInt.asIntN(64, BigInt(chunkX) * CHUNK_SEED_X + BigInt(chunkZ) * CHUNK_SEED_Z));
  const sandField = new Float64Array(256);
  const gravelField = new Float64Array(256);
  const heightField = new Float64Array(256);

  generateNormalPerlinNoise(
    sandField,
    chunkX * 16,
    chunkZ * 16,
    0.0,
    16,
    16,
    1,
    0.03125,
    0.03125,
    1.0,
    terrainTables.shoreBottomComposition,
  );
  generateFixedPerlinNoise(
    gravelField,
    chunkZ * 16,
    chunkX * 16,
    16,
    16,
    0.03125,
    0.03125,
    terrainTables.shoreBottomComposition,
  );
  generateNormalPerlinNoise(
    heightField,
    chunkX * 16,
    chunkZ * 16,
    0.0,
    16,
    16,
    1,
    0.0625,
    0.0625,
    0.0625,
    terrainTables.surfaceElevation,
  );

  return {
    blocks,
    climateData,
    surfaceRandom,
    sandField,
    gravelField,
    heightField,
    surfacePalette,
    cursorX: 0,
    complete: false,
  };
}

export function advanceSurfaceReplacementSession(session, columnCount = 1) {
  if (session.complete) {
    return false;
  }

  const endX = Math.min(16, session.cursorX + columnCount);
  for (let x = session.cursorX; x < endX; x += 1) {
    replaceBiomeSurfaceColumn(session, x);
  }

  session.cursorX = endX;
  session.complete = session.cursorX >= 16;
  return true;
}

export function replaceBlocksForBiomesExact(blocks, terrainTables, climateData, chunkX, chunkZ, surfacePalette = null) {
  const session = createSurfaceReplacementSession(
    blocks,
    terrainTables,
    climateData,
    chunkX,
    chunkZ,
    surfacePalette,
  );
  while (advanceSurfaceReplacementSession(session)) {
    // Run the exact same deterministic state machine to completion for synchronous callers.
  }
}

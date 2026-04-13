import { JavaRandom } from "../../beta173/random/java.js";
import { chunkBlockIndex, layerIndex } from "../../beta173/utils/layout.js";
import { BLOCKS, getSurfaceForBiome } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import { nearHollowHill } from "./hills.js";

const CHUNK_SEED_X = 341873128712n;
const CHUNK_SEED_Z = 132897987541n;

function replaceBiomeSurfaceColumn(state, x) {
  const {
    blocks,
    climateData,
    chunkX,
    chunkZ,
    surfaceRandom,
    surfacePalette,
    hillChunk,
  } = state;

  for (let z = 0; z < 16; z += 1) {
    const columnIndex = layerIndex(x, z);
    const surface = getSurfaceForBiome(climateData.biomes[columnIndex], surfacePalette);
    const fillLevel = 1 + Math.trunc(surfaceRandom.nextDouble() * surfaceRandom.nextDouble() * 3.0 + 0.65);
    let topLevel = -1;

    for (let y = 127; y >= 0; y -= 1) {
      const blockIndex = chunkBlockIndex(x, y, z);

      if (y <= 8) {
        if (hillChunk) {
          let lowerBlock = BLOCKS.BEDROCK;
          switch (y) {
            case 1:
            case 2:
              lowerBlock = EXTRA_BLOCKS.OBSIDIAN;
              break;
            case 3:
              lowerBlock = EXTRA_BLOCKS.GLOWSTONE;
              break;
            case 4:
            case 5:
            case 6:
              lowerBlock = BLOCKS.AIR;
              break;
            case 7:
            case 8:
              lowerBlock = EXTRA_BLOCKS.GLOWSTONE;
              break;
            default:
              lowerBlock = BLOCKS.BEDROCK;
          }
          blocks[blockIndex] = lowerBlock;
        } else {
          blocks[blockIndex] = BLOCKS.BEDROCK;
        }
        continue;
      }

      if (blocks[blockIndex] !== BLOCKS.STONE) {
        continue;
      }

      if (topLevel === -1) {
        topLevel = y;
        blocks[blockIndex] = surface.top;
        continue;
      }

      if (y < topLevel && y >= topLevel - fillLevel) {
        blocks[blockIndex] = surface.fill;
      }
    }
  }
}

export function createSurfaceReplacementSession(blocks, climateData, chunkX, chunkZ, surfacePalette = null) {
  return {
    blocks,
    climateData,
    chunkX,
    chunkZ,
    surfacePalette,
    surfaceRandom: new JavaRandom(
      BigInt.asIntN(64, BigInt(chunkX) * CHUNK_SEED_X + BigInt(chunkZ) * CHUNK_SEED_Z),
    ),
    hillChunk: nearHollowHill(chunkX, chunkZ, 0n),
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

export function replaceBlocksForBiomesExact(blocks, climateData, chunkX, chunkZ, surfacePalette = null) {
  const session = createSurfaceReplacementSession(
    blocks,
    climateData,
    chunkX,
    chunkZ,
    surfacePalette,
  );
  while (advanceSurfaceReplacementSession(session)) {
    // Preserve the exact column-by-column ordering for synchronous callers.
  }
}

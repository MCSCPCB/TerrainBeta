import { BLOCKS, getSurfaceForBiome } from "../biome/constants.js";
import { JavaRandom } from "../random/java.js";
import { chunkBlockIndex, layerIndex } from "../utils/layout.js";

const CHUNK_X_SEED = 341873128712n;
const CHUNK_Z_SEED = 132897987541n;

export function replaceBlocksForBiomes(blocks, generator, climateData, chunkX, chunkZ) {
  const seed = BigInt.asIntN(
    64,
    BigInt(chunkX) * CHUNK_X_SEED + BigInt(chunkZ) * CHUNK_Z_SEED,
  );
  const random = new JavaRandom(seed);
  const depthBuffer = generator.surfaceNoise.generateNoise(
    generator.surfaceNoiseBuffer,
    chunkX * 16,
    chunkZ * 16,
    0.0,
    16,
    16,
    1,
    0.0625,
    0.0625,
    0.0625,
  );
  generator.surfaceNoiseBuffer = depthBuffer;

  for (let x = 0; x < 16; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const biomeId = climateData.biomes[layerIndex(x, z)];
      const surface = getSurfaceForBiome(biomeId);
      let surfaceDepth = Math.trunc(depthBuffer[layerIndex(x, z)] / 3.0 + 3.0 + random.nextDouble() * 0.25);
      let runDepth = -1;
      let topBlock = surface.top;
      let fillBlock = surface.fill;

      for (let y = 127; y >= 0; y -= 1) {
        const index = chunkBlockIndex(x, y, z);
        const blockId = blocks[index];
        if (blockId === BLOCKS.AIR) {
          runDepth = -1;
          continue;
        }

        if (blockId !== BLOCKS.STONE) {
          continue;
        }

        if (runDepth === -1) {
          if (surfaceDepth <= 0) {
            topBlock = BLOCKS.AIR;
            fillBlock = BLOCKS.STONE;
          }

          runDepth = surfaceDepth;
          blocks[index] = y >= 0 ? topBlock : fillBlock;
          continue;
        }

        if (runDepth <= 0) {
          continue;
        }

        runDepth -= 1;
        blocks[index] = fillBlock;
        if (runDepth === 0 && fillBlock === BLOCKS.SAND) {
          runDepth = random.nextInt(4);
          fillBlock = BLOCKS.SANDSTONE;
        }
      }
    }
  }
}

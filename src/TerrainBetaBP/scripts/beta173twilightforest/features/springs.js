import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
     countHorizontalNeighbors,
     getRegionBlock,
     setRegionBlock,
} from "../population/shared.js";

function generateSpring(region, liquidBlock, worldX, worldY, worldZ) {
     const currentBlock = getRegionBlock(region, worldX, worldY, worldZ);
     if (currentBlock !== BLOCKS.AIR && currentBlock !== BLOCKS.STONE) {
          return false;
     }
     if (getRegionBlock(region, worldX, worldY + 1, worldZ) !== BLOCKS.STONE) {
          return false;
     }
     if (getRegionBlock(region, worldX, worldY - 1, worldZ) !== BLOCKS.STONE) {
          return false;
     }

     const stoneNeighbors = countHorizontalNeighbors(
          region,
          worldX,
          worldY,
          worldZ,
          (blockId) => blockId === BLOCKS.STONE,
     );
     const airNeighbors = countHorizontalNeighbors(
          region,
          worldX,
          worldY,
          worldZ,
          (blockId) => blockId === BLOCKS.AIR,
     );
     if (stoneNeighbors === 3 && airNeighbors === 1) {
          setRegionBlock(region, worldX, worldY, worldZ, liquidBlock);
          return true;
     }

     return false;
}

export function createSpringSession(region, random, chunkX, chunkZ) {
     return {
          region,
          random,
          chunkX,
          chunkZ,
          waterAttempt: 0,
          lavaAttempt: 0,
          complete: false,
     };
}

export function advanceSpringSession(session, maxAttempts = 1) {
     if (session.complete) {
          return false;
     }

     let processed = 0;
     while (processed < maxAttempts) {
          if (session.waterAttempt < 50) {
               generateSpring(
                    session.region,
                    EXTRA_BLOCKS.FLOWING_WATER,
                    session.chunkX * 16 + session.random.nextInt(16) + 8,
                    session.random.nextInt(session.random.nextInt(120) + 8),
                    session.chunkZ * 16 + session.random.nextInt(16) + 8,
               );
               session.waterAttempt += 1;
               processed += 1;
               continue;
          }

          if (session.lavaAttempt < 10) {
               generateSpring(
                    session.region,
                    EXTRA_BLOCKS.FLOWING_LAVA,
                    session.chunkX * 16 + session.random.nextInt(16) + 8,
                    session.random.nextInt(
                         session.random.nextInt(
                              session.random.nextInt(112) + 8,
                         ) + 8,
                    ),
                    session.chunkZ * 16 + session.random.nextInt(16) + 8,
               );
               session.lavaAttempt += 1;
               processed += 1;
               continue;
          }

          session.complete = true;
          break;
     }

     session.complete =
          session.complete ||
          (session.waterAttempt >= 50 && session.lavaAttempt >= 10);
     return processed > 0;
}

export function applyTwilightSprings(region, random, chunkX, chunkZ) {
     const session = createSpringSession(region, random, chunkX, chunkZ);
     while (advanceSpringSession(session)) {}
}

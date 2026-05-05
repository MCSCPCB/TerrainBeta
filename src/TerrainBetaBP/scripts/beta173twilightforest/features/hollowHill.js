import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import { getRegionBlock, isSolid } from "../population/shared.js";
import { putBlock } from "./primitives.js";

function makeSpike(
     region,
     random,
     blockId,
     worldX,
     worldY,
     worldZ,
     length,
     direction,
) {
     const width = Math.trunc(length / 4.5);
     for (let offsetX = -width; offsetX <= width; offsetX += 1) {
          for (let offsetZ = -width; offsetZ <= width; offsetZ += 1) {
               const distance = Math.trunc(
                    Math.max(Math.abs(offsetX), Math.abs(offsetZ)) +
                         Math.min(Math.abs(offsetX), Math.abs(offsetZ)) * 0.5,
               );
               let spikeLength = 0;
               if (distance === 0) {
                    spikeLength = length;
               } else if (distance > 0) {
                    spikeLength = random.nextInt(
                         Math.max(1, Math.trunc(length / (distance + 0.25))),
                    );
               }

               for (
                    let offsetY = 0;
                    offsetY !== spikeLength * direction;
                    offsetY += direction
               ) {
                    putBlock(
                         region,
                         worldX + offsetX,
                         worldY + offsetY,
                         worldZ + offsetZ,
                         blockId,
                         false,
                    );
               }
          }
     }

     return true;
}

function generateCaveStalactite(
     region,
     random,
     blockId,
     sizeFactor,
     hang,
     worldX,
     worldY,
     worldZ,
) {
     let ceiling = 129;
     for (let y = worldY; y < 128; y += 1) {
          const block = getRegionBlock(region, worldX, y, worldZ);
          if (block === BLOCKS.AIR) {
               continue;
          }
          if (!isSolid(block) && block !== BLOCKS.ICE) {
               return false;
          }
          ceiling = y;
          break;
     }

     if (ceiling === 129) {
          return false;
     }

     let floor = -1;
     for (let y = worldY; y > 4; y -= 1) {
          const block = getRegionBlock(region, worldX, y, worldZ);
          if (block === BLOCKS.AIR) {
               continue;
          }
          if (!isSolid(block) && block !== BLOCKS.ICE) {
               return false;
          }
          floor = y;
          break;
     }

     if (floor < 0) {
          return false;
     }

     const length = Math.trunc((ceiling - floor) * sizeFactor);
     return makeSpike(
          region,
          random,
          blockId,
          worldX,
          hang ? ceiling : floor,
          worldZ,
          Math.max(1, length),
          hang ? -1 : 1,
     );
}

function makeRandomOreStalactite(random, caveSize) {
     if (caveSize >= 3) {
          const selector = random.nextInt(6);
          if (selector === 0) {
               return {
                    blockId: EXTRA_BLOCKS.DIAMOND_ORE,
                    sizeFactor: random.nextDouble() * 0.5,
                    hang: true,
               };
          }
          if (selector === 1) {
               return {
                    blockId: EXTRA_BLOCKS.GOLD_ORE,
                    sizeFactor: random.nextDouble() * 0.8,
                    hang: true,
               };
          }
     }

     if (caveSize >= 2) {
          const selector = random.nextInt(6);
          if (selector === 0) {
               return {
                    blockId: EXTRA_BLOCKS.REDSTONE_ORE,
                    sizeFactor: random.nextDouble() * 0.6,
                    hang: true,
               };
          }
          if (selector === 1 || selector === 2) {
               return {
                    blockId: EXTRA_BLOCKS.LAPIS_ORE,
                    sizeFactor: random.nextDouble() * 0.8,
                    hang: true,
               };
          }
     }

     const selector = random.nextInt(5);
     if (selector === 0 || selector === 1) {
          return {
               blockId: EXTRA_BLOCKS.IRON_ORE,
               sizeFactor: random.nextDouble() * 0.7,
               hang: true,
          };
     }
     if (selector === 2 || selector === 3) {
          return {
               blockId: EXTRA_BLOCKS.COAL_ORE,
               sizeFactor: random.nextDouble() * 0.8,
               hang: true,
          };
     }
     return {
          blockId: EXTRA_BLOCKS.GLOWSTONE,
          sizeFactor: random.nextDouble() * 0.5,
          hang: true,
     };
}

function getHillRadius(size) {
     return (size * 2 + 1) * 8 - 6;
}

function isInHill(centerX, centerZ, radius, worldX, worldZ) {
     const deltaX = centerX - worldX;
     const deltaZ = centerZ - worldZ;
     return Math.trunc(Math.sqrt(deltaX * deltaX + deltaZ * deltaZ)) < radius;
}

function getCoordsInHill2D(random, centerX, centerZ, radius) {
     let worldX;
     let worldZ;
     do {
          worldX = centerX + random.nextInt(2 * radius) - radius;
          worldZ = centerZ + random.nextInt(2 * radius) - radius;
     } while (!isInHill(centerX, centerZ, radius, worldX, worldZ));

     return [worldX, worldZ];
}

export function createHollowHillSession(
     region,
     random,
     size,
     worldX,
     worldY,
     worldZ,
) {
     const radius = getHillRadius(size);
     const area = Math.trunc(Math.PI * radius * radius);
     const mobSpawnerCounts = [0, 3, 9, 18];
     const treasureCounts = [0, 2, 6, 12];

     return {
          region,
          random,
          size,
          worldX,
          worldY,
          worldZ,
          radius,
          spawnerCount: mobSpawnerCounts[size] ?? 0,
          treasureCount: treasureCounts[size] ?? 0,
          stalactiteCount: Math.trunc(area / 16),
          stage: "spawners",
          placed: 0,
          complete: false,
     };
}

export function advanceHollowHillSession(session, maxAttempts = 1) {
     if (session.complete) {
          return false;
     }

     let processed = 0;
     while (processed < maxAttempts && !session.complete) {
          const [targetX, targetZ] = getCoordsInHill2D(
               session.random,
               session.worldX,
               session.worldZ,
               session.radius,
          );

          switch (session.stage) {
               case "spawners":
                    putBlock(
                         session.region,
                         targetX,
                         session.worldY + session.random.nextInt(4),
                         targetZ,
                         EXTRA_BLOCKS.MOB_SPAWNER,
                         true,
                    );
                    break;

               case "treasure":
                    putBlock(
                         session.region,
                         targetX,
                         session.worldY,
                         targetZ,
                         EXTRA_BLOCKS.CHEST,
                         true,
                    );
                    break;

               case "ore_stalactites": {
                    const stalactite = makeRandomOreStalactite(
                         session.random,
                         session.size,
                    );
                    generateCaveStalactite(
                         session.region,
                         session.random,
                         stalactite.blockId,
                         stalactite.sizeFactor,
                         stalactite.hang,
                         targetX,
                         session.worldY + 1,
                         targetZ,
                    );
                    break;
               }

               case "stone_stalactites":
                    generateCaveStalactite(
                         session.region,
                         session.random,
                         BLOCKS.STONE,
                         session.random.nextDouble(),
                         true,
                         targetX,
                         session.worldY + 1,
                         targetZ,
                    );
                    break;

               case "stone_stalagmites":
                    generateCaveStalactite(
                         session.region,
                         session.random,
                         BLOCKS.STONE,
                         session.random.nextDouble() * 0.7,
                         false,
                         targetX,
                         session.worldY + 1,
                         targetZ,
                    );
                    break;

               default:
                    session.complete = true;
                    break;
          }

          session.placed += 1;
          processed += 1;

          const limit =
               session.stage === "spawners"
                    ? session.spawnerCount
                    : session.stage === "treasure"
                      ? session.treasureCount
                      : session.stalactiteCount;

          if (session.placed >= limit) {
               session.placed = 0;
               if (session.stage === "spawners") {
                    session.stage = "treasure";
               } else if (session.stage === "treasure") {
                    session.stage = "ore_stalactites";
               } else if (session.stage === "ore_stalactites") {
                    session.stage = "stone_stalactites";
               } else if (session.stage === "stone_stalactites") {
                    session.stage = "stone_stalagmites";
               } else {
                    session.complete = true;
                    session.stage = "complete";
               }
          }
     }

     return processed > 0;
}

export function applyTwilightHollowHill(
     region,
     random,
     size,
     worldX,
     worldY,
     worldZ,
) {
     const session = createHollowHillSession(
          region,
          random,
          size,
          worldX,
          worldY,
          worldZ,
     );
     while (advanceHollowHillSession(session)) {}
}

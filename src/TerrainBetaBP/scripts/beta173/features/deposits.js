import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
     POPULATION_REGION_SIZE,
     getRegionBlock,
     setRegionBlock,
} from "../population/shared.js";

const STONE_REPLACEABLE = new Set([BLOCKS.STONE]);
const SAND_REPLACEABLE = new Set([BLOCKS.SAND]);

const ORE_CONFIG = Object.freeze([
     {
          block: BLOCKS.DIRT,
          attempts: 20,
          size: 32,
          distribution: "linear",
          minY: 0,
          maxY: 128,
     },
     {
          block: BLOCKS.GRAVEL,
          attempts: 10,
          size: 32,
          distribution: "linear",
          minY: 0,
          maxY: 128,
     },
     {
          block: EXTRA_BLOCKS.COAL_ORE,
          attempts: 20,
          size: 16,
          distribution: "linear",
          minY: 0,
          maxY: 128,
     },
     {
          block: EXTRA_BLOCKS.IRON_ORE,
          attempts: 20,
          size: 8,
          distribution: "linear",
          minY: 0,
          maxY: 64,
     },
     {
          block: EXTRA_BLOCKS.GOLD_ORE,
          attempts: 2,
          size: 8,
          distribution: "linear",
          minY: 0,
          maxY: 32,
     },
     {
          block: EXTRA_BLOCKS.REDSTONE_ORE,
          attempts: 8,
          size: 7,
          distribution: "linear",
          minY: 0,
          maxY: 16,
     },
     {
          block: EXTRA_BLOCKS.DIAMOND_ORE,
          attempts: 1,
          size: 7,
          distribution: "linear",
          minY: 0,
          maxY: 16,
     },
     {
          block: EXTRA_BLOCKS.LAPIS_ORE,
          attempts: 1,
          size: 6,
          distribution: "centered",
          centerY: 16,
          radiusY: 16,
     },
]);

const CLAY_CONFIG = Object.freeze({
     block: EXTRA_BLOCKS.CLAY,
     attempts: 10,
     size: 32,
     minY: 0,
     maxY: 64,
});

function generateReplaceableVein(
     region,
     random,
     replaceableBlocks,
     oreBlock,
     size,
     baseX,
     baseY,
     baseZ,
) {
     const angle = random.nextFloat() * Math.PI;
     const xSize = (Math.sin(angle) * size) / 8.0;
     const zSize = (Math.cos(angle) * size) / 8.0;
     const startX = baseX + 8 + xSize;
     const endX = baseX + 8 - xSize;
     const startZ = baseZ + 8 + zSize;
     const endZ = baseZ + 8 - zSize;
     const startY = baseY + random.nextInt(3) + 2;
     const endY = baseY + random.nextInt(3) + 2;

     for (let step = 0; step <= size; step += 1) {
          const fraction = step / size;
          const centerX = startX + (endX - startX) * fraction;
          const centerY = startY + (endY - startY) * fraction;
          const centerZ = startZ + (endZ - startZ) * fraction;
          const radiusScale = (random.nextDouble() * size) / 16.0;
          const diameter =
               (Math.sin((step * Math.PI) / size) + 1.0) * radiusScale + 1.0;
          const radius = diameter / 2.0;
          const minX = Math.max(
               Math.floor(centerX - radius),
               region.originWorldX,
          );
          const maxX = Math.min(
               Math.floor(centerX + radius),
               region.originWorldX + POPULATION_REGION_SIZE - 1,
          );
          const minY = Math.max(Math.floor(centerY - radius), 1);
          const maxY = Math.min(Math.floor(centerY + radius), 126);
          const minZ = Math.max(
               Math.floor(centerZ - radius),
               region.originWorldZ,
          );
          const maxZ = Math.min(
               Math.floor(centerZ + radius),
               region.originWorldZ + POPULATION_REGION_SIZE - 1,
          );

          for (let x = minX; x <= maxX; x += 1) {
               const dx = (x + 0.5 - centerX) / radius;
               const dxSq = dx * dx;
               if (dxSq >= 1.0) {
                    continue;
               }

               for (let y = minY; y <= maxY; y += 1) {
                    const dy = (y + 0.5 - centerY) / radius;
                    const dySq = dy * dy;
                    if (dxSq + dySq >= 1.0) {
                         continue;
                    }

                    for (let z = minZ; z <= maxZ; z += 1) {
                         const dz = (z + 0.5 - centerZ) / radius;
                         if (dxSq + dySq + dz * dz >= 1.0) {
                              continue;
                         }

                         if (
                              replaceableBlocks.has(
                                   getRegionBlock(region, x, y, z),
                              )
                         ) {
                              setRegionBlock(region, x, y, z, oreBlock);
                         }
                    }
               }
          }
     }
}

function pickOreY(random, config) {
     if (config.distribution === "centered") {
          return (
               random.nextInt(config.radiusY) +
               random.nextInt(config.radiusY) +
               config.centerY -
               config.radiusY
          );
     }

     return random.nextInt(config.maxY - config.minY) + config.minY;
}

export function createClaySession(region, random, chunkX, chunkZ) {
     return {
          region,
          random,
          chunkX,
          chunkZ,
          attempt: 0,
          complete: false,
     };
}

export function advanceClaySession(session, maxAttempts = 1) {
     if (session.complete) {
          return false;
     }

     let processed = 0;
     while (processed < maxAttempts && session.attempt < CLAY_CONFIG.attempts) {
          const x = session.chunkX * 16 + session.random.nextInt(16);
          const y =
               session.random.nextInt(CLAY_CONFIG.maxY - CLAY_CONFIG.minY) +
               CLAY_CONFIG.minY;
          const z = session.chunkZ * 16 + session.random.nextInt(16);

          if (getRegionBlock(session.region, x, y, z) === BLOCKS.WATER) {
               generateReplaceableVein(
                    session.region,
                    session.random,
                    SAND_REPLACEABLE,
                    CLAY_CONFIG.block,
                    CLAY_CONFIG.size,
                    x,
                    y,
                    z,
               );
          }

          session.attempt += 1;
          processed += 1;
     }

     session.complete = session.attempt >= CLAY_CONFIG.attempts;
     return processed > 0;
}

export function createOreSession(region, random, chunkX, chunkZ) {
     return {
          region,
          random,
          chunkX,
          chunkZ,
          configIndex: 0,
          attempt: 0,
          complete: false,
     };
}

export function advanceOreSession(session, maxAttempts = 1) {
     if (session.complete) {
          return false;
     }

     let processed = 0;
     while (
          processed < maxAttempts &&
          session.configIndex < ORE_CONFIG.length
     ) {
          const config = ORE_CONFIG[session.configIndex];
          const x = session.chunkX * 16 + session.random.nextInt(16);
          const y = pickOreY(session.random, config);
          const z = session.chunkZ * 16 + session.random.nextInt(16);
          generateReplaceableVein(
               session.region,
               session.random,
               STONE_REPLACEABLE,
               config.block,
               config.size,
               x,
               y,
               z,
          );

          session.attempt += 1;
          processed += 1;
          if (session.attempt >= config.attempts) {
               session.configIndex += 1;
               session.attempt = 0;
          }
     }

     session.complete = session.configIndex >= ORE_CONFIG.length;
     return processed > 0;
}

export function applyClay(region, random, chunkX, chunkZ) {
     const session = createClaySession(region, random, chunkX, chunkZ);
     while (advanceClaySession(session)) {}
}

export function applyOres(region, random, chunkX, chunkZ) {
     const session = createOreSession(region, random, chunkX, chunkZ);
     while (advanceOreSession(session)) {}
}

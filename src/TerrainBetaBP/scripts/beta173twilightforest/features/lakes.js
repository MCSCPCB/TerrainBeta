import { BLOCKS, BIOME_IDS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
     getRegionBlock,
     getRegionPrecipitationY,
     getRegionSurfaceY,
     isLiquid,
     isSolid,
     setRegionBlock,
} from "../population/shared.js";

const LAKE_MASK_WIDTH = 16;
const LAKE_MASK_HEIGHT = 8;
const LAKE_SURFACE_LEVEL = 4;

function lakeMaskIndex(x, y, z) {
     return (x * LAKE_MASK_WIDTH + z) * LAKE_MASK_HEIGHT + y;
}

function getLakeMask(mask, x, y, z) {
     if (
          x < 0 ||
          x >= LAKE_MASK_WIDTH ||
          y < 0 ||
          y >= LAKE_MASK_HEIGHT ||
          z < 0 ||
          z >= LAKE_MASK_WIDTH
     ) {
          return false;
     }

     return mask[lakeMaskIndex(x, y, z)] !== 0;
}

function createLakeMask(random) {
     const mask = new Uint8Array(
          LAKE_MASK_WIDTH * LAKE_MASK_WIDTH * LAKE_MASK_HEIGHT,
     );
     const blobCount = random.nextInt(4) + 4;

     for (let blobIndex = 0; blobIndex < blobCount; blobIndex += 1) {
          const diameterX = random.nextDouble() * 6.0 + 3.0;
          const diameterY = random.nextDouble() * 4.0 + 2.0;
          const diameterZ = random.nextDouble() * 6.0 + 3.0;
          const radiusX = diameterX / 2.0;
          const radiusY = diameterY / 2.0;
          const radiusZ = diameterZ / 2.0;
          const centerX =
               random.nextDouble() * (16.0 - diameterX - 2.0) + 1.0 + radiusX;
          const centerY =
               random.nextDouble() * (8.0 - diameterY - 4.0) + 2.0 + radiusY;
          const centerZ =
               random.nextDouble() * (16.0 - diameterZ - 2.0) + 1.0 + radiusZ;

          for (let x = 1; x < 15; x += 1) {
               for (let y = 1; y < 7; y += 1) {
                    for (let z = 1; z < 15; z += 1) {
                         const normX = (x - centerX) / radiusX;
                         const normY = (y - centerY) / radiusY;
                         const normZ = (z - centerZ) / radiusZ;

                         if (
                              normX * normX + normY * normY + normZ * normZ <
                              1.0
                         ) {
                              mask[lakeMaskIndex(x, y, z)] = 1;
                         }
                    }
               }
          }
     }

     return mask;
}

function isLakeBorder(mask, x, y, z) {
     if (getLakeMask(mask, x, y, z)) {
          return false;
     }

     return (
          getLakeMask(mask, x + 1, y, z) ||
          getLakeMask(mask, x - 1, y, z) ||
          getLakeMask(mask, x, y + 1, z) ||
          getLakeMask(mask, x, y - 1, z) ||
          getLakeMask(mask, x, y, z + 1) ||
          getLakeMask(mask, x, y, z - 1)
     );
}

function generateLake(region, random, liquidBlock, worldX, worldY, worldZ) {
     const lowerX = worldX - 8;
     const lowerZ = worldZ - 8;
     let lowerY = worldY;

     while (
          lowerY > 0 &&
          getRegionBlock(region, lowerX, lowerY, lowerZ) === BLOCKS.AIR
     ) {
          lowerY -= 1;
     }
     if (lowerY < 4) {
          return false;
     }

     lowerY -= 4;
     const mask = createLakeMask(random);

     for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
          for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
               for (let y = 0; y < LAKE_MASK_HEIGHT; y += 1) {
                    if (!isLakeBorder(mask, x, y, z)) {
                         continue;
                    }

                    const block = getRegionBlock(
                         region,
                         lowerX + x,
                         lowerY + y,
                         lowerZ + z,
                    );
                    if (y >= LAKE_SURFACE_LEVEL) {
                         if (isLiquid(block)) {
                              return false;
                         }
                         continue;
                    }

                    if (!isSolid(block) && block !== liquidBlock) {
                         return false;
                    }
               }
          }
     }

     for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
          for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
               for (let y = 0; y < LAKE_MASK_HEIGHT; y += 1) {
                    if (!getLakeMask(mask, x, y, z)) {
                         continue;
                    }

                    setRegionBlock(
                         region,
                         lowerX + x,
                         lowerY + y,
                         lowerZ + z,
                         y >= LAKE_SURFACE_LEVEL ? BLOCKS.AIR : liquidBlock,
                    );
               }
          }
     }

     for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
          for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
               for (let y = LAKE_SURFACE_LEVEL; y < LAKE_MASK_HEIGHT; y += 1) {
                    if (!getLakeMask(mask, x, y, z)) {
                         continue;
                    }

                    const groundY = lowerY + y - 1;
                    if (
                         groundY >= 0 &&
                         getRegionBlock(
                              region,
                              lowerX + x,
                              groundY,
                              lowerZ + z,
                         ) === BLOCKS.DIRT &&
                         getRegionPrecipitationY(
                              region,
                              lowerX + x,
                              lowerZ + z,
                         ) ===
                              groundY + 1
                    ) {
                         setRegionBlock(
                              region,
                              lowerX + x,
                              groundY,
                              lowerZ + z,
                              BLOCKS.GRASS,
                         );
                    }
               }
          }
     }

     if (liquidBlock === EXTRA_BLOCKS.LAVA) {
          for (let x = 0; x < LAKE_MASK_WIDTH; x += 1) {
               for (let z = 0; z < LAKE_MASK_WIDTH; z += 1) {
                    for (let y = 0; y < LAKE_MASK_HEIGHT; y += 1) {
                         if (!isLakeBorder(mask, x, y, z)) {
                              continue;
                         }

                         const block = getRegionBlock(
                              region,
                              lowerX + x,
                              lowerY + y,
                              lowerZ + z,
                         );
                         if (
                              (y < LAKE_SURFACE_LEVEL ||
                                   random.nextInt(2) !== 0) &&
                              isSolid(block)
                         ) {
                              setRegionBlock(
                                   region,
                                   lowerX + x,
                                   lowerY + y,
                                   lowerZ + z,
                                   BLOCKS.STONE,
                              );
                         }
                    }
               }
          }
     }

     return true;
}

function nextLakeX(random, chunkX) {
     return chunkX * 16 + random.nextInt(16) + 8;
}

function nextLakeZ(random, chunkZ) {
     return chunkZ * 16 + random.nextInt(16) + 8;
}

export function createLakeSession(region, sourceBiome, random, chunkX, chunkZ) {
     return {
          region,
          sourceBiome,
          random,
          chunkX,
          chunkZ,
          stage: "water_lake",
          swampAttempts: 0,
          complete: false,
     };
}

export function advanceLakeSession(session) {
     if (session.complete) {
          return false;
     }

     switch (session.stage) {
          case "water_lake":
               if (session.random.nextInt(4) === 0) {
                    generateLake(
                         session.region,
                         session.random,
                         BLOCKS.WATER,
                         nextLakeX(session.random, session.chunkX),
                         session.random.nextInt(128),
                         nextLakeZ(session.random, session.chunkZ),
                    );
               }
               session.stage =
                    session.sourceBiome === BIOME_IDS.TWILIGHT_SWAMP
                         ? "swamp_lakes"
                         : "lava_lake";
               return true;

          case "swamp_lakes":
               if (session.swampAttempts < 6) {
                    const lakeX = nextLakeX(session.random, session.chunkX);
                    const lakeZ = nextLakeZ(session.random, session.chunkZ);
                    const lakeY =
                         getRegionSurfaceY(session.region, lakeX, lakeZ) + 1;
                    generateLake(
                         session.region,
                         session.random,
                         BLOCKS.WATER,
                         lakeX,
                         lakeY,
                         lakeZ,
                    );
                    session.swampAttempts += 1;
                    return true;
               }
               session.stage = "lava_lake";
               return true;

          case "lava_lake":
               if (session.random.nextInt(64) === 0) {
                    const lakeX = nextLakeX(session.random, session.chunkX);
                    const lakeY = session.random.nextInt(
                         session.random.nextInt(120) + 8,
                    );
                    const lakeZ = nextLakeZ(session.random, session.chunkZ);
                    if (lakeY < 64 || session.random.nextInt(10) === 0) {
                         generateLake(
                              session.region,
                              session.random,
                              EXTRA_BLOCKS.LAVA,
                              lakeX,
                              lakeY,
                              lakeZ,
                         );
                    }
               }
               session.complete = true;
               session.stage = "complete";
               return true;

          default:
               session.complete = true;
               return false;
     }
}

export function applyTwilightLakes(
     region,
     sourceBiome,
     random,
     chunkX,
     chunkZ,
) {
     const session = createLakeSession(
          region,
          sourceBiome,
          random,
          chunkX,
          chunkZ,
     );
     while (advanceLakeSession(session)) {}
}

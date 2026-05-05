import { BIOME_IDS, BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
     REED_SUPPORT,
     canReplaceDecorationBlock,
     countHorizontalNeighbors,
     descendFeatureBaseY,
     getRegionBlock,
     hasAdjacentLiquid,
     hasSkyAccessApprox,
     isSolid,
     isSolidRenderBlock,
     setRegionBlock,
} from "../population/shared.js";

function placeFlower(region, worldX, worldY, worldZ, blockId) {
     if (
          !canReplaceDecorationBlock(
               getRegionBlock(region, worldX, worldY, worldZ),
          )
     ) {
          return false;
     }
     const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
     if (below !== BLOCKS.GRASS && below !== BLOCKS.DIRT) {
          return false;
     }
     setRegionBlock(region, worldX, worldY, worldZ, blockId);
     return true;
}

function placeTallGrass(region, worldX, worldY, worldZ) {
     if (
          !canReplaceDecorationBlock(
               getRegionBlock(region, worldX, worldY, worldZ),
          )
     ) {
          return false;
     }
     const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
     if (below !== BLOCKS.GRASS && below !== BLOCKS.DIRT) {
          return false;
     }
     setRegionBlock(region, worldX, worldY, worldZ, EXTRA_BLOCKS.TALL_GRASS);
     return true;
}

function placeDeadBush(region, worldX, worldY, worldZ) {
     if (
          !canReplaceDecorationBlock(
               getRegionBlock(region, worldX, worldY, worldZ),
          )
     ) {
          return false;
     }
     const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
     if (below !== BLOCKS.SAND) {
          return false;
     }
     setRegionBlock(region, worldX, worldY, worldZ, EXTRA_BLOCKS.DEAD_BUSH);
     return true;
}

function placeMushroom(region, worldX, worldY, worldZ, blockId) {
     if (
          !canReplaceDecorationBlock(
               getRegionBlock(region, worldX, worldY, worldZ),
          )
     ) {
          return false;
     }
     if (
          !isSolidRenderBlock(
               getRegionBlock(region, worldX, worldY - 1, worldZ),
          )
     ) {
          return false;
     }
     if (hasSkyAccessApprox(region, worldX, worldY, worldZ)) {
          return false;
     }
     setRegionBlock(region, worldX, worldY, worldZ, blockId);
     return true;
}

function placePumpkin(region, worldX, worldY, worldZ) {
     if (
          !canReplaceDecorationBlock(
               getRegionBlock(region, worldX, worldY, worldZ),
          )
     ) {
          return false;
     }
     if (getRegionBlock(region, worldX, worldY - 1, worldZ) !== BLOCKS.GRASS) {
          return false;
     }
     setRegionBlock(region, worldX, worldY, worldZ, EXTRA_BLOCKS.PUMPKIN);
     return true;
}

function canPlaceReeds(region, worldX, worldY, worldZ) {
     if (
          !canReplaceDecorationBlock(
               getRegionBlock(region, worldX, worldY, worldZ),
          )
     ) {
          return false;
     }

     const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
     if (below === EXTRA_BLOCKS.REEDS) {
          return true;
     }

     if (!REED_SUPPORT.has(below)) {
          return false;
     }

     return hasAdjacentLiquid(region, worldX, worldY - 1, worldZ, BLOCKS.WATER);
}

function placeReeds(region, random, worldX, worldY, worldZ) {
     if (!canPlaceReeds(region, worldX, worldY, worldZ)) {
          return false;
     }

     const height = 2 + random.nextInt(random.nextInt(3) + 1);
     let placed = 0;

     for (let offsetY = 0; offsetY < height; offsetY += 1) {
          const currentY = worldY + offsetY;
          if (!canPlaceReeds(region, worldX, currentY, worldZ)) {
               break;
          }
          setRegionBlock(region, worldX, currentY, worldZ, EXTRA_BLOCKS.REEDS);
          placed += 1;
     }

     return placed > 0;
}

function canPlaceCactus(region, worldX, worldY, worldZ) {
     if (
          !canReplaceDecorationBlock(
               getRegionBlock(region, worldX, worldY, worldZ),
          )
     ) {
          return false;
     }

     const below = getRegionBlock(region, worldX, worldY - 1, worldZ);
     if (below !== BLOCKS.SAND && below !== EXTRA_BLOCKS.CACTUS) {
          return false;
     }

     return (
          countHorizontalNeighbors(region, worldX, worldY, worldZ, (blockId) =>
               isSolid(blockId),
          ) === 0
     );
}

function placeCactus(region, random, worldX, worldY, worldZ) {
     if (!canPlaceCactus(region, worldX, worldY, worldZ)) {
          return false;
     }

     const height = 1 + random.nextInt(random.nextInt(3) + 1);
     let placed = 0;

     for (let offsetY = 0; offsetY < height; offsetY += 1) {
          const currentY = worldY + offsetY;
          if (!canPlaceCactus(region, worldX, currentY, worldZ)) {
               break;
          }
          setRegionBlock(region, worldX, currentY, worldZ, EXTRA_BLOCKS.CACTUS);
          placed += 1;
     }

     return placed > 0;
}

function placePlantFeature(
     region,
     random,
     worldX,
     worldY,
     worldZ,
     attempts,
     callback,
) {
     for (let attempt = 0; attempt < attempts; attempt += 1) {
          const x = worldX + random.nextInt(8) - random.nextInt(8);
          const y = worldY + random.nextInt(4) - random.nextInt(4);
          const z = worldZ + random.nextInt(8) - random.nextInt(8);
          if (y < 1 || y >= 128) {
               continue;
          }
          callback(x, y, z);
     }
     return true;
}

function placeFlowerFeature(region, random, worldX, worldY, worldZ, blockId) {
     return placePlantFeature(
          region,
          random,
          worldX,
          worldY,
          worldZ,
          64,
          (x, y, z) => {
               placeFlower(region, x, y, z, blockId);
          },
     );
}

function placeTallGrassFeature(region, random, worldX, worldY, worldZ) {
     const baseY = descendFeatureBaseY(region, worldX, worldY, worldZ);
     return placePlantFeature(
          region,
          random,
          worldX,
          baseY,
          worldZ,
          128,
          (x, y, z) => {
               placeTallGrass(region, x, y, z);
          },
     );
}

function placeDeadBushFeature(region, random, worldX, worldY, worldZ) {
     const baseY = descendFeatureBaseY(region, worldX, worldY, worldZ);
     return placePlantFeature(
          region,
          random,
          worldX,
          baseY,
          worldZ,
          4,
          (x, y, z) => {
               placeDeadBush(region, x, y, z);
          },
     );
}

function placePumpkinFeature(region, random, worldX, worldY, worldZ) {
     return placePlantFeature(
          region,
          random,
          worldX,
          worldY,
          worldZ,
          64,
          (x, y, z) => {
               placePumpkin(region, x, y, z);
          },
     );
}

function placeSugarCaneFeature(region, random, worldX, worldY, worldZ) {
     for (let attempt = 0; attempt < 20; attempt += 1) {
          const x = worldX + random.nextInt(4) - random.nextInt(4);
          const z = worldZ + random.nextInt(4) - random.nextInt(4);
          placeReeds(region, random, x, worldY, z);
     }
     return true;
}

function placeCactusFeature(region, random, worldX, worldY, worldZ) {
     for (let attempt = 0; attempt < 10; attempt += 1) {
          const x = worldX + random.nextInt(8) - random.nextInt(8);
          const y = worldY + random.nextInt(4) - random.nextInt(4);
          const z = worldZ + random.nextInt(8) - random.nextInt(8);
          if (y < 1 || y >= 128) {
               continue;
          }
          placeCactus(region, random, x, y, z);
     }
     return true;
}

function getYellowFlowerCount(sourceBiome) {
     let yellowFlowers = 0;
     if (sourceBiome === BIOME_IDS.FOREST) {
          yellowFlowers = 2;
     } else if (sourceBiome === BIOME_IDS.SEASONAL_FOREST) {
          yellowFlowers = 4;
     } else if (sourceBiome === BIOME_IDS.TAIGA) {
          yellowFlowers = 2;
     } else if (sourceBiome === BIOME_IDS.PLAINS) {
          yellowFlowers = 3;
     }

     return yellowFlowers;
}

function getTallGrassCount(sourceBiome) {
     let tallGrass = 0;
     if (sourceBiome === BIOME_IDS.FOREST) {
          tallGrass = 2;
     } else if (sourceBiome === BIOME_IDS.RAINFOREST) {
          tallGrass = 10;
     } else if (sourceBiome === BIOME_IDS.SEASONAL_FOREST) {
          tallGrass = 2;
     } else if (sourceBiome === BIOME_IDS.TAIGA) {
          tallGrass = 1;
     } else if (sourceBiome === BIOME_IDS.PLAINS) {
          tallGrass = 10;
     }

     return tallGrass;
}

function nextFeatureX(random, chunkX) {
     return chunkX * 16 + random.nextInt(16) + 8;
}

function nextFeatureZ(random, chunkZ) {
     return chunkZ * 16 + random.nextInt(16) + 8;
}

function nextFeatureY(random) {
     return random.nextInt(128);
}

export function createFloraSession(
     region,
     sourceBiome,
     random,
     chunkX,
     chunkZ,
) {
     return {
          region,
          sourceBiome,
          random,
          chunkX,
          chunkZ,
          yellowFlowers: getYellowFlowerCount(sourceBiome),
          tallGrass: getTallGrassCount(sourceBiome),
          stage: "yellow_flowers",
          stageAttempt: 0,
          complete: false,
     };
}

export function advanceFloraSession(session) {
     if (session.complete) {
          return false;
     }

     switch (session.stage) {
          case "yellow_flowers":
               if (session.stageAttempt < session.yellowFlowers) {
                    placeFlowerFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                         EXTRA_BLOCKS.YELLOW_FLOWER,
                    );
                    session.stageAttempt += 1;
                    return true;
               }
               session.stage = "red_flower";
               session.stageAttempt = 0;
               return true;

          case "red_flower":
               if (session.random.nextInt(2) === 0) {
                    placeFlowerFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                         EXTRA_BLOCKS.RED_FLOWER,
                    );
               }
               session.stage = "brown_mushroom";
               return true;

          case "brown_mushroom":
               if (session.random.nextInt(4) === 0) {
                    placePlantFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                         64,
                         (x, y, z) =>
                              placeMushroom(
                                   session.region,
                                   x,
                                   y,
                                   z,
                                   EXTRA_BLOCKS.BROWN_MUSHROOM,
                              ),
                    );
               }
               session.stage = "red_mushroom";
               return true;

          case "red_mushroom":
               if (session.random.nextInt(8) === 0) {
                    placePlantFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                         64,
                         (x, y, z) =>
                              placeMushroom(
                                   session.region,
                                   x,
                                   y,
                                   z,
                                   EXTRA_BLOCKS.RED_MUSHROOM,
                              ),
                    );
               }
               session.stage = "tall_grass";
               session.stageAttempt = 0;
               return true;

          case "tall_grass":
               if (session.stageAttempt < session.tallGrass) {
                    if (session.sourceBiome === BIOME_IDS.RAINFOREST) {
                         session.random.nextInt(3);
                    }
                    placeTallGrassFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                    );
                    session.stageAttempt += 1;
                    return true;
               }
               session.stage =
                    session.sourceBiome === BIOME_IDS.DESERT
                         ? "dead_bush"
                         : "sugar_cane";
               session.stageAttempt = 0;
               return true;

          case "dead_bush":
               if (session.stageAttempt < 2) {
                    placeDeadBushFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                    );
                    session.stageAttempt += 1;
                    return true;
               }
               session.stage = "sugar_cane";
               session.stageAttempt = 0;
               return true;

          case "sugar_cane":
               if (session.stageAttempt < 10) {
                    placeSugarCaneFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                    );
                    session.stageAttempt += 1;
                    return true;
               }
               session.stage = "pumpkin";
               return true;

          case "pumpkin":
               if (session.random.nextInt(32) === 0) {
                    placePumpkinFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                    );
               }
               session.stage =
                    session.sourceBiome === BIOME_IDS.DESERT
                         ? "cactus"
                         : "complete";
               session.stageAttempt = 0;
               if (session.stage === "complete") {
                    session.complete = true;
               }
               return true;

          case "cactus":
               if (session.stageAttempt < 10) {
                    placeCactusFeature(
                         session.region,
                         session.random,
                         nextFeatureX(session.random, session.chunkX),
                         nextFeatureY(session.random),
                         nextFeatureZ(session.random, session.chunkZ),
                    );
                    session.stageAttempt += 1;
                    return true;
               }
               session.complete = true;
               session.stage = "complete";
               return true;

          default:
               session.complete = true;
               return false;
     }
}

export function applyFlora(region, sourceBiome, random, chunkX, chunkZ) {
     const session = createFloraSession(
          region,
          sourceBiome,
          random,
          chunkX,
          chunkZ,
     );
     while (advanceFloraSession(session)) {}
}

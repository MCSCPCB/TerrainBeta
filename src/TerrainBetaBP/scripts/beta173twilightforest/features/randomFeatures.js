import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
     getRegionBlock,
     getRegionPrecipitationY,
     isSolid,
     setRegionBlock,
} from "../population/shared.js";
import {
     drawCircle,
     isAreaClear,
     putBlock,
     putBlockWithMetadata,
     randStone,
} from "./primitives.js";

function getFeatureY(region, worldX, worldZ) {
     return getRegionPrecipitationY(region, worldX, worldZ);
}

function generateStoneCircle(region, worldX, worldY, worldZ) {
     for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
          for (let offsetZ = -3; offsetZ <= 3; offsetZ += 1) {
               for (let offsetY = 0; offsetY <= 4; offsetY += 1) {
                    if (
                         !isSolid(
                              getRegionBlock(
                                   region,
                                   worldX + offsetX,
                                   worldY - 1,
                                   worldZ + offsetZ,
                              ),
                         )
                    ) {
                         return false;
                    }
                    if (
                         getRegionBlock(
                              region,
                              worldX + offsetX,
                              worldY + offsetY,
                              worldZ + offsetZ,
                         ) !== BLOCKS.AIR
                    ) {
                         return false;
                    }
               }
          }
     }

     for (let offsetY = 0; offsetY <= 2; offsetY += 1) {
          putBlock(
               region,
               worldX - 3,
               worldY + offsetY,
               worldZ,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX + 3,
               worldY + offsetY,
               worldZ,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX,
               worldY + offsetY,
               worldZ - 3,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX,
               worldY + offsetY,
               worldZ + 3,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX - 2,
               worldY + offsetY,
               worldZ - 2,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX + 2,
               worldY + offsetY,
               worldZ - 2,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX - 2,
               worldY + offsetY,
               worldZ + 2,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX + 2,
               worldY + offsetY,
               worldZ + 2,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
     }

     return true;
}

function fillWellColumn(region, worldX, worldY, worldZ) {
     for (let offsetY = -1; offsetY >= -20; offsetY -= 1) {
          const blockId = getRegionBlock(
               region,
               worldX,
               worldY + offsetY,
               worldZ,
          );
          if (
               blockId !== BLOCKS.DIRT &&
               blockId !== BLOCKS.GRASS &&
               blockId !== BLOCKS.GRAVEL &&
               blockId !== BLOCKS.STONE &&
               blockId !== BLOCKS.SAND &&
               blockId !== BLOCKS.SANDSTONE
          ) {
               break;
          }
          if (
               !isSolid(
                    getRegionBlock(
                         region,
                         worldX,
                         worldY + offsetY - 1,
                         worldZ,
                    ),
               )
          ) {
               break;
          }
          putBlock(
               region,
               worldX,
               worldY + offsetY,
               worldZ,
               BLOCKS.WATER,
               true,
          );
     }
}

function generate3x3Well(region, worldX, worldY, worldZ) {
     if (!isAreaClear(region, worldX, worldY, worldZ, 3, 3, 4)) {
          return false;
     }

     for (const [offsetX, offsetZ] of [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 2],
          [1, 2],
          [2, 2],
          [0, 1],
          [2, 1],
     ]) {
          putBlock(
               region,
               worldX + offsetX,
               worldY,
               worldZ + offsetZ,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
     }
     putBlock(region, worldX + 1, worldY, worldZ + 1, BLOCKS.WATER, true);

     for (const [offsetX, offsetZ] of [
          [0, 0],
          [2, 0],
          [0, 2],
          [2, 2],
     ]) {
          putBlock(
               region,
               worldX + offsetX,
               worldY + 1,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_FENCE,
               true,
          );
          putBlock(
               region,
               worldX + offsetX,
               worldY + 2,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_FENCE,
               true,
          );
     }

     for (const [offsetX, offsetZ] of [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 2],
          [1, 2],
          [2, 2],
          [0, 1],
          [2, 1],
     ]) {
          putBlock(
               region,
               worldX + offsetX,
               worldY + 3,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_SLAB,
               true,
          );
     }
     putBlock(
          region,
          worldX + 1,
          worldY + 3,
          worldZ + 1,
          EXTRA_BLOCKS.OAK_PLANKS,
          true,
     );
     fillWellColumn(region, worldX + 1, worldY, worldZ + 1);
     return true;
}

function generate4x4Well(region, worldX, worldY, worldZ) {
     if (!isAreaClear(region, worldX, worldY, worldZ, 4, 4, 4)) {
          return false;
     }

     for (let offsetX = 0; offsetX <= 3; offsetX += 1) {
          putBlock(
               region,
               worldX + offsetX,
               worldY,
               worldZ,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX + offsetX,
               worldY,
               worldZ + 3,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
     }
     for (let offsetZ = 1; offsetZ <= 2; offsetZ += 1) {
          putBlock(
               region,
               worldX,
               worldY,
               worldZ + offsetZ,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
          putBlock(
               region,
               worldX + 3,
               worldY,
               worldZ + offsetZ,
               EXTRA_BLOCKS.COBBLESTONE,
               true,
          );
     }

     for (let offsetX = 1; offsetX <= 2; offsetX += 1) {
          for (let offsetZ = 1; offsetZ <= 2; offsetZ += 1) {
               putBlock(
                    region,
                    worldX + offsetX,
                    worldY,
                    worldZ + offsetZ,
                    BLOCKS.WATER,
                    true,
               );
          }
     }

     for (const [offsetX, offsetZ] of [
          [0, 0],
          [3, 0],
          [0, 3],
          [3, 3],
     ]) {
          putBlock(
               region,
               worldX + offsetX,
               worldY + 1,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_FENCE,
               true,
          );
          putBlock(
               region,
               worldX + offsetX,
               worldY + 2,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_FENCE,
               true,
          );
     }

     for (let offsetX = 0; offsetX <= 3; offsetX += 1) {
          putBlock(
               region,
               worldX + offsetX,
               worldY + 3,
               worldZ,
               EXTRA_BLOCKS.OAK_SLAB,
               true,
          );
          putBlock(
               region,
               worldX + offsetX,
               worldY + 3,
               worldZ + 3,
               EXTRA_BLOCKS.OAK_SLAB,
               true,
          );
     }
     for (let offsetZ = 1; offsetZ <= 2; offsetZ += 1) {
          putBlock(
               region,
               worldX,
               worldY + 3,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_SLAB,
               true,
          );
          putBlock(
               region,
               worldX + 3,
               worldY + 3,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_SLAB,
               true,
          );
     }
     for (let offsetX = 1; offsetX <= 2; offsetX += 1) {
          for (let offsetZ = 1; offsetZ <= 2; offsetZ += 1) {
               putBlock(
                    region,
                    worldX + offsetX,
                    worldY + 3,
                    worldZ + offsetZ,
                    EXTRA_BLOCKS.OAK_PLANKS,
                    true,
               );
               fillWellColumn(
                    region,
                    worldX + offsetX,
                    worldY,
                    worldZ + offsetZ,
               );
          }
     }

     return true;
}

function generateWell(region, random, worldX, worldY, worldZ) {
     if (random.nextInt(4) === 0) {
          return generate4x4Well(region, worldX, worldY, worldZ);
     }
     return generate3x3Well(region, worldX, worldY, worldZ);
}

function generateFoundation(region, random, worldX, worldY, worldZ) {
     const sizeX = 5 + random.nextInt(5);
     const sizeZ = 5 + random.nextInt(5);
     if (!isAreaClear(region, worldX, worldY, worldZ, sizeX, sizeZ, 4)) {
          return false;
     }

     for (let offsetX = 0; offsetX <= sizeX; offsetX += 1) {
          for (let offsetZ = 0; offsetZ <= sizeZ; offsetZ += 1) {
               if (
                    offsetX === 0 ||
                    offsetX === sizeX ||
                    offsetZ === 0 ||
                    offsetZ === sizeZ
               ) {
                    const height = random.nextInt(4) + 1;
                    for (let offsetY = 0; offsetY <= height; offsetY += 1) {
                         putBlock(
                              region,
                              worldX + offsetX,
                              worldY + offsetY - 1,
                              worldZ + offsetZ,
                              randStone(random, offsetY + 1),
                              true,
                         );
                    }
                    continue;
               }
               if (random.nextInt(3) !== 0) {
                    putBlock(
                         region,
                         worldX + offsetX,
                         worldY - 1,
                         worldZ + offsetZ,
                         EXTRA_BLOCKS.OAK_PLANKS,
                         true,
                    );
               }
          }
     }

     return true;
}

function generateMonolith(region, random, worldX, worldY, worldZ) {
     const height = random.nextInt(10) + 10;
     const direction = random.nextInt(4);
     if (!isAreaClear(region, worldX, worldY, worldZ, 2, 2, height)) {
          return false;
     }

     let h0;
     let h1;
     let h2;
     let h3;
     switch (direction) {
          case 0:
               h0 = height;
               h1 = Math.trunc(height * 0.75);
               h2 = Math.trunc(height * 0.75);
               h3 = Math.trunc(height * 0.5);
               break;
          case 1:
               h0 = Math.trunc(height * 0.5);
               h1 = height;
               h2 = Math.trunc(height * 0.75);
               h3 = Math.trunc(height * 0.75);
               break;
          case 2:
               h0 = Math.trunc(height * 0.75);
               h1 = Math.trunc(height * 0.5);
               h2 = height;
               h3 = Math.trunc(height * 0.75);
               break;
          default:
               h0 = Math.trunc(height * 0.75);
               h1 = Math.trunc(height * 0.75);
               h2 = Math.trunc(height * 0.5);
               h3 = height;
               break;
     }

     const heights = [h0, h1, h2, h3];
     const columns = [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
     ];
     for (let index = 0; index < columns.length; index += 1) {
          const [offsetX, offsetZ] = columns[index];
          for (let offsetY = 0; offsetY <= heights[index]; offsetY += 1) {
               const blockId =
                    offsetY === height
                         ? EXTRA_BLOCKS.LAPIS_BLOCK
                         : EXTRA_BLOCKS.OBSIDIAN;
               putBlock(
                    region,
                    worldX + offsetX,
                    worldY + offsetY - 1,
                    worldZ + offsetZ,
                    blockId,
                    true,
               );
          }
     }

     return true;
}

function makeStoneSpike(region, random, worldX, worldY, worldZ, length) {
     const width = Math.trunc(length / 4.5);
     for (let offsetX = -width; offsetX <= width; offsetX += 1) {
          for (let offsetZ = -width; offsetZ <= width; offsetZ += 1) {
               const distance = Math.trunc(
                    Math.max(Math.abs(offsetX), Math.abs(offsetZ)) +
                         Math.min(Math.abs(offsetX), Math.abs(offsetZ)) * 0.5,
               );
               let segmentLength = 0;
               if (distance === 0) {
                    segmentLength = length;
               } else if (distance > 0) {
                    segmentLength = random.nextInt(
                         Math.max(1, Math.trunc(length / (distance + 0.25))),
                    );
               }
               for (let offsetY = 0; offsetY < segmentLength; offsetY += 1) {
                    putBlock(
                         region,
                         worldX + offsetX,
                         worldY + offsetY,
                         worldZ + offsetZ,
                         BLOCKS.STONE,
                         false,
                    );
               }
          }
     }
     return true;
}

function generateOutsideStalagmite(region, random, worldX, worldY, worldZ) {
     const length = random.nextInt(10) + 5;
     if (!isAreaClear(region, worldX, worldY, worldZ, 1, 1, length)) {
          return false;
     }
     return makeStoneSpike(region, random, worldX, worldY - 1, worldZ, length);
}

function generateWitchHut(region, random, worldX, worldY, worldZ) {
     if (!isAreaClear(region, worldX, worldY, worldZ, 5, 7, 6)) {
          return false;
     }

     const setStone = (offsetX, offsetY, offsetZ, howMuch) => {
          putBlock(
               region,
               worldX + offsetX,
               worldY + offsetY,
               worldZ + offsetZ,
               randStone(random, howMuch),
               true,
          );
     };
     const setPlanks = (offsetX, offsetY, offsetZ) => {
          putBlock(
               region,
               worldX + offsetX,
               worldY + offsetY,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_PLANKS,
               true,
          );
     };
     const setRoof = (offsetX, offsetY, offsetZ) => {
          putBlockWithMetadata(
               region,
               worldX + offsetX,
               worldY + offsetY,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_PLANKS,
               2,
               true,
          );
     };
     const setRoofEdge = (offsetX, offsetY, offsetZ) => {
          putBlockWithMetadata(
               region,
               worldX + offsetX,
               worldY + offsetY,
               worldZ + offsetZ,
               EXTRA_BLOCKS.OAK_SLAB,
               2,
               true,
          );
     };

     setStone(1, 0, 1, 1);
     setStone(2, 0, 1, 1);
     setStone(3, 0, 1, 1);
     setStone(5, 0, 1, 1);
     setPlanks(0, 0, 2);
     setPlanks(1, 0, 2);
     setStone(5, 0, 2, 1);
     setPlanks(0, 0, 3);
     setStone(5, 0, 3, 1);
     setPlanks(0, 0, 4);
     setPlanks(1, 0, 4);
     setStone(5, 0, 4, 1);
     setStone(1, 0, 5, 1);
     setStone(2, 0, 5, 1);
     setStone(3, 0, 5, 1);
     setStone(5, 0, 5, 1);
     setStone(1, 1, 1, 2);
     setStone(3, 1, 1, 2);
     setStone(5, 1, 1, 2);
     setPlanks(0, 1, 2);
     setPlanks(1, 1, 2);
     setStone(5, 1, 2, 2);
     setPlanks(0, 1, 3);
     setPlanks(0, 1, 4);
     setPlanks(1, 1, 4);
     setStone(5, 1, 4, 2);
     setStone(1, 1, 5, 2);
     setStone(3, 1, 5, 2);
     setStone(5, 1, 5, 2);
     setStone(1, 2, 1, 3);
     setStone(2, 2, 1, 3);
     setStone(3, 2, 1, 3);
     setStone(4, 2, 1, 3);
     setStone(5, 2, 1, 3);
     setPlanks(0, 2, 2);
     setPlanks(1, 2, 2);
     setStone(5, 2, 2, 3);
     setPlanks(0, 2, 3);
     setStone(5, 2, 3, 3);
     setPlanks(0, 2, 4);
     setPlanks(1, 2, 4);
     setStone(5, 2, 4, 1);
     setStone(1, 2, 5, 3);
     setStone(2, 2, 5, 3);
     setStone(3, 2, 5, 3);
     setStone(4, 2, 5, 3);
     setStone(5, 2, 5, 3);
     setPlanks(0, 3, 2);
     setPlanks(0, 3, 3);
     setPlanks(0, 3, 4);
     setStone(2, 3, 1, 4);
     setStone(3, 3, 1, 4);
     setStone(4, 3, 1, 4);
     setStone(2, 3, 5, 4);
     setStone(3, 3, 5, 4);
     setStone(4, 3, 5, 4);
     setPlanks(0, 4, 3);
     setStone(3, 4, 1, 5);
     setStone(3, 4, 5, 5);
     setPlanks(0, 5, 3);
     setPlanks(0, 6, 3);

     for (const [offsetX, offsetY, offsetZ] of [
          [0, 2, 0],
          [0, 2, 1],
          [0, 2, 5],
          [0, 2, 6],
          [6, 2, 0],
          [6, 2, 1],
          [6, 2, 2],
          [6, 2, 3],
          [6, 2, 4],
          [6, 2, 5],
          [6, 2, 6],
          [1, 3, 0],
          [1, 3, 1],
          [1, 3, 2],
          [1, 3, 4],
          [1, 3, 5],
          [1, 3, 6],
          [5, 3, 0],
          [5, 3, 1],
          [5, 3, 2],
          [5, 3, 3],
          [5, 3, 4],
          [5, 3, 5],
          [5, 3, 6],
          [2, 4, 0],
          [2, 4, 1],
          [2, 4, 2],
          [2, 4, 3],
          [2, 4, 4],
          [2, 4, 5],
          [2, 4, 6],
          [4, 4, 0],
          [4, 4, 1],
          [4, 4, 2],
          [4, 4, 3],
          [4, 4, 4],
          [4, 4, 5],
          [4, 4, 6],
          [3, 5, 0],
          [3, 5, 1],
          [3, 5, 2],
          [3, 5, 3],
          [3, 5, 4],
          [3, 5, 5],
          [3, 5, 6],
          [3, 6, 0],
          [3, 6, 1],
          [3, 6, 5],
          [3, 6, 6],
     ]) {
          setRoof(offsetX, offsetY, offsetZ);
     }
     for (const [offsetX, offsetY, offsetZ] of [
          [1, 4, 0],
          [1, 4, 6],
          [5, 4, 0],
          [5, 4, 6],
          [2, 5, 0],
          [2, 5, 1],
          [4, 5, 0],
          [4, 5, 1],
          [2, 5, 5],
          [2, 5, 6],
          [4, 5, 5],
          [4, 5, 6],
          [3, 6, 2],
          [3, 6, 4],
          [3, 7, 0],
          [3, 7, 6],
     ]) {
          setRoofEdge(offsetX, offsetY, offsetZ);
     }

     putBlock(
          region,
          worldX + 1,
          worldY - 1,
          worldZ + 3,
          EXTRA_BLOCKS.NETHERRACK,
          true,
     );
     putBlock(
          region,
          worldX + 1,
          worldY + 0,
          worldZ + 3,
          EXTRA_BLOCKS.FIRE,
          true,
     );
     putBlock(
          region,
          worldX + 3,
          worldY + 1,
          worldZ + 3,
          EXTRA_BLOCKS.MOB_SPAWNER,
          true,
     );
     return true;
}

function selectRandomFeature(random) {
     switch (random.nextInt(6)) {
          case 0:
               return generateStoneCircle;
          case 1:
               return generateWell;
          case 2:
               return generateWitchHut;
          case 3:
               return generateOutsideStalagmite;
          case 4:
               return generateFoundation;
          case 5:
          default:
               return generateMonolith;
     }
}

export function createRandomFeatureSession(
     region,
     random,
     _sourceBiome,
     chunkX,
     chunkZ,
) {
     return {
          region,
          random,
          chunkX,
          chunkZ,
          complete: false,
     };
}

export function advanceRandomFeatureSession(session) {
     if (session.complete) {
          return false;
     }

     if (session.random.nextInt(4) === 0) {
          const worldX = session.chunkX * 16 + session.random.nextInt(16) + 8;
          const worldZ = session.chunkZ * 16 + session.random.nextInt(16) + 8;
          const worldY = getFeatureY(session.region, worldX, worldZ);
          if (worldY > 0) {
               selectRandomFeature(session.random)(
                    session.region,
                    session.random,
                    worldX,
                    worldY,
                    worldZ,
               );
          }
     }

     session.complete = true;
     return true;
}

export function applyTwilightRandomFeature(
     region,
     random,
     sourceBiome,
     chunkX,
     chunkZ,
) {
     const session = createRandomFeatureSession(
          region,
          random,
          sourceBiome,
          chunkX,
          chunkZ,
     );
     while (advanceRandomFeatureSession(session)) {}
}

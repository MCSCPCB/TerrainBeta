import { JavaRandom } from "../../beta173/random/java.js";
import { BLOCKS, BIOME_IDS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
     TREE_LEAF_BLOCKS,
     canReplaceTreeBlock,
     getRegionBlock,
     getRegionSurfaceY,
     isSolidRenderBlock,
     setRegionBlock,
} from "../population/shared.js";

const BIG_OAK_MINOR_AXES = [2, 0, 0, 1, 2, 1];

function putBlock(region, x, y, z, blockId, priority = false) {
     if (y < 0 || y >= 128) {
          return false;
     }

     if (!priority && getRegionBlock(region, x, y, z) !== BLOCKS.AIR) {
          return false;
     }

     setRegionBlock(region, x, y, z, blockId);
     return true;
}

function translate(sx, sy, sz, distance, angle, tilt) {
     const radiansAngle = angle * 2.0 * Math.PI;
     const radiansTilt = tilt * Math.PI;
     return [
          Math.trunc(
               sx +
                    Math.round(
                         Math.sin(radiansAngle) *
                              Math.sin(radiansTilt) *
                              distance,
                    ),
          ),
          Math.trunc(sy + Math.round(Math.cos(radiansTilt) * distance)),
          Math.trunc(
               sz +
                    Math.round(
                         Math.cos(radiansAngle) *
                              Math.sin(radiansTilt) *
                              distance,
                    ),
          ),
     ];
}

function drawBresenham(
     region,
     x1,
     y1,
     z1,
     x2,
     y2,
     z2,
     blockId,
     priority = false,
) {
     const pixel = [x1, y1, z1];
     const dx = x2 - x1;
     const dy = y2 - y1;
     const dz = z2 - z1;
     const xIncrement = dx < 0 ? -1 : 1;
     const yIncrement = dy < 0 ? -1 : 1;
     const zIncrement = dz < 0 ? -1 : 1;
     const absX = Math.abs(dx);
     const absY = Math.abs(dy);
     const absZ = Math.abs(dz);
     const dx2 = absX << 1;
     const dy2 = absY << 1;
     const dz2 = absZ << 1;

     if (absX >= absY && absX >= absZ) {
          let errorY = dy2 - absX;
          let errorZ = dz2 - absX;
          for (let step = 0; step < absX; step += 1) {
               putBlock(
                    region,
                    pixel[0],
                    pixel[1],
                    pixel[2],
                    blockId,
                    priority,
               );
               if (errorY > 0) {
                    pixel[1] += yIncrement;
                    errorY -= dx2;
               }
               if (errorZ > 0) {
                    pixel[2] += zIncrement;
                    errorZ -= dx2;
               }
               errorY += dy2;
               errorZ += dz2;
               pixel[0] += xIncrement;
          }
     } else if (absY >= absX && absY >= absZ) {
          let errorX = dx2 - absY;
          let errorZ = dz2 - absY;
          for (let step = 0; step < absY; step += 1) {
               putBlock(
                    region,
                    pixel[0],
                    pixel[1],
                    pixel[2],
                    blockId,
                    priority,
               );
               if (errorX > 0) {
                    pixel[0] += xIncrement;
                    errorX -= dy2;
               }
               if (errorZ > 0) {
                    pixel[2] += zIncrement;
                    errorZ -= dy2;
               }
               errorX += dx2;
               errorZ += dz2;
               pixel[1] += yIncrement;
          }
     } else {
          let errorY = dy2 - absZ;
          let errorX = dx2 - absZ;
          for (let step = 0; step < absZ; step += 1) {
               putBlock(
                    region,
                    pixel[0],
                    pixel[1],
                    pixel[2],
                    blockId,
                    priority,
               );
               if (errorY > 0) {
                    pixel[1] += yIncrement;
                    errorY -= dz2;
               }
               if (errorX > 0) {
                    pixel[0] += xIncrement;
                    errorX -= dz2;
               }
               errorY += dy2;
               errorX += dx2;
               pixel[2] += zIncrement;
          }
     }

     putBlock(region, pixel[0], pixel[1], pixel[2], blockId, priority);
}

function drawCircle(region, sx, sy, sz, radius, blockId, priority = false) {
     for (let dx = 0; dx <= radius; dx += 1) {
          for (let dz = 0; dz <= radius; dz += 1) {
               let distance = Math.trunc(
                    Math.max(dx, dz) + Math.min(dx, dz) * 0.5,
               );
               if (dx === 3 && dz === 3) {
                    distance = 6;
               }
               if (distance > radius) {
                    continue;
               }
               putBlock(region, sx + dx, sy, sz + dz, blockId, priority);
               putBlock(region, sx + dx, sy, sz - dz, blockId, priority);
               putBlock(region, sx - dx, sy, sz + dz, blockId, priority);
               putBlock(region, sx - dx, sy, sz - dz, blockId, priority);
          }
     }
}

function placeRoundLeafDisc(
     region,
     centerX,
     centerY,
     centerZ,
     radius,
     leafBlock,
) {
     const roundedRadius = Math.trunc(radius + 0.618);
     for (
          let offsetX = -roundedRadius;
          offsetX <= roundedRadius;
          offsetX += 1
     ) {
          for (
               let offsetZ = -roundedRadius;
               offsetZ <= roundedRadius;
               offsetZ += 1
          ) {
               const distance = Math.sqrt(
                    (Math.abs(offsetX) + 0.5) ** 2 +
                         (Math.abs(offsetZ) + 0.5) ** 2,
               );
               if (distance > radius) {
                    continue;
               }

               const existing = getRegionBlock(
                    region,
                    centerX + offsetX,
                    centerY,
                    centerZ + offsetZ,
               );
               if (existing === BLOCKS.AIR || TREE_LEAF_BLOCKS.has(existing)) {
                    setRegionBlock(
                         region,
                         centerX + offsetX,
                         centerY,
                         centerZ + offsetZ,
                         leafBlock,
                    );
               }
          }
     }
}

function placeTreeFeature(
     region,
     random,
     x,
     y,
     z,
     height,
     logBlock,
     leafBlock,
) {
     let canPlace = true;
     if (y < 1 || y + height + 1 > 128) {
          return false;
     }

     for (let checkY = y; checkY <= y + 1 + height && canPlace; checkY += 1) {
          let radius = 1;
          if (checkY === y) {
               radius = 0;
          }
          if (checkY >= y + 1 + height - 2) {
               radius = 2;
          }

          for (
               let checkX = x - radius;
               checkX <= x + radius && canPlace;
               checkX += 1
          ) {
               for (
                    let checkZ = z - radius;
                    checkZ <= z + radius && canPlace;
                    checkZ += 1
               ) {
                    if (checkY < 0 || checkY >= 128) {
                         canPlace = false;
                         break;
                    }

                    if (
                         !canReplaceTreeBlock(
                              getRegionBlock(region, checkX, checkY, checkZ),
                         )
                    ) {
                         canPlace = false;
                    }
               }
          }
     }

     if (!canPlace) {
          return false;
     }

     const soil = getRegionBlock(region, x, y - 1, z);
     if (
          (soil !== BLOCKS.GRASS && soil !== BLOCKS.DIRT) ||
          y >= 128 - height - 1
     ) {
          return false;
     }

     setRegionBlock(region, x, y - 1, z, BLOCKS.DIRT);

     for (let leafY = y - 3 + height; leafY <= y + height; leafY += 1) {
          const layerOffset = leafY - (y + height);
          const radius = 1 - Math.trunc(layerOffset / 2);

          for (let leafX = x - radius; leafX <= x + radius; leafX += 1) {
               const offsetX = leafX - x;
               for (let leafZ = z - radius; leafZ <= z + radius; leafZ += 1) {
                    const offsetZ = leafZ - z;
                    const isCorner =
                         Math.abs(offsetX) === radius &&
                         Math.abs(offsetZ) === radius;
                    const existing = getRegionBlock(
                         region,
                         leafX,
                         leafY,
                         leafZ,
                    );
                    if (
                         (!isCorner ||
                              (random.nextInt(2) !== 0 && layerOffset !== 0)) &&
                         !isSolidRenderBlock(existing)
                    ) {
                         setRegionBlock(region, leafX, leafY, leafZ, leafBlock);
                    }
               }
          }
     }

     for (let trunkY = 0; trunkY < height; trunkY += 1) {
          const existing = getRegionBlock(region, x, y + trunkY, z);
          if (existing === BLOCKS.AIR || TREE_LEAF_BLOCKS.has(existing)) {
               setRegionBlock(region, x, y + trunkY, z, logBlock);
          }
     }

     return true;
}

function placePineTree(region, random, x, y, z) {
     const height = random.nextInt(5) + 7;
     const bareTrunkHeight = height - random.nextInt(2) - 3;
     const canopyHeight = height - bareTrunkHeight;
     const canopyRadius = 1 + random.nextInt(canopyHeight + 1);
     let canPlace = true;

     if (y < 1 || y + height + 1 > 128) {
          return false;
     }

     for (let checkY = y; checkY <= y + 1 + height && canPlace; checkY += 1) {
          const radius = checkY - y < bareTrunkHeight ? 0 : canopyRadius;
          for (
               let checkX = x - radius;
               checkX <= x + radius && canPlace;
               checkX += 1
          ) {
               for (
                    let checkZ = z - radius;
                    checkZ <= z + radius && canPlace;
                    checkZ += 1
               ) {
                    if (checkY < 0 || checkY >= 128) {
                         canPlace = false;
                         break;
                    }
                    if (
                         !canReplaceTreeBlock(
                              getRegionBlock(region, checkX, checkY, checkZ),
                         )
                    ) {
                         canPlace = false;
                    }
               }
          }
     }

     if (!canPlace) {
          return false;
     }

     const soil = getRegionBlock(region, x, y - 1, z);
     if (
          (soil !== BLOCKS.GRASS && soil !== BLOCKS.DIRT) ||
          y >= 128 - height - 1
     ) {
          return false;
     }

     setRegionBlock(region, x, y - 1, z, BLOCKS.DIRT);
     let radius = 0;
     for (let leafY = y + height; leafY >= y + bareTrunkHeight; leafY -= 1) {
          for (let leafX = x - radius; leafX <= x + radius; leafX += 1) {
               const offsetX = leafX - x;
               for (let leafZ = z - radius; leafZ <= z + radius; leafZ += 1) {
                    const offsetZ = leafZ - z;
                    const existing = getRegionBlock(
                         region,
                         leafX,
                         leafY,
                         leafZ,
                    );
                    if (
                         (Math.abs(offsetX) !== radius ||
                              Math.abs(offsetZ) !== radius ||
                              radius <= 0) &&
                         !isSolidRenderBlock(existing)
                    ) {
                         setRegionBlock(
                              region,
                              leafX,
                              leafY,
                              leafZ,
                              EXTRA_BLOCKS.SPRUCE_LEAVES,
                         );
                    }
               }
          }

          if (radius >= 1 && leafY === y + bareTrunkHeight + 1) {
               radius -= 1;
          } else if (radius < canopyRadius) {
               radius += 1;
          }
     }

     for (let trunkY = 0; trunkY < height - 1; trunkY += 1) {
          const existing = getRegionBlock(region, x, y + trunkY, z);
          if (existing === BLOCKS.AIR || TREE_LEAF_BLOCKS.has(existing)) {
               setRegionBlock(
                    region,
                    x,
                    y + trunkY,
                    z,
                    EXTRA_BLOCKS.SPRUCE_LOG,
               );
          }
     }

     return true;
}

function placeSpruceTree(region, random, x, y, z) {
     const height = random.nextInt(4) + 6;
     const crownBase = 1 + random.nextInt(2);
     const foliageHeight = height - crownBase;
     const maxRadius = 2 + random.nextInt(2);
     let canPlace = true;

     if (y < 1 || y + height + 1 > 128) {
          return false;
     }

     for (let checkY = y; checkY <= y + 1 + height && canPlace; checkY += 1) {
          const radius = checkY - y < crownBase ? 0 : maxRadius;
          for (
               let checkX = x - radius;
               checkX <= x + radius && canPlace;
               checkX += 1
          ) {
               for (
                    let checkZ = z - radius;
                    checkZ <= z + radius && canPlace;
                    checkZ += 1
               ) {
                    if (checkY < 0 || checkY >= 128) {
                         canPlace = false;
                         break;
                    }
                    if (
                         !canReplaceTreeBlock(
                              getRegionBlock(region, checkX, checkY, checkZ),
                         )
                    ) {
                         canPlace = false;
                    }
               }
          }
     }

     if (!canPlace) {
          return false;
     }

     const soil = getRegionBlock(region, x, y - 1, z);
     if (
          (soil !== BLOCKS.GRASS && soil !== BLOCKS.DIRT) ||
          y >= 128 - height - 1
     ) {
          return false;
     }

     setRegionBlock(region, x, y - 1, z, BLOCKS.DIRT);
     let radius = random.nextInt(2);
     let radiusThreshold = 1;
     let radiusReset = 0;

     for (let offsetY = 0; offsetY <= foliageHeight; offsetY += 1) {
          const leafY = y + height - offsetY;

          for (let leafX = x - radius; leafX <= x + radius; leafX += 1) {
               const deltaX = leafX - x;
               for (let leafZ = z - radius; leafZ <= z + radius; leafZ += 1) {
                    const deltaZ = leafZ - z;
                    const existing = getRegionBlock(
                         region,
                         leafX,
                         leafY,
                         leafZ,
                    );
                    if (
                         (Math.abs(deltaX) !== radius ||
                              Math.abs(deltaZ) !== radius ||
                              radius <= 0) &&
                         !isSolidRenderBlock(existing)
                    ) {
                         setRegionBlock(
                              region,
                              leafX,
                              leafY,
                              leafZ,
                              EXTRA_BLOCKS.SPRUCE_LEAVES,
                         );
                    }
               }
          }

          if (radius >= radiusThreshold) {
               radius = radiusReset;
               radiusReset = 1;
               radiusThreshold += 1;
               if (radiusThreshold > maxRadius) {
                    radiusThreshold = maxRadius;
               }
          } else {
               radius += 1;
          }
     }

     const trunkReduction = random.nextInt(3);
     for (let trunkY = 0; trunkY < height - trunkReduction; trunkY += 1) {
          const existing = getRegionBlock(region, x, y + trunkY, z);
          if (existing === BLOCKS.AIR || TREE_LEAF_BLOCKS.has(existing)) {
               setRegionBlock(
                    region,
                    x,
                    y + trunkY,
                    z,
                    EXTRA_BLOCKS.SPRUCE_LOG,
               );
          }
     }

     return true;
}

function bigOakTryBranch(region, from, to) {
     const delta = [0, 0, 0];
     let majorAxis = 0;

     for (let axis = 0; axis < 3; axis += 1) {
          delta[axis] = to[axis] - from[axis];
          if (Math.abs(delta[axis]) > Math.abs(delta[majorAxis])) {
               majorAxis = axis;
          }
     }

     if (delta[majorAxis] === 0) {
          return -1;
     }

     const minorAxis = BIG_OAK_MINOR_AXES[majorAxis];
     const otherAxis = BIG_OAK_MINOR_AXES[majorAxis + 3];
     const step = delta[majorAxis] > 0 ? 1 : -1;
     const slopeMinor = delta[minorAxis] / delta[majorAxis];
     const slopeOther = delta[otherAxis] / delta[majorAxis];
     const point = [0, 0, 0];
     let offset = 0;
     const limit = delta[majorAxis] + step;

     for (; offset !== limit; offset += step) {
          point[majorAxis] = from[majorAxis] + offset;
          point[minorAxis] = Math.floor(from[minorAxis] + offset * slopeMinor);
          point[otherAxis] = Math.floor(from[otherAxis] + offset * slopeOther);
          const block = getRegionBlock(region, point[0], point[1], point[2]);
          if (block !== BLOCKS.AIR && !TREE_LEAF_BLOCKS.has(block)) {
               break;
          }
     }

     return offset === limit ? -1 : Math.abs(offset);
}

function placeBigOakBranch(region, from, to, logBlock) {
     const delta = [0, 0, 0];
     let majorAxis = 0;

     for (let axis = 0; axis < 3; axis += 1) {
          delta[axis] = to[axis] - from[axis];
          if (Math.abs(delta[axis]) > Math.abs(delta[majorAxis])) {
               majorAxis = axis;
          }
     }

     if (delta[majorAxis] === 0) {
          return;
     }

     const minorAxis = BIG_OAK_MINOR_AXES[majorAxis];
     const otherAxis = BIG_OAK_MINOR_AXES[majorAxis + 3];
     const step = delta[majorAxis] > 0 ? 1 : -1;
     const slopeMinor = delta[minorAxis] / delta[majorAxis];
     const slopeOther = delta[otherAxis] / delta[majorAxis];
     const point = [0, 0, 0];

     for (
          let offset = 0, limit = delta[majorAxis] + step;
          offset !== limit;
          offset += step
     ) {
          point[majorAxis] = Math.floor(from[majorAxis] + offset + 0.5);
          point[minorAxis] = Math.floor(
               from[minorAxis] + offset * slopeMinor + 0.5,
          );
          point[otherAxis] = Math.floor(
               from[otherAxis] + offset * slopeOther + 0.5,
          );
          setRegionBlock(region, point[0], point[1], point[2], logBlock);
     }
}

function placeBigOakTree(region, random, x, y, z) {
     const featureRandom = new JavaRandom(random.nextLong());
     const config = {
          worldX: x,
          worldY: y,
          worldZ: z,
          trunkScale: 0.618,
          branchDensity: 1.0,
          branchSlope: 0.381,
          branchLengthScale: 1.0,
          foliageDensity: 1.0,
          trunkWidth: 1,
          maxTrunkHeight: 12,
          foliageClusterHeight: 5,
          height: 5 + featureRandom.nextInt(12),
          trunkHeight: 0,
          branches: [],
     };

     function getTreeShape(heightOffset) {
          if (heightOffset < config.height * 0.3) {
               return -1.618;
          }

          const center = config.height / 2.0;
          const distance = config.height / 2.0 - heightOffset;
          let radius;
          if (distance === 0.0) {
               radius = center;
          } else if (Math.abs(distance) >= center) {
               radius = 0.0;
          } else {
               radius = Math.sqrt(
                    Math.abs(center) ** 2 - Math.abs(distance) ** 2,
               );
          }
          return radius * 0.5;
     }

     function getClusterShape(layer) {
          if (layer < 0 || layer >= config.foliageClusterHeight) {
               return -1.0;
          }
          return layer !== 0 && layer !== config.foliageClusterHeight - 1
               ? 3.0
               : 2.0;
     }

     function placeFoliageCluster(clusterX, baseY, clusterZ) {
          for (
               let layerY = baseY;
               layerY < baseY + config.foliageClusterHeight;
               layerY += 1
          ) {
               const shape = getClusterShape(layerY - baseY);
               placeRoundLeafDisc(
                    region,
                    clusterX,
                    layerY,
                    clusterZ,
                    shape,
                    EXTRA_BLOCKS.OAK_LEAVES,
               );
          }
     }

     function shouldPlaceBranch(heightOffset) {
          return !(heightOffset < config.height * 0.2);
     }

     function canPlace() {
          const base = [config.worldX, config.worldY, config.worldZ];
          const top = [
               config.worldX,
               config.worldY + config.height - 1,
               config.worldZ,
          ];
          const soil = getRegionBlock(
               region,
               config.worldX,
               config.worldY - 1,
               config.worldZ,
          );
          if (soil !== BLOCKS.GRASS && soil !== BLOCKS.DIRT) {
               return false;
          }

          const branchHeight = bigOakTryBranch(region, base, top);
          if (branchHeight === -1) {
               return true;
          }
          if (branchHeight < 6) {
               return false;
          }

          config.height = branchHeight;
          return true;
     }

     function makeBranches() {
          config.trunkHeight = Math.trunc(config.height * config.trunkScale);
          if (config.trunkHeight >= config.height) {
               config.trunkHeight = config.height - 1;
          }

          let branchCount = Math.trunc(
               1.382 + ((config.foliageDensity * config.height) / 13.0) ** 2,
          );
          if (branchCount < 1) {
               branchCount = 1;
          }

          const branchData = new Array(branchCount * config.height);
          let clusterY =
               config.worldY + config.height - config.foliageClusterHeight;
          let clusterCount = 1;
          const trunkTopY = config.worldY + config.trunkHeight;
          let heightOffset = clusterY - config.worldY;
          branchData[0] = [config.worldX, clusterY, config.worldZ, trunkTopY];
          clusterY -= 1;

          while (heightOffset >= 0) {
               const treeShape = getTreeShape(heightOffset);
               if (treeShape < 0.0) {
                    clusterY -= 1;
                    heightOffset -= 1;
                    continue;
               }

               for (
                    let branchIndex = 0;
                    branchIndex < branchCount;
                    branchIndex += 1
               ) {
                    const branchLength =
                         config.branchLengthScale *
                         (treeShape * (featureRandom.nextFloat() + 0.328));
                    const angle = featureRandom.nextFloat() * 2.0 * 3.14159;
                    const branchX = Math.floor(
                         branchLength * Math.sin(angle) + config.worldX + 0.5,
                    );
                    const branchZ = Math.floor(
                         branchLength * Math.cos(angle) + config.worldZ + 0.5,
                    );
                    const foliageBase = [branchX, clusterY, branchZ];
                    const foliageTop = [
                         branchX,
                         clusterY + config.foliageClusterHeight,
                         branchZ,
                    ];

                    if (
                         bigOakTryBranch(region, foliageBase, foliageTop) !== -1
                    ) {
                         continue;
                    }

                    const trunkBase = [
                         config.worldX,
                         config.worldY,
                         config.worldZ,
                    ];
                    const distance = Math.sqrt(
                         Math.abs(config.worldX - foliageBase[0]) ** 2 +
                              Math.abs(config.worldZ - foliageBase[2]) ** 2,
                    );
                    const branchDrop = distance * config.branchSlope;
                    trunkBase[1] =
                         foliageBase[1] - branchDrop > trunkTopY
                              ? trunkTopY
                              : Math.trunc(foliageBase[1] - branchDrop);

                    if (
                         bigOakTryBranch(region, trunkBase, foliageBase) !== -1
                    ) {
                         continue;
                    }

                    branchData[clusterCount] = [
                         branchX,
                         clusterY,
                         branchZ,
                         trunkBase[1],
                    ];
                    clusterCount += 1;
               }

               clusterY -= 1;
               heightOffset -= 1;
          }

          config.branches = branchData.slice(0, clusterCount);
     }

     if (!canPlace()) {
          return false;
     }

     makeBranches();

     for (const branch of config.branches) {
          placeFoliageCluster(branch[0], branch[1], branch[2]);
     }

     setRegionBlock(
          region,
          config.worldX,
          config.worldY - 1,
          config.worldZ,
          BLOCKS.DIRT,
     );
     placeBigOakBranch(
          region,
          [config.worldX, config.worldY, config.worldZ],
          [config.worldX, config.worldY + config.trunkHeight, config.worldZ],
          EXTRA_BLOCKS.OAK_LOG,
     );

     for (const branch of config.branches) {
          const from = [config.worldX, branch[3], config.worldZ];
          const to = [branch[0], branch[1], branch[2]];
          if (shouldPlaceBranch(from[1] - config.worldY)) {
               placeBigOakBranch(region, from, to, EXTRA_BLOCKS.OAK_LOG);
          }
     }

     return true;
}

function placeCanopyTree(region, random, x, y, z) {
     const ground = getRegionBlock(region, x, y - 1, z);
     if ((ground !== BLOCKS.GRASS && ground !== BLOCKS.DIRT) || y >= 127) {
          return false;
     }

     const buildBranch = (height, length, angle, tilt) => {
          const src = [x, y + height, z];
          const dest = translate(src[0], src[1], src[2], length, angle, tilt);
          drawBresenham(
               region,
               src[0],
               src[1],
               src[2],
               dest[0],
               dest[1],
               dest[2],
               EXTRA_BLOCKS.SPRUCE_LOG,
               true,
          );
          putBlock(
               region,
               dest[0] + 1,
               dest[1],
               dest[2],
               EXTRA_BLOCKS.SPRUCE_LOG,
               true,
          );
          putBlock(
               region,
               dest[0] - 1,
               dest[1],
               dest[2],
               EXTRA_BLOCKS.SPRUCE_LOG,
               true,
          );
          putBlock(
               region,
               dest[0],
               dest[1],
               dest[2] + 1,
               EXTRA_BLOCKS.SPRUCE_LOG,
               true,
          );
          putBlock(
               region,
               dest[0],
               dest[1],
               dest[2] - 1,
               EXTRA_BLOCKS.SPRUCE_LOG,
               true,
          );
          drawCircle(
               region,
               dest[0],
               dest[1] - 1,
               dest[2],
               3,
               EXTRA_BLOCKS.SPRUCE_LEAVES,
               false,
          );
          drawCircle(
               region,
               dest[0],
               dest[1],
               dest[2],
               4,
               EXTRA_BLOCKS.SPRUCE_LEAVES,
               false,
          );
          drawCircle(
               region,
               dest[0],
               dest[1] + 1,
               dest[2],
               2,
               EXTRA_BLOCKS.SPRUCE_LEAVES,
               false,
          );
     };

     buildBranch(0, 20.0, 0.0, 0.0);
     const branchCount = 3 + random.nextInt(2);
     const offset = random.nextDouble();
     for (let branch = 0; branch < branchCount; branch += 1) {
          buildBranch(10 + branch, 9.0, 0.3 * branch + offset, 0.2);
     }

     return true;
}

function placeMangroveTree(region, random, x, y, z) {
     if (getRegionBlock(region, x, y - 1, z) !== BLOCKS.WATER || y >= 127) {
          return false;
     }

     const buildBranch = (height, length, angle, tilt) => {
          const src = [x, y + height, z];
          const dest = translate(src[0], src[1], src[2], length, angle, tilt);
          drawBresenham(
               region,
               src[0],
               src[1],
               src[2],
               dest[0],
               dest[1],
               dest[2],
               EXTRA_BLOCKS.OAK_LOG,
               true,
          );
          putBlock(
               region,
               dest[0] + 1,
               dest[1],
               dest[2],
               EXTRA_BLOCKS.OAK_LOG,
               true,
          );
          putBlock(
               region,
               dest[0] - 1,
               dest[1],
               dest[2],
               EXTRA_BLOCKS.OAK_LOG,
               true,
          );
          putBlock(
               region,
               dest[0],
               dest[1],
               dest[2] + 1,
               EXTRA_BLOCKS.OAK_LOG,
               true,
          );
          putBlock(
               region,
               dest[0],
               dest[1],
               dest[2] - 1,
               EXTRA_BLOCKS.OAK_LOG,
               true,
          );
          const branchSize = 2 + random.nextInt(3);
          drawCircle(
               region,
               dest[0],
               dest[1] - 1,
               dest[2],
               branchSize - 1,
               EXTRA_BLOCKS.BIRCH_LEAVES,
               false,
          );
          drawCircle(
               region,
               dest[0],
               dest[1],
               dest[2],
               branchSize,
               EXTRA_BLOCKS.BIRCH_LEAVES,
               false,
          );
          drawCircle(
               region,
               dest[0],
               dest[1] + 1,
               dest[2],
               branchSize - 2,
               EXTRA_BLOCKS.BIRCH_LEAVES,
               false,
          );
     };

     const buildRoot = (height, length, angle, tilt) => {
          const src = [x, y + height, z];
          const dest = translate(src[0], src[1], src[2], length, angle, tilt);
          drawBresenham(
               region,
               src[0],
               src[1],
               src[2],
               dest[0],
               dest[1],
               dest[2],
               EXTRA_BLOCKS.OAK_LOG,
               true,
          );
     };

     buildBranch(5, 6 + random.nextInt(3), 0.0, 0.0);
     const branchCount = random.nextInt(3);
     let offset = random.nextDouble();
     for (let branch = 0; branch < branchCount; branch += 1) {
          buildBranch(
               7 + branch,
               6 + random.nextInt(2),
               0.3 * branch + offset,
               0.25,
          );
     }

     const rootCount = 3 + random.nextInt(2);
     offset = random.nextDouble();
     for (let root = 0; root < rootCount; root += 1) {
          buildRoot(
               5,
               8.0,
               0.4 * root + offset,
               0.75 + random.nextDouble() * 0.1,
          );
     }

     return true;
}

function selectTwilightTreeType(sourceBiome, random) {
     switch (sourceBiome) {
          case BIOME_IDS.TWILIGHT_SWAMP:
               return random.nextInt(10) === 0 ? "oak" : "mangrove";

          case BIOME_IDS.TWILIGHT_SNOW:
          case BIOME_IDS.TWILIGHT_GLACIER:
               return random.nextInt(3) === 0 ? "pine" : "spruce";

          case BIOME_IDS.TWILIGHT_HIGHLAND:
               if (random.nextInt(10) === 0) {
                    return "big_oak";
               }
               return random.nextInt(7) === 0 ? "birch" : "oak";

          default:
               if (random.nextInt(5) === 0) {
                    return "canopy";
               }
               if (random.nextInt(10) === 0) {
                    return "big_oak";
               }
               return random.nextInt(7) === 0 ? "birch" : "oak";
     }
}

function placeSelectedTwilightTree(region, random, sourceBiome, x, y, z) {
     switch (selectTwilightTreeType(sourceBiome, random)) {
          case "canopy":
               return placeCanopyTree(region, random, x, y, z);
          case "mangrove":
               return placeMangroveTree(region, random, x, y, z);
          case "birch":
               return placeTreeFeature(
                    region,
                    random,
                    x,
                    y,
                    z,
                    random.nextInt(3) + 5,
                    EXTRA_BLOCKS.BIRCH_LOG,
                    EXTRA_BLOCKS.BIRCH_LEAVES,
               );
          case "pine":
               return placePineTree(region, random, x, y, z);
          case "spruce":
               return placeSpruceTree(region, random, x, y, z);
          case "big_oak":
               return placeBigOakTree(region, random, x, y, z);
          default:
               return placeTreeFeature(
                    region,
                    random,
                    x,
                    y,
                    z,
                    random.nextInt(3) + 4,
                    EXTRA_BLOCKS.OAK_LOG,
                    EXTRA_BLOCKS.OAK_LEAVES,
               );
     }
}

function getTwilightTreeCount(
     forestNoise,
     random,
     sourceBiome,
     chunkX,
     chunkZ,
) {
     const mapX = chunkX * 16;
     const mapZ = chunkZ * 16;
     const forestNoiseValue = forestNoise.generateNoiseForCoordinate(
          mapX * 0.5,
          mapZ * 0.5,
     );
     const baseCount = Math.trunc(
          (forestNoiseValue / 8.0 + random.nextDouble() * 4.0 + 4.0) / 3.0,
     );
     let count = baseCount + 20;

     if (sourceBiome === BIOME_IDS.TWILIGHT_SWAMP) {
          count -= 18;
     } else if (
          sourceBiome === BIOME_IDS.TWILIGHT_SNOW ||
          sourceBiome === BIOME_IDS.TWILIGHT_HIGHLAND ||
          sourceBiome === BIOME_IDS.TWILIGHT_GLACIER
     ) {
          count -= 10;
     } else if (sourceBiome === BIOME_IDS.TWILIGHT_CLEARINGS) {
          count = 0;
     }

     return Math.max(0, count);
}

export function createTreeSession(
     region,
     sourceBiome,
     forestNoise,
     random,
     chunkX,
     chunkZ,
) {
     return {
          region,
          sourceBiome,
          forestNoise,
          random,
          chunkX,
          chunkZ,
          treeCount: null,
          attempt: 0,
          complete: false,
     };
}

export function advanceTreeSession(session, maxAttempts = 1) {
     if (session.complete) {
          return false;
     }

     if (session.treeCount === null) {
          session.treeCount = getTwilightTreeCount(
               session.forestNoise,
               session.random,
               session.sourceBiome,
               session.chunkX,
               session.chunkZ,
          );
     }

     let processed = 0;
     while (processed < maxAttempts && session.attempt < session.treeCount) {
          const x = session.chunkX * 16 + session.random.nextInt(16) + 8;
          const z = session.chunkZ * 16 + session.random.nextInt(16) + 8;
          const baseY = getRegionSurfaceY(session.region, x, z) + 1;
          if (baseY >= 1 && baseY < 128) {
               placeSelectedTwilightTree(
                    session.region,
                    session.random,
                    session.sourceBiome,
                    x,
                    baseY,
                    z,
               );
          }

          session.attempt += 1;
          processed += 1;
     }

     session.complete = session.attempt >= session.treeCount;
     return processed > 0 || session.treeCount === 0;
}

export function applyTwilightTrees(
     region,
     sourceBiome,
     forestNoise,
     random,
     chunkX,
     chunkZ,
) {
     const session = createTreeSession(
          region,
          sourceBiome,
          forestNoise,
          random,
          chunkX,
          chunkZ,
     );
     while (advanceTreeSession(session)) {}
}

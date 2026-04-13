import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
  TREE_LEAF_BLOCKS,
  getRegionBlock,
} from "../population/shared.js";
import {
  drawBlob,
  drawBresenham,
  putBlock,
  putBlockWithMetadata,
  translate,
} from "./primitives.js";

function canGenerateHollowTree(region, worldX, worldY, worldZ, height, diameter) {
  if (worldY < 1 || worldY + height + diameter + 1 > 128) {
    return false;
  }

  for (let offsetX = -diameter; offsetX <= diameter; offsetX += 1) {
    for (let offsetZ = -diameter; offsetZ <= diameter; offsetZ += 1) {
      for (let offsetY = 0; offsetY <= worldY + height; offsetY += 1) {
        const blockId = getRegionBlock(region, worldX + offsetX, worldY + offsetY, worldZ + offsetZ);
        if (blockId !== BLOCKS.AIR && !TREE_LEAF_BLOCKS.has(blockId)) {
          return false;
        }
      }
    }
  }

  const crownRadius = diameter * 4 + 8;
  for (let offsetX = -crownRadius; offsetX <= crownRadius; offsetX += 1) {
    for (let offsetZ = -crownRadius; offsetZ <= crownRadius; offsetZ += 1) {
      for (let offsetY = height - crownRadius; offsetY <= height + crownRadius; offsetY += 1) {
        const blockId = getRegionBlock(region, worldX + offsetX, worldY + offsetY, worldZ + offsetZ);
        if (blockId !== BLOCKS.AIR && !TREE_LEAF_BLOCKS.has(blockId)) {
          return false;
        }
      }
    }
  }

  const soil = getRegionBlock(region, worldX, worldY - 1, worldZ);
  return (soil === BLOCKS.GRASS || soil === BLOCKS.DIRT) && worldY < 128 - height - 1;
}

function addFirefly(region, baseX, baseY, baseZ, diameter, height, angle) {
  const source = translate(baseX, baseY + height, baseZ, diameter + 1, angle, 0.5);
  const normalizedAngle = ((angle % 1.0) + 1.0) % 1.0;

  if (normalizedAngle > 0.875 || normalizedAngle <= 0.125) {
    putBlockWithMetadata(region, source[0], source[1], source[2], EXTRA_BLOCKS.TORCH, 2, false);
  } else if (normalizedAngle <= 0.375) {
    putBlockWithMetadata(region, source[0], source[1], source[2], EXTRA_BLOCKS.TORCH, 3, false);
  } else if (normalizedAngle <= 0.625) {
    putBlockWithMetadata(region, source[0], source[1], source[2], EXTRA_BLOCKS.TORCH, 1, false);
  } else {
    putBlockWithMetadata(region, source[0], source[1], source[2], EXTRA_BLOCKS.TORCH, 4, false);
  }
}

export function generateHollowTree(region, random, worldX, worldY, worldZ) {
  const state = {
    region,
    random,
    x: worldX,
    y: worldY,
    z: worldZ,
    height: random.nextInt(64) + 32,
    diameter: random.nextInt(4) + 1,
    treeBlock: EXTRA_BLOCKS.OAK_LOG,
    leafBlock: EXTRA_BLOCKS.OAK_LEAVES,
  };

  if (!canGenerateHollowTree(region, worldX, worldY, worldZ, state.height, state.diameter)) {
    return false;
  }

  function makeSmallBranchFrom(worldStartX, worldStartY, worldStartZ, length, angle, tilt, leafy) {
    const destination = translate(worldStartX, worldStartY, worldStartZ, length, angle, tilt);
    drawBresenham(
      state.region,
      worldStartX,
      worldStartY,
      worldStartZ,
      destination[0],
      destination[1],
      destination[2],
      state.treeBlock,
      true,
    );

    if (leafy) {
      drawBlob(state.region, destination[0], destination[1], destination[2], state.random.nextInt(2) + 1, state.leafBlock, false);
    }
  }

  function makeSmallBranch(branchHeight, length, angle, tilt, leafy) {
    const source = translate(state.x, state.y + branchHeight, state.z, state.diameter, angle, 0.5);
    makeSmallBranchFrom(source[0], source[1], source[2], length, angle, tilt, leafy);
  }

  function makeMedBranchFrom(worldStartX, worldStartY, worldStartZ, length, angle, tilt, leafy) {
    const source = [worldStartX, worldStartY, worldStartZ];
    const destination = translate(source[0], source[1], source[2], length, angle, tilt);
    drawBresenham(
      state.region,
      source[0],
      source[1],
      source[2],
      destination[0],
      destination[1],
      destination[2],
      state.treeBlock,
      true,
    );

    if (leafy) {
      drawBlob(state.region, destination[0], destination[1], destination[2], 2, state.leafBlock, false);
    }

    const numShoots = state.random.nextInt(2) + 1;
    const angleIncrement = 0.8 / numShoots;
    for (let index = 0; index <= numShoots; index += 1) {
      const angleVariation = angleIncrement * index - 0.4;
      const outVariation = state.random.nextDouble() * 0.8 + 0.2;
      const tiltVariation = state.random.nextDouble() * 0.75 + 0.15;
      const branchSource = translate(source[0], source[1], source[2], length * outVariation, angle, tilt);
      makeSmallBranchFrom(
        branchSource[0],
        branchSource[1],
        branchSource[2],
        length * 0.4,
        angle + angleVariation,
        tilt * tiltVariation,
        leafy,
      );
    }
  }

  function makeMedBranch(branchHeight, length, angle, tilt, leafy) {
    const source = translate(state.x, state.y + branchHeight, state.z, state.diameter, angle, 0.5);
    makeMedBranchFrom(source[0], source[1], source[2], length, angle, tilt, leafy);
  }

  function makeLargeBranchFrom(worldStartX, worldStartY, worldStartZ, length, angle, tilt, leafy) {
    const source = [worldStartX, worldStartY, worldStartZ];
    const destination = translate(source[0], source[1], source[2], length, angle, tilt);
    drawBresenham(
      state.region,
      source[0],
      source[1],
      source[2],
      destination[0],
      destination[1],
      destination[2],
      state.treeBlock,
      true,
    );

    const reinforcements = state.random.nextInt(3);
    for (let index = 0; index <= reinforcements; index += 1) {
      const offsetX = (index & 2) === 0 ? 1 : 0;
      const offsetY = (index & 1) === 0 ? 1 : -1;
      const offsetZ = (index & 2) === 0 ? 0 : 1;
      drawBresenham(
        state.region,
        source[0] + offsetX,
        source[1] + offsetY,
        source[2] + offsetZ,
        destination[0],
        destination[1],
        destination[2],
        state.treeBlock,
        true,
      );
    }

    if (leafy) {
      drawBlob(state.region, destination[0], destination[1] + 1, destination[2], 3, state.leafBlock, false);
    }

    const medBranchBase = Math.max(1, Math.trunc(length / 6.0));
    const numMedBranches = state.random.nextInt(medBranchBase) + state.random.nextInt(2) + 1;
    for (let index = 0; index <= numMedBranches; index += 1) {
      const outVariation = state.random.nextDouble() * 0.3 + 0.3;
      const angleVariation = state.random.nextDouble() * 0.225 * ((index & 1) === 0 ? 1.0 : -1.0);
      const branchSource = translate(source[0], source[1], source[2], length * outVariation, angle, tilt);
      makeMedBranchFrom(branchSource[0], branchSource[1], branchSource[2], length * 0.6, angle + angleVariation, tilt, leafy);
    }

    const numSmallBranches = state.random.nextInt(2) + 1;
    for (let index = 0; index <= numSmallBranches; index += 1) {
      const outVariation = state.random.nextDouble() * 0.25 + 0.25;
      const angleVariation = state.random.nextDouble() * 0.25 * ((index & 1) === 0 ? 1.0 : -1.0);
      const branchSource = translate(source[0], source[1], source[2], length * outVariation, angle, tilt);
      makeSmallBranchFrom(
        branchSource[0],
        branchSource[1],
        branchSource[2],
        Math.max(length * 0.3, 2.0),
        angle + angleVariation,
        tilt,
        leafy,
      );
    }
  }

  function makeLargeBranch(branchHeight, length, angle, tilt, leafy) {
    const source = translate(state.x, state.y + branchHeight, state.z, state.diameter, angle, 0.5);
    makeLargeBranchFrom(source[0], source[1], source[2], length, angle, tilt, leafy);
  }

  function makeRoot(branchHeight, length, angle, tilt) {
    const source = translate(state.x, state.y + branchHeight, state.z, state.diameter, angle, 0.5);
    const destination = translate(source[0], source[1], source[2], length, angle, tilt);
    drawBresenham(state.region, source[0], source[1], source[2], destination[0], destination[1], destination[2], state.treeBlock, true);
    drawBresenham(state.region, source[0], source[1] - 1, source[2], destination[0], destination[1] - 1, destination[2], state.treeBlock, true);
  }

  function buildBranchRing(branchHeight, heightVariation, length, _lengthVariation, tilt, _tiltVariation, minBranches, maxBranches, size, leafy) {
    const branchCount = state.random.nextInt(Math.max(1, maxBranches - minBranches)) + minBranches;
    const branchRotation = 1.0 / branchCount;
    const branchOffset = state.random.nextDouble();

    for (let index = 0; index <= branchCount; index += 1) {
      const variedHeight = heightVariation > 0
        ? branchHeight - heightVariation + state.random.nextInt(2 * heightVariation)
        : branchHeight;
      const angle = index * branchRotation + branchOffset;

      if (size === 2) {
        makeLargeBranch(variedHeight, length, angle, tilt, leafy);
      } else if (size === 1) {
        makeMedBranch(variedHeight, length, angle, tilt, leafy);
      } else if (size === 3) {
        makeRoot(variedHeight, length, angle, tilt);
      } else {
        makeSmallBranch(variedHeight, length, angle, tilt, leafy);
      }
    }
  }

  function buildFullCrown() {
    const crownRadius = state.diameter * 4 + 4;
    const branchVariation = state.diameter + 2;
    buildBranchRing(state.height - crownRadius, 0, crownRadius, 0, 0.35, 0.0, branchVariation, branchVariation + 2, 2, true);
    buildBranchRing(state.height - Math.trunc(crownRadius / 2), 0, crownRadius, 0, 0.28, 0.0, branchVariation, branchVariation + 2, 1, true);
    buildBranchRing(state.height, 0, crownRadius, 0, 0.15, 0.0, 2, 4, 2, true);
    buildBranchRing(state.height, 0, Math.trunc(crownRadius / 2), 0, 0.05, 0.0, branchVariation, branchVariation + 2, 1, true);
  }

  function buildTrunk() {
    const hollow = Math.trunc(state.diameter / 2);

    for (let offsetX = -state.diameter; offsetX <= state.diameter; offsetX += 1) {
      for (let offsetZ = -state.diameter; offsetZ <= state.diameter; offsetZ += 1) {
        const distance = Math.trunc(Math.max(Math.abs(offsetX), Math.abs(offsetZ)) + Math.min(Math.abs(offsetX), Math.abs(offsetZ)) * 0.5);

        for (let offsetY = 0; offsetY <= state.height; offsetY += 1) {
          if (distance <= state.diameter && distance > hollow) {
            putBlock(state.region, state.x + offsetX, state.y + offsetY, state.z + offsetZ, state.treeBlock, true);
          }
          if (distance === hollow && offsetX === hollow) {
            putBlockWithMetadata(state.region, state.x + offsetX, state.y + offsetY, state.z + offsetZ, EXTRA_BLOCKS.LADDER, 4, true);
          }
        }
      }
    }

    for (let offsetX = -state.diameter; offsetX <= state.diameter; offsetX += 1) {
      for (let offsetZ = -state.diameter; offsetZ <= state.diameter; offsetZ += 1) {
        const distance = Math.trunc(Math.max(Math.abs(offsetX), Math.abs(offsetZ)) + Math.min(Math.abs(offsetX), Math.abs(offsetZ)) * 0.5);
        if (distance > state.diameter || distance <= hollow) {
          continue;
        }
        for (let offsetY = -4; offsetY < 0; offsetY += 1) {
          putBlock(state.region, state.x + offsetX, state.y + offsetY, state.z + offsetZ, state.treeBlock, false);
        }
      }
    }
  }

  buildTrunk();
  buildFullCrown();

  const numBranches = state.random.nextInt(3) + 3;
  for (let index = 0; index <= numBranches; index += 1) {
    const branchHeight = Math.trunc(state.height * state.random.nextDouble() * 0.9) + Math.trunc(state.height / 10);
    makeSmallBranch(branchHeight, 4.0, state.random.nextDouble(), 0.35, true);
  }

  buildBranchRing(3, 2, 6, 0, 0.75, 0.0, 3, 5, 3, false);

  const numFireflies = state.random.nextInt(3) + 3;
  for (let index = 0; index <= numFireflies; index += 1) {
    const fireflyHeight = Math.trunc(state.height * state.random.nextDouble() * 0.9) + Math.trunc(state.height / 10);
    addFirefly(state.region, state.x, state.y, state.z, state.diameter, fireflyHeight, state.random.nextDouble());
  }

  return true;
}

export function createHollowTreeSession(region, random, chunkX, chunkZ) {
  return {
    region,
    random,
    chunkX,
    chunkZ,
    complete: false,
  };
}

export function advanceHollowTreeSession(session) {
  if (session.complete) {
    return false;
  }

  if (session.random.nextInt(4) === 0) {
    const worldX = session.chunkX * 16 + session.random.nextInt(16) + 8;
    const worldZ = session.chunkZ * 16 + session.random.nextInt(16) + 8;
    let worldY = 127;
    while (worldY > 0 && getRegionBlock(session.region, worldX, worldY, worldZ) === BLOCKS.AIR) {
      worldY -= 1;
    }
    generateHollowTree(session.region, session.random, worldX, worldY + 1, worldZ);
  }

  session.complete = true;
  return true;
}

export function applyTwilightHollowTree(region, random, chunkX, chunkZ) {
  const session = createHollowTreeSession(region, random, chunkX, chunkZ);
  while (advanceHollowTreeSession(session)) {
    // Preserve the same single-event ordering for synchronous callers.
  }
}

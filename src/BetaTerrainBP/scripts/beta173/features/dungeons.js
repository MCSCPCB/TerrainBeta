import { BLOCKS } from "../biome/index.js";
import { EXTRA_BLOCKS } from "../world/blocks.js";
import {
  getRegionBlock,
  isSolid,
  setRegionBlock,
} from "../population/shared.js";

const DUNGEON_ROOM_HEIGHT = 3;
const DUNGEON_CHEST_SIZE = 27;

function consumeDungeonLootPick(random) {
  switch (random.nextInt(11)) {
    case 0:
    case 2:
    case 6:
    case 10:
      return true;

    case 1:
    case 3:
    case 4:
    case 5:
      random.nextInt(4);
      return true;

    case 7:
      return random.nextInt(100) === 0;

    case 8:
      if (random.nextInt(2) !== 0) {
        return false;
      }
      random.nextInt(4);
      return true;

    case 9:
      if (random.nextInt(10) !== 0) {
        return false;
      }
      random.nextInt(2);
      return true;

    default:
      return false;
  }
}

function consumeDungeonChestLoot(random) {
  for (let slotAttempt = 0; slotAttempt < 8; slotAttempt += 1) {
    if (consumeDungeonLootPick(random)) {
      random.nextInt(DUNGEON_CHEST_SIZE);
    }
  }
}

function countOpenDungeonSides(region, worldX, worldY, worldZ, radiusX, radiusZ) {
  let openings = 0;

  for (let x = worldX - radiusX - 1; x <= worldX + radiusX + 1; x += 1) {
    for (let z = worldZ - radiusZ - 1; z <= worldZ + radiusZ + 1; z += 1) {
      if (
        (x !== worldX - radiusX - 1 && x !== worldX + radiusX + 1)
        && (z !== worldZ - radiusZ - 1 && z !== worldZ + radiusZ + 1)
      ) {
        continue;
      }

      if (
        getRegionBlock(region, x, worldY, z) === BLOCKS.AIR
        && getRegionBlock(region, x, worldY + 1, z) === BLOCKS.AIR
      ) {
        openings += 1;
      }
    }
  }

  return openings;
}

function generateDungeon(region, random, worldX, worldY, worldZ) {
  const radiusX = random.nextInt(2) + 2;
  const radiusZ = random.nextInt(2) + 2;

  for (let x = worldX - radiusX - 1; x <= worldX + radiusX + 1; x += 1) {
    for (let y = worldY - 1; y <= worldY + DUNGEON_ROOM_HEIGHT + 1; y += 1) {
      for (let z = worldZ - radiusZ - 1; z <= worldZ + radiusZ + 1; z += 1) {
        const block = getRegionBlock(region, x, y, z);

        if ((y === worldY - 1 || y === worldY + DUNGEON_ROOM_HEIGHT + 1) && !isSolid(block)) {
          return false;
        }
      }
    }
  }

  const openings = countOpenDungeonSides(region, worldX, worldY, worldZ, radiusX, radiusZ);
  if (openings < 1 || openings > 5) {
    return false;
  }

  for (let x = worldX - radiusX - 1; x <= worldX + radiusX + 1; x += 1) {
    for (let y = worldY + DUNGEON_ROOM_HEIGHT + 1; y >= worldY - 1; y -= 1) {
      for (let z = worldZ - radiusZ - 1; z <= worldZ + radiusZ + 1; z += 1) {
        const isBoundary = (
          x === worldX - radiusX - 1
          || x === worldX + radiusX + 1
          || z === worldZ - radiusZ - 1
          || z === worldZ + radiusZ + 1
          || y === worldY - 1
          || y === worldY + DUNGEON_ROOM_HEIGHT + 1
        );

        if (!isBoundary) {
          setRegionBlock(region, x, y, z, BLOCKS.AIR);
          continue;
        }

        if (y >= 0 && !isSolid(getRegionBlock(region, x, y - 1, z))) {
          setRegionBlock(region, x, y, z, BLOCKS.AIR);
          continue;
        }

        const current = getRegionBlock(region, x, y, z);
        if (!isSolid(current)) {
          continue;
        }

        if (y === worldY - 1) {
          setRegionBlock(
            region,
            x,
            y,
            z,
            random.nextInt(4) === 0 ? EXTRA_BLOCKS.COBBLESTONE : EXTRA_BLOCKS.MOSSY_COBBLESTONE,
          );
        } else {
          setRegionBlock(region, x, y, z, EXTRA_BLOCKS.COBBLESTONE);
        }
      }
    }
  }

  for (let chestAttempt = 0; chestAttempt < 2; chestAttempt += 1) {
    for (let tryIndex = 0; tryIndex < 3; tryIndex += 1) {
      const chestX = worldX + random.nextInt(radiusX * 2 + 1) - radiusX;
      const chestZ = worldZ + random.nextInt(radiusZ * 2 + 1) - radiusZ;

      if (getRegionBlock(region, chestX, worldY, chestZ) !== BLOCKS.AIR) {
        continue;
      }

      let solidNeighborCount = 0;
      if (isSolid(getRegionBlock(region, chestX - 1, worldY, chestZ))) {
        solidNeighborCount += 1;
      }
      if (isSolid(getRegionBlock(region, chestX + 1, worldY, chestZ))) {
        solidNeighborCount += 1;
      }
      if (isSolid(getRegionBlock(region, chestX, worldY, chestZ - 1))) {
        solidNeighborCount += 1;
      }
      if (isSolid(getRegionBlock(region, chestX, worldY, chestZ + 1))) {
        solidNeighborCount += 1;
      }

      if (solidNeighborCount === 1) {
        setRegionBlock(region, chestX, worldY, chestZ, EXTRA_BLOCKS.CHEST);
        consumeDungeonChestLoot(random);
        break;
      }
    }
  }

  setRegionBlock(region, worldX, worldY, worldZ, EXTRA_BLOCKS.MOB_SPAWNER);
  random.nextInt(4);
  return true;
}

export function applyDungeons(region, random, chunkX, chunkZ) {
  const session = createDungeonSession(region, random, chunkX, chunkZ);
  while (advanceDungeonSession(session)) {
    // Run the exact same deterministic state machine to completion for synchronous callers.
  }
}

export function createDungeonSession(region, random, chunkX, chunkZ) {
  return {
    region,
    random,
    chunkX,
    chunkZ,
    attempt: 0,
    complete: false,
  };
}

export function advanceDungeonSession(session, maxAttempts = 1) {
  if (session.complete) {
    return false;
  }

  let processed = 0;
  while (processed < maxAttempts && session.attempt < 8) {
    const x = session.chunkX * 16 + session.random.nextInt(16) + 8;
    const y = session.random.nextInt(128);
    const z = session.chunkZ * 16 + session.random.nextInt(16) + 8;
    generateDungeon(session.region, session.random, x, y, z);
    session.attempt += 1;
    processed += 1;
  }

  session.complete = session.attempt >= 8;
  return processed > 0;
}

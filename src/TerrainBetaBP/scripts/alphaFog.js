import { system, world } from "@minecraft/server";

const ANCHOR_TYPE_ID = "terrainbeta:alpha_fog_anchor";
const DIMENSION_IDS = ["overworld", "nether", "the_end"];
const CHECK_INTERVAL = 20;
const REPOSITION_DISTANCE = 8;
const REPOSITION_DISTANCE_SQUARED = REPOSITION_DISTANCE * REPOSITION_DISTANCE;

function getRenderId(playerId) {
  let hash = 0;

  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) % 10000000;
  }

  return hash || 1;
}

function getAnchorTargetLocation(player) {
  return player.getHeadLocation();
}

function getDistanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;

  return dx * dx + dy * dy + dz * dz;
}

function updateProperty(entity, propertyId, value) {
  try {
    if (entity.getProperty(propertyId) !== value) {
      entity.setProperty(propertyId, value);
    }
  } catch {
    // Ignore missing/locked properties so the sweep stays cheap and resilient.
  }
}

function syncAnchorProperties(anchor, renderId) {
  updateProperty(anchor, "p:render_id", renderId);
}

function spawnAnchor(player, renderId, targetLocation) {
  const anchor = player.dimension.spawnEntity(ANCHOR_TYPE_ID, targetLocation);
  syncAnchorProperties(anchor, renderId);
  return anchor;
}

function ensureAnchorForPlayer(player, anchorsByRenderId) {
  if (!player.isValid()) {
    return undefined;
  }

  const renderId = getRenderId(player.id);
  const targetLocation = getAnchorTargetLocation(player);

  let anchor = anchorsByRenderId.get(renderId);

  if (!anchor?.isValid()) {
    try {
      anchor = spawnAnchor(player, renderId, targetLocation);
      anchorsByRenderId.set(renderId, anchor);
    } catch (error) {
      console.warn(`Failed to spawn alpha fog anchor for ${player.name}: ${error}`);
      return undefined;
    }
  } else if (getDistanceSquared(anchor.location, targetLocation) > REPOSITION_DISTANCE_SQUARED) {
    const moved = anchor.tryTeleport(targetLocation);

    if (!moved) {
      try {
        anchor = spawnAnchor(player, renderId, targetLocation);
        anchorsByRenderId.set(renderId, anchor);
      } catch (error) {
        console.warn(`Failed to move alpha fog anchor for ${player.name}: ${error}`);
        return undefined;
      }
    }
  }

  syncAnchorProperties(anchor, renderId);
  return anchor;
}

function despawnAnchor(anchor) {
  try {
    anchor.triggerEvent("e:instant_despawn");
  } catch (error) {
    console.warn(`Failed to despawn stale alpha fog anchor ${anchor.id}: ${error}`);
  }
}

function sweepDimension(dimensionId) {
  let dimension;

  try {
    dimension = world.getDimension(dimensionId);
  } catch (error) {
    console.warn(`Failed to access dimension ${dimensionId} for alpha fog: ${error}`);
    return;
  }

  const anchorsByRenderId = new Map();
  const assignedAnchorIds = new Set();
  const duplicateAnchors = [];
  const anchors = dimension.getEntities({ type: ANCHOR_TYPE_ID });

  for (const anchor of anchors) {
    const renderId = Number(anchor.getProperty("p:render_id"));
    if (renderId && !anchorsByRenderId.has(renderId)) {
      anchorsByRenderId.set(renderId, anchor);
    } else {
      duplicateAnchors.push(anchor);
    }
  }

  for (const player of dimension.getPlayers()) {
    const anchor = ensureAnchorForPlayer(player, anchorsByRenderId);
    if (anchor?.isValid()) {
      assignedAnchorIds.add(anchor.id);
    }
  }

  for (const anchor of duplicateAnchors) {
    despawnAnchor(anchor);
  }

  for (const anchor of anchorsByRenderId.values()) {
    if (!assignedAnchorIds.has(anchor.id)) {
      despawnAnchor(anchor);
    }
  }
}

function sweepAllDimensions() {
  for (const dimensionId of DIMENSION_IDS) {
    sweepDimension(dimensionId);
  }
}

function ensurePlayerAnchorSoon(player) {
  system.run(() => {
    if (!player?.isValid()) {
      return;
    }

    sweepAllDimensions();
  });
}

world.afterEvents.playerSpawn.subscribe((event) => {
  ensurePlayerAnchorSoon(event.player);
});

world.afterEvents.playerDimensionChange.subscribe((event) => {
  ensurePlayerAnchorSoon(event.player);
});

system.run(sweepAllDimensions);
system.runInterval(sweepAllDimensions, CHECK_INTERVAL);

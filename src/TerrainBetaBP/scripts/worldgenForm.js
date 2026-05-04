import * as minecraftServer from "@minecraft/server";
import { ActionFormData, ModalFormData, uiManager } from "@minecraft/server-ui";

import { GENERATOR_CONFIGS } from "./worldgen/config/generators.js";
import {
  MAX_WORLD_VERTICAL_OFFSET,
  MIN_WORLD_VERTICAL_OFFSET,
  PLAYER_VISIBLE_OPTION_KEYS_BY_GENERATOR,
  WORLDGEN_INITIALIZATION_RETURN_PROPERTY,
  WORLDGEN_PRE_ACTIVATION_HOLD_PROPERTY,
  isWorldGenerationActivated,
  loadStoredWorldgenConfigSubmission,
  saveStoredWorldgenConfigSubmission,
} from "./worldgen/config/playerConfig.js";
import {
  initializeConfiguredWorldGenerationRuntime,
  startConfiguredWorldGeneration,
} from "./chunkGenerator.js";

const { HudVisibility, system, world } = minecraftServer;
const FORM_TITLE_KEYS = {
  config: "terrainbeta.title.config",
  loading: "terrainbeta.title.loading",
  twilightLoading: "terrainbeta.title.loading.twilight",
};
const ACTIVE_PLAYERS = new Set();
let configurationPromptPlayerId = "";
const FORM_FADE_INTERVAL_TICKS = 20;
const LOADING_FORM_TOTAL_DURATION_MS = 64_000;
const PRE_ACTIVATION_PLAYER_HOLD_HEIGHT = 105508;
const PRE_ACTIVATION_SAFETY_INTERVAL_TICKS = 200;
const HOLD_CHUNK_SIZE = 16;
const MIN_FARLANDS_COORDINATE = 1;
const MAX_FARLANDS_COORDINATE = 12550821;
const DEFAULT_GENERATOR_KEY = "beta173";
const tr = (translate) => ({ translate });
const GENERATOR_KEYS = [
  "alpha1016",
  "beta173",
  "beta173sky",
  "beta173twilightforest",
];
const GENERATOR_LABELS = [
  tr("terrainbeta.generator.alpha1016"),
  tr("terrainbeta.generator.beta173"),
  tr("terrainbeta.generator.beta173sky"),
  tr("terrainbeta.generator.beta173twilightforest"),
];
const DEFAULT_GENERATOR_INDEX = GENERATOR_KEYS.indexOf(DEFAULT_GENERATOR_KEY);
const CONFIG_FIELD_INDEX = {
  seed: 0,
  generator: 1,
  worldVerticalOffset: 2,
  farlandsCoordinate: 3,
  ores: 4,
  trees: 5,
  flora: 6,
  springs: 7,
  snow: 8,
  caves: 9,
  lakes: 10,
  snowCovered: 11,
  randomFeatures: 12,
};
const OPTION_FIELD_KEYS = [
  "ores",
  "trees",
  "flora",
  "springs",
  "snow",
  "caves",
  "lakes",
  "snowCovered",
  "randomFeatures",
];
const GENERATOR_VISIBLE_OPTIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(PLAYER_VISIBLE_OPTION_KEYS_BY_GENERATOR).map(
      ([generatorKey, optionKeys]) => [generatorKey, new Set(optionKeys)],
    ),
  ),
);
const FORM_FADE_OPTIONS = {
  fadeColor: { red: 0, green: 0, blue: 0 },
  fadeTime: {
    fadeInTime: 0,
    holdTime: 1,
    fadeOutTime: 0,
  },
};

const waitTicks = (ticks) =>
  new Promise((resolve) => system.runTimeout(resolve, ticks));
const waitMilliseconds = (durationMs) =>
  new Promise((resolve) => {
    const deadline = Date.now() + Math.max(0, durationMs);

    const poll = () => {
      if (Date.now() >= deadline) {
        resolve();
        return;
      }

      system.runTimeout(poll, 1);
    };

    system.runTimeout(poll, 1);
  });
const tryOrDefault = (callback, fallback) => {
  try {
    return callback();
  } catch {
    return fallback;
  }
};
const warnOnError = (message, callback) => {
  try {
    return callback();
  } catch (error) {
    console.warn(`${message}: ${error}`);
    return undefined;
  }
};
const isPlayerValid = (player) =>
  tryOrDefault(() => player?.typeId === "minecraft:player", false);
const getPlayerKey = (player) => tryOrDefault(() => player?.id ?? player?.name);
const getPlayerId = (player) => tryOrDefault(() => player?.id ?? "", "");

function getOnlinePlayerById(playerId) {
  if (!playerId) {
    return null;
  }

  return world.getAllPlayers().find((player) => player.id === playerId) ?? null;
}

function tryClearMissingConfigurationPromptPlayer() {
  if (!configurationPromptPlayerId) {
    return;
  }

  if (!getOnlinePlayerById(configurationPromptPlayerId)) {
    configurationPromptPlayerId = "";
  }
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function generateRandomSeed() {
  return (Math.floor(Math.random() * 0x100000000) - 0x80000000) | 0;
}

function normalizeSeed(rawValue) {
  const trimmed = `${rawValue ?? ""}`.trim();
  if (trimmed.length === 0) {
    return `${generateRandomSeed()}`;
  }

  if (/^[+-]?\d+$/.test(trimmed)) {
    return trimmed;
  }

  return `${getJavaStringHash(trimmed)}`;
}

function getJavaStringHash(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (Math.imul(31, hash) + text.charCodeAt(index)) | 0;
  }

  return hash;
}

function normalizeFarlandsCoordinate(rawValue, fallbackValue) {
  const trimmed = `${rawValue ?? ""}`.trim();
  if (trimmed.length === 0) {
    return clampInteger(
      fallbackValue,
      MIN_FARLANDS_COORDINATE,
      MAX_FARLANDS_COORDINATE,
    );
  }

  if (/^[+-]?\d+$/.test(trimmed)) {
    const isNegative = trimmed.startsWith("-");
    if (isNegative) {
      return MIN_FARLANDS_COORDINATE;
    }

    const numericText = trimmed.replace(/^[+]/, "").replace(/^0+/, "") || "0";
    const maxText = `${MAX_FARLANDS_COORDINATE}`;
    if (numericText.length > maxText.length) {
      return MAX_FARLANDS_COORDINATE;
    }

    if (numericText.length === maxText.length && numericText > maxText) {
      return MAX_FARLANDS_COORDINATE;
    }

    return clampInteger(
      Number(numericText),
      MIN_FARLANDS_COORDINATE,
      MAX_FARLANDS_COORDINATE,
    );
  }

  return clampInteger(
    getJavaStringHash(trimmed),
    MIN_FARLANDS_COORDINATE,
    MAX_FARLANDS_COORDINATE,
  );
}

function normalizeWorldVerticalOffset(rawValue, fallbackValue) {
  const trimmed = `${rawValue ?? ""}`.trim();
  if (trimmed.length === 0) {
    return clampInteger(
      fallbackValue,
      MIN_WORLD_VERTICAL_OFFSET,
      MAX_WORLD_VERTICAL_OFFSET,
    );
  }

  if (/^[+-]?\d+$/.test(trimmed)) {
    return clampInteger(
      Number(trimmed),
      MIN_WORLD_VERTICAL_OFFSET,
      MAX_WORLD_VERTICAL_OFFSET,
    );
  }

  return clampInteger(
    fallbackValue,
    MIN_WORLD_VERTICAL_OFFSET,
    MAX_WORLD_VERTICAL_OFFSET,
  );
}

function getGeneratorKeyFromIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < GENERATOR_KEYS.length
    ? GENERATOR_KEYS[index]
    : DEFAULT_GENERATOR_KEY;
}

function buildSubmittedGeneratorConfig(formValues) {
  const generatorIndex = Number(formValues?.[CONFIG_FIELD_INDEX.generator]);
  const generatorKey = getGeneratorKeyFromIndex(generatorIndex);
  const config = cloneConfig(GENERATOR_CONFIGS[generatorKey]);
  const visibleOptions = GENERATOR_VISIBLE_OPTIONS[generatorKey] ?? new Set();

  config.seed = normalizeSeed(formValues?.[CONFIG_FIELD_INDEX.seed]);
  config.worldVerticalOffset = normalizeWorldVerticalOffset(
    formValues?.[CONFIG_FIELD_INDEX.worldVerticalOffset],
    config.worldVerticalOffset,
  );
  config.farlandsCoordinate = normalizeFarlandsCoordinate(
    formValues?.[CONFIG_FIELD_INDEX.farlandsCoordinate],
    config.farlandsCoordinate,
  );

  for (const optionKey of OPTION_FIELD_KEYS) {
    if (
      !visibleOptions.has(optionKey)
      || !Object.prototype.hasOwnProperty.call(config.options, optionKey)
    ) {
      continue;
    }

    config.options[optionKey] = Boolean(
      formValues?.[CONFIG_FIELD_INDEX[optionKey]],
    );
  }

  return {
    generatorKey,
    config,
  };
}

function hideHudElements(player) {
  warnOnError("Failed to hide HUD elements", () =>
    player?.onScreenDisplay?.setHudVisibility(HudVisibility.Hide),
  );
}

function restoreHudElements(player) {
  warnOnError("Failed to restore HUD elements", () =>
    player?.onScreenDisplay?.setHudVisibility(HudVisibility.Reset),
  );
}

function applyFormFade(player) {
  warnOnError("Failed to apply camera fade", () =>
    player.camera.fade(FORM_FADE_OPTIONS),
  );
}

function startLoopingFormFade(player) {
  let stopped = false;
  applyFormFade(player);

  const runId = system.runInterval(() => {
    if (!isPlayerValid(player)) {
      system.clearRun(runId);
      stopped = true;
      return;
    }

    applyFormFade(player);
  }, FORM_FADE_INTERVAL_TICKS);

  return () => {
    if (stopped) {
      return;
    }

    stopped = true;
    system.clearRun(runId);
  };
}

function createConfigForm() {
  return new ModalFormData()
    .title(tr(FORM_TITLE_KEYS.config))
    .textField(
      tr("terrainbeta.form.seed.label"),
      tr("terrainbeta.form.seed.placeholder"),
      "",
    )
    .dropdown(
      tr("terrainbeta.form.generator.label"),
      GENERATOR_LABELS,
      DEFAULT_GENERATOR_INDEX,
    )
    .textField(
      tr("terrainbeta.form.base_height.label"),
      tr("terrainbeta.form.base_height.placeholder"),
      `${GENERATOR_CONFIGS[DEFAULT_GENERATOR_KEY].worldVerticalOffset ?? 0}`,
    )
    .textField(
      tr("terrainbeta.form.farlands.label"),
      tr("terrainbeta.form.farlands.placeholder"),
      `${GENERATOR_CONFIGS[DEFAULT_GENERATOR_KEY].farlandsCoordinate}`,
    )
    .toggle(tr("terrainbeta.form.option.ores"), true)
    .toggle(tr("terrainbeta.form.option.trees"), true)
    .toggle(tr("terrainbeta.form.option.flora"), true)
    .toggle(tr("terrainbeta.form.option.springs"), true)
    .toggle(tr("terrainbeta.form.option.snow"), true)
    .toggle(tr("terrainbeta.form.option.caves"), true)
    .toggle(tr("terrainbeta.form.option.lakes"), true)
    .toggle(tr("terrainbeta.form.option.snow_covered"), false)
    .toggle(tr("terrainbeta.form.option.random_features"), true)
    .submitButton(tr("terrainbeta.form.submit"));
}

function createLoadingTriggerForm(generatorKey = "") {
  const loadingTitleKey =
    generatorKey === "beta173twilightforest"
      ? FORM_TITLE_KEYS.twilightLoading
      : FORM_TITLE_KEYS.loading;
  return new ActionFormData()
    .title(tr(loadingTitleKey))
    .body(generatorKey)
    .button(tr("terrainbeta.loading.button"));
}

function closePlayerForms(player) {
  warnOnError("Failed to close forms", () => uiManager.closeAllForms(player));
}

async function showTimedLoadingForm(
  player,
  generatorKey = "",
  beforeDelayCallback = null,
) {
  const loadingFormPromise =
    warnOnError("Failed to open loading form", () =>
      createLoadingTriggerForm(generatorKey).show(player),
    ) ?? Promise.resolve(undefined);
  const loadingFormOpenedAtMs = Date.now();
  let keepLoadingFormOpen = true;

  try {
    // Yield one tick so the loading form can render before synchronous setup work runs.
    await waitTicks(1);

    if (typeof beforeDelayCallback === "function") {
      keepLoadingFormOpen = (await beforeDelayCallback()) !== false;
    }

    if (keepLoadingFormOpen) {
      const elapsedMs = Math.max(0, Date.now() - loadingFormOpenedAtMs);
      await waitMilliseconds(
        Math.max(0, LOADING_FORM_TOTAL_DURATION_MS - elapsedMs),
      );
    }
  } finally {
    if (isPlayerValid(player)) {
      closePlayerForms(player);
    }

    await loadingFormPromise.catch((error) => {
      console.warn(`Loading form closed with error: ${error}`);
    });
    await waitTicks(1);
  }

  return keepLoadingFormOpen;
}

function getChunkForLocation(location) {
  return {
    x: Math.floor(location.x / HOLD_CHUNK_SIZE),
    z: Math.floor(location.z / HOLD_CHUNK_SIZE),
  };
}

function getChunkCenterBlockX(chunkX) {
  return (chunkX * HOLD_CHUNK_SIZE) + Math.floor(HOLD_CHUNK_SIZE / 2);
}

function getChunkCenterBlockZ(chunkZ) {
  return (chunkZ * HOLD_CHUNK_SIZE) + Math.floor(HOLD_CHUNK_SIZE / 2);
}

function getInitializationLoadingLocation(chunkX, chunkZ) {
  return {
    x: getChunkCenterBlockX(chunkX) + 0.5,
    y: PRE_ACTIVATION_PLAYER_HOLD_HEIGHT,
    z: getChunkCenterBlockZ(chunkZ) + 0.5,
  };
}

function isPlayerAtInitializationLoadingHeight(player) {
  return Math.abs(player.location.y - PRE_ACTIVATION_PLAYER_HOLD_HEIGHT) <= 1;
}

function getInitializationReturnState(player) {
  const raw = player.getDynamicProperty(WORLDGEN_INITIALIZATION_RETURN_PROPERTY);
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }

  return JSON.parse(raw);
}

function setInitializationReturnState(player, state) {
  player.setDynamicProperty(
    WORLDGEN_INITIALIZATION_RETURN_PROPERTY,
    JSON.stringify(state),
  );
}

function getPreActivationHoldState(player) {
  const raw = player.getDynamicProperty(WORLDGEN_PRE_ACTIVATION_HOLD_PROPERTY);
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }

  return JSON.parse(raw);
}

function setPreActivationHoldState(player, state) {
  player.setDynamicProperty(
    WORLDGEN_PRE_ACTIVATION_HOLD_PROPERTY,
    JSON.stringify(state),
  );
}

function clearPreActivationHoldState(player) {
  player.setDynamicProperty(WORLDGEN_PRE_ACTIVATION_HOLD_PROPERTY, undefined);
}

function savePreActivationHoldState(player) {
  if (getPreActivationHoldState(player)) {
    return;
  }

  setPreActivationHoldState(
    player,
    {
      x: player.location.x,
      z: player.location.z,
      dimensionId: player.dimension.id,
    },
  );
}

function ensurePreActivationPlayerSafety(player) {
  if (isWorldGenerationActivated()) {
    return true;
  }

  savePreActivationHoldState(player);
  const holdState = getPreActivationHoldState(player);
  if (!holdState) {
    return false;
  }

  const dimension = world.getDimension(holdState.dimensionId);
  const targetChunk = getChunkForLocation(holdState);
  const loadingLocation = getInitializationLoadingLocation(
    targetChunk.x,
    targetChunk.z,
  );
  const playerIsInTargetDimension = player.dimension.id === dimension.id;
  const playerChunk = playerIsInTargetDimension ? getChunkForLocation(player.location) : null;
  if (
    !playerIsInTargetDimension
    || !playerChunk
    || playerChunk.x !== targetChunk.x
    || playerChunk.z !== targetChunk.z
    || !isPlayerAtInitializationLoadingHeight(player)
  ) {
    player.teleport(
      loadingLocation,
      {
        dimension,
        checkForBlocks: false,
      },
    );
    return false;
  }

  return true;
}

function promotePreActivationHoldStateToInitializationReturnState(player) {
  if (!player || getInitializationReturnState(player)) {
    return;
  }

  const holdState = getPreActivationHoldState(player);
  if (!holdState) {
    return;
  }

  setInitializationReturnState(player, holdState);
  clearPreActivationHoldState(player);
}

function clearPreActivationHoldStates(players = world.getAllPlayers()) {
  for (const player of players) {
    clearPreActivationHoldState(player);
  }
}

async function openPersistentForm(player) {
  const playerKey = getPlayerKey(player);
  const playerId = getPlayerId(player);
  if (
    !playerKey
    || !playerId
    || ACTIVE_PLAYERS.has(playerKey)
    || (
      configurationPromptPlayerId.length > 0
      && configurationPromptPlayerId !== playerId
    )
    || isWorldGenerationActivated()
  ) {
    return;
  }

  configurationPromptPlayerId = playerId;
  ACTIVE_PLAYERS.add(playerKey);
  hideHudElements(player);
  const stopLoopingFormFade = startLoopingFormFade(player);

  try {
    while (isPlayerValid(player) && !isWorldGenerationActivated()) {
      const response = await createConfigForm().show(player);
      if (response.canceled) {
        continue;
      }

      const submittedGeneratorConfig = buildSubmittedGeneratorConfig(
        response.formValues ?? [],
      );

      if (!isPlayerValid(player)) {
        return;
      }

      await showTimedLoadingForm(
        player,
        submittedGeneratorConfig.generatorKey,
        () => {
          stopLoopingFormFade();

          if (!isPlayerValid(player)) {
            return false;
          }

          saveStoredWorldgenConfigSubmission(submittedGeneratorConfig);
          promotePreActivationHoldStateToInitializationReturnState(player);
          clearPreActivationHoldStates();
          const runtimeReady = initializeConfiguredWorldGenerationRuntime();
          const generationStarted = startConfiguredWorldGeneration(player);

          return runtimeReady && generationStarted && isPlayerValid(player);
        },
      );
      return;
    }
  } catch (error) {
    console.warn(`Failed to handle form flow: ${error}`);
  } finally {
    stopLoopingFormFade();
    restoreHudElements(player);
    ACTIVE_PLAYERS.delete(playerKey);
    if (configurationPromptPlayerId === playerId) {
      configurationPromptPlayerId = "";
    }
  }
}

function queueConfigurationForm(player) {
  if (!isPlayerValid(player) || isWorldGenerationActivated()) {
    return;
  }

  const playerId = getPlayerId(player);
  if (
    !playerId
    || (
      configurationPromptPlayerId.length > 0
      && configurationPromptPlayerId !== playerId
    )
  ) {
    return;
  }

  void openPersistentForm(player);
}

system.run(() => {
  if (loadStoredWorldgenConfigSubmission()) {
    initializeConfiguredWorldGenerationRuntime();
  }
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (isWorldGenerationActivated()) {
    return;
  }

  queueConfigurationForm(event.player);
  if (configurationPromptPlayerId === getPlayerId(event.player)) {
    ensurePreActivationPlayerSafety(event.player);
  }
});

system.runInterval(() => {
  if (isWorldGenerationActivated()) {
    return;
  }

  tryClearMissingConfigurationPromptPlayer();
  if (!configurationPromptPlayerId) {
    const [nextPlayer] = world.getAllPlayers();
    if (nextPlayer) {
      queueConfigurationForm(nextPlayer);
    }
  }

  const selectedPlayer = getOnlinePlayerById(configurationPromptPlayerId);
  if (selectedPlayer) {
    ensurePreActivationPlayerSafety(selectedPlayer);
  }
}, PRE_ACTIVATION_SAFETY_INTERVAL_TICKS);

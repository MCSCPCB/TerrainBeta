import { world } from "@minecraft/server";

import { ACTIVE_GENERATOR_TYPE } from "./selection.js";
import { GENERATOR_CONFIGS } from "./generators.js";

export const WORLDGEN_CONFIGURATION_PROPERTY = "terrainbeta:worldgen_config";
export const WORLDGEN_ACTIVATED_PROPERTY = "terrainbeta:worldgen_activated";
export const WORLDGEN_INITIALIZATION_RETURN_PROPERTY = "terrainbeta:initialization_return";
export const WORLDGEN_PRE_ACTIVATION_HOLD_PROPERTY = "terrainbeta:pre_activation_hold";
export const MIN_WORLD_VERTICAL_OFFSET = -512;
export const MAX_WORLD_VERTICAL_OFFSET = 384;

const PLAYER_CONFIGURABLE_OPTION_KEYS = Object.freeze([
  "ores",
  "trees",
  "flora",
  "springs",
  "snow",
  "caves",
  "lakes",
  "snowCovered",
  "randomFeatures",
]);
const PLAYER_CONFIGURABLE_OPTION_KEY_SET = new Set(
  PLAYER_CONFIGURABLE_OPTION_KEYS,
);

export const PLAYER_CONFIGURABLE_FIELDS = Object.freeze({
  generatorKey: true,
  seed: true,
  worldVerticalOffset: true,
  farlandsCoordinate: true,
  optionKeys: PLAYER_CONFIGURABLE_OPTION_KEYS,
});

export const PLAYER_VISIBLE_OPTION_KEYS_BY_GENERATOR = Object.freeze({
  alpha1016: Object.freeze([
    "caves",
    "ores",
    "trees",
    "flora",
    "springs",
    "snow",
    "snowCovered",
  ]),
  beta173: Object.freeze([
    "caves",
    "ores",
    "trees",
    "flora",
    "springs",
    "snow",
    "lakes",
  ]),
  beta173sky: Object.freeze([
    "caves",
    "ores",
    "trees",
    "flora",
    "springs",
    "snow",
    "lakes",
  ]),
  beta173twilightforest: Object.freeze([
    "ores",
    "trees",
    "flora",
    "springs",
    "snow",
    "lakes",
    "randomFeatures",
  ]),
});

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function tryParseJson(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn(`Failed to parse stored worldgen config: ${error}`);
    return null;
  }
}

function getConfiguredGeneratorOrThrow(generatorType) {
  const generatorConfig = GENERATOR_CONFIGS[generatorType];
  if (!generatorConfig) {
    const configuredTypes = Object.keys(GENERATOR_CONFIGS).join(", ");
    throw new Error(
      `No config found for generator '${generatorType}'. Configured generators: ${configuredTypes}`,
    );
  }

  return generatorConfig;
}

function normalizeGeneratorKey(generatorKey) {
  return typeof generatorKey === "string" && generatorKey.length > 0
    ? generatorKey
    : ACTIVE_GENERATOR_TYPE;
}

function getVisibleOptionKeys(generatorType) {
  return PLAYER_VISIBLE_OPTION_KEYS_BY_GENERATOR[generatorType] ?? [];
}

function normalizeWorldVerticalOffset(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    MIN_WORLD_VERTICAL_OFFSET,
    Math.min(MAX_WORLD_VERTICAL_OFFSET, Math.trunc(value)),
  );
}

export function loadStoredWorldgenConfigSubmission() {
  return tryParseJson(world.getDynamicProperty(WORLDGEN_CONFIGURATION_PROPERTY));
}

export function saveStoredWorldgenConfigSubmission(submittedConfig) {
  const sanitizedSubmission = sanitizeSubmittedWorldgenConfig(submittedConfig);
  world.setDynamicProperty(
    WORLDGEN_CONFIGURATION_PROPERTY,
    JSON.stringify(sanitizedSubmission),
  );
  return sanitizedSubmission;
}

export function clearStoredWorldgenConfigSubmission() {
  world.setDynamicProperty(WORLDGEN_CONFIGURATION_PROPERTY, undefined);
}

export function isWorldGenerationActivated() {
  return world.getDynamicProperty(WORLDGEN_ACTIVATED_PROPERTY) === true;
}

export function setWorldGenerationActivated(value) {
  world.setDynamicProperty(WORLDGEN_ACTIVATED_PROPERTY, value === true);
}

export function sanitizeSubmittedWorldgenConfig(submittedConfig) {
  const generatorKey = normalizeGeneratorKey(submittedConfig?.generatorKey);
  const visibleOptionKeys = getVisibleOptionKeys(generatorKey);
  const submittedGeneratorConfig = submittedConfig?.config ?? {};
  const submittedOptions = submittedGeneratorConfig.options ?? {};
  const sanitizedOptions = {};

  for (const optionKey of visibleOptionKeys) {
    if (
      !PLAYER_CONFIGURABLE_OPTION_KEY_SET.has(optionKey)
      || !Object.prototype.hasOwnProperty.call(submittedOptions, optionKey)
    ) {
      continue;
    }

    sanitizedOptions[optionKey] = Boolean(submittedOptions[optionKey]);
  }

  const sanitizedConfig = {
    options: sanitizedOptions,
  };

  if (submittedGeneratorConfig.seed !== undefined) {
    sanitizedConfig.seed = `${submittedGeneratorConfig.seed}`;
  }

  if (submittedGeneratorConfig.worldVerticalOffset !== undefined) {
    sanitizedConfig.worldVerticalOffset = normalizeWorldVerticalOffset(
      Number(submittedGeneratorConfig.worldVerticalOffset),
    );
  }

  if (submittedGeneratorConfig.farlandsCoordinate !== undefined) {
    sanitizedConfig.farlandsCoordinate = Number(
      submittedGeneratorConfig.farlandsCoordinate,
    );
  }

  return {
    generatorKey,
    config: sanitizedConfig,
  };
}

function getDefaultConfiguredGeneratorSelection() {
  return {
    generatorType: ACTIVE_GENERATOR_TYPE,
    generatorConfig: cloneConfig(getConfiguredGeneratorOrThrow(ACTIVE_GENERATOR_TYPE)),
  };
}

export function resolveConfiguredGeneratorSelection(
  submittedConfig = loadStoredWorldgenConfigSubmission(),
) {
  if (!submittedConfig) {
    return getDefaultConfiguredGeneratorSelection();
  }

  const generatorType = normalizeGeneratorKey(submittedConfig.generatorKey);
  const generatorConfig = cloneConfig(getConfiguredGeneratorOrThrow(generatorType));
  const submittedGeneratorConfig = submittedConfig.config ?? {};
  const submittedWorldVerticalOffset = Number(
    submittedGeneratorConfig.worldVerticalOffset,
  );

  if (submittedGeneratorConfig.seed !== undefined) {
    generatorConfig.seed = `${submittedGeneratorConfig.seed}`;
  }

  if (Number.isFinite(submittedWorldVerticalOffset)) {
    generatorConfig.worldVerticalOffset = normalizeWorldVerticalOffset(
      submittedWorldVerticalOffset,
    );
  }

  if (Number.isFinite(submittedGeneratorConfig.farlandsCoordinate)) {
    generatorConfig.farlandsCoordinate = Math.trunc(
      submittedGeneratorConfig.farlandsCoordinate,
    );
  }

  const visibleOptionKeys = getVisibleOptionKeys(generatorType);
  const submittedOptions = submittedGeneratorConfig.options ?? {};

  for (const optionKey of visibleOptionKeys) {
    if (!PLAYER_CONFIGURABLE_OPTION_KEY_SET.has(optionKey)) {
      continue;
    }

    if (
      !Object.prototype.hasOwnProperty.call(generatorConfig.options, optionKey)
      || !Object.prototype.hasOwnProperty.call(submittedOptions, optionKey)
    ) {
      continue;
    }

    generatorConfig.options[optionKey] = Boolean(submittedOptions[optionKey]);
  }

  return {
    generatorType,
    generatorConfig,
  };
}

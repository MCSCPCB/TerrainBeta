import { ACTIVE_GENERATOR_TYPE } from "./config/selection.js";
import { GENERATOR_CONFIGS } from "./config/generators.js";
import {
  PLAYER_CONFIGURABLE_FIELDS,
  PLAYER_VISIBLE_OPTION_KEYS_BY_GENERATOR,
  resolveConfiguredGeneratorSelection,
  WORLDGEN_ACTIVATED_PROPERTY,
  WORLDGEN_CONFIGURATION_PROPERTY,
  WORLDGEN_INITIALIZATION_RETURN_PROPERTY,
  WORLDGEN_PRE_ACTIVATION_HOLD_PROPERTY,
} from "./config/playerConfig.js";
import { BLOCK_GENERATION_CONFIG } from "./config/blocks.js";
import { getGeneratorFactory, listGeneratorTypes } from "./generators/registry.js";

export function createConfiguredWorldGenerator() {
  const {
    generatorType,
    generatorConfig,
  } = resolveConfiguredGeneratorSelection();
  const factory = getGeneratorFactory(generatorType);

  return factory(generatorConfig);
}

export {
  ACTIVE_GENERATOR_TYPE,
  BLOCK_GENERATION_CONFIG,
  GENERATOR_CONFIGS,
  PLAYER_CONFIGURABLE_FIELDS,
  PLAYER_VISIBLE_OPTION_KEYS_BY_GENERATOR,
  WORLDGEN_ACTIVATED_PROPERTY,
  WORLDGEN_CONFIGURATION_PROPERTY,
  WORLDGEN_INITIALIZATION_RETURN_PROPERTY,
  WORLDGEN_PRE_ACTIVATION_HOLD_PROPERTY,
  listGeneratorTypes,
};

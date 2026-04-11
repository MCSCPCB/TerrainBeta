import { ACTIVE_GENERATOR_TYPE } from "./config/selection.js";
import { GENERATOR_CONFIGS } from "./config/generators.js";
import { BLOCK_GENERATION_CONFIG } from "./config/blocks.js";
import { getGeneratorFactory, listGeneratorTypes } from "./generators/registry.js";

function getActiveGeneratorConfig() {
  const generatorConfig = GENERATOR_CONFIGS[ACTIVE_GENERATOR_TYPE];
  if (!generatorConfig) {
    const configuredTypes = Object.keys(GENERATOR_CONFIGS).join(", ");
    throw new Error(
      `No config found for active generator '${ACTIVE_GENERATOR_TYPE}'. Configured generators: ${configuredTypes}`,
    );
  }
  return generatorConfig;
}

export function createConfiguredWorldGenerator() {
  const generatorConfig = getActiveGeneratorConfig();
  const factory = getGeneratorFactory(ACTIVE_GENERATOR_TYPE);

  return factory(generatorConfig);
}

export {
  ACTIVE_GENERATOR_TYPE,
  BLOCK_GENERATION_CONFIG,
  GENERATOR_CONFIGS,
  listGeneratorTypes,
};

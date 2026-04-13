import { createAlpha1016WorldGenerator } from "./alpha1016.js";
import { createBeta173WorldGenerator } from "./beta173.js";
import { createBeta173SkyWorldGenerator } from "./beta173sky.js";
import { createBeta173TwilightForestWorldGenerator } from "./beta173twilightforest.js";

const GENERATOR_FACTORIES = {
  alpha1016: createAlpha1016WorldGenerator,
  beta173: createBeta173WorldGenerator,
  beta173sky: createBeta173SkyWorldGenerator,
  beta173twilightforest: createBeta173TwilightForestWorldGenerator,
};

export function getGeneratorFactory(generatorType) {
  const factory = GENERATOR_FACTORIES[generatorType];
  if (!factory) {
    const supportedTypes = Object.keys(GENERATOR_FACTORIES).join(", ");
    throw new Error(`Unknown generator type '${generatorType}'. Supported types: ${supportedTypes}`);
  }
  return factory;
}

export function listGeneratorTypes() {
  return Object.keys(GENERATOR_FACTORIES);
}

import { createBeta173WorldGenerator } from "./beta173.js";
import { createBeta173SkyWorldGenerator } from "./beta173sky.js";

const GENERATOR_FACTORIES = {
  beta173: createBeta173WorldGenerator,
  beta173sky: createBeta173SkyWorldGenerator,
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

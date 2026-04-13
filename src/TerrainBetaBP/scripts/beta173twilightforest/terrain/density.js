import { JavaRandom } from "../../beta173/random/java.js";
import { NoiseGeneratorOctaves173 } from "../../beta173/noise/index.js";
import { toJavaLong } from "../../beta173/random/java.js";
import { chunkBlockIndex, coarseFieldIndex, layerIndex } from "../../beta173/utils/layout.js";
import { BLOCKS, BIOME_IDS } from "../biome/index.js";

const MAIN_NOISE_SCALE = 684.41200000000003;

function initTerrainNoises(seed) {
  const random = new JavaRandom(toJavaLong(seed));
  return {
    minLimitNoise: new NoiseGeneratorOctaves173(random, 16),
    maxLimitNoise: new NoiseGeneratorOctaves173(random, 16),
    mainNoise: new NoiseGeneratorOctaves173(random, 8),
    scaleNoise: new NoiseGeneratorOctaves173(random, 10),
    depthNoise: new NoiseGeneratorOctaves173(random, 16),
    forestNoise: new NoiseGeneratorOctaves173(random, 8),
  };
}

export function initializeTwilightTerrainState(generator, seed) {
  Object.assign(generator, initTerrainNoises(seed));
  generator.scaleNoiseBuffer = null;
  generator.depthNoiseBuffer = null;
  generator.mainNoiseBuffer = null;
  generator.minLimitNoiseBuffer = null;
  generator.maxLimitNoiseBuffer = null;
}

export function generateDensityFieldExact(generator, climateData, chunkX, chunkZ, buffer = null) {
  const coarseX = chunkX * 4;
  const coarseZ = chunkZ * 4;

  generator.scaleNoiseBuffer = generator.scaleNoise.generateNoise2D(
    generator.scaleNoiseBuffer,
    coarseX,
    coarseZ,
    5,
    5,
    1.121,
    1.121,
  );
  generator.depthNoiseBuffer = generator.depthNoise.generateNoise2D(
    generator.depthNoiseBuffer,
    coarseX,
    coarseZ,
    5,
    5,
    200.0,
    200.0,
  );
  generator.mainNoiseBuffer = generator.mainNoise.generateNoise(
    generator.mainNoiseBuffer,
    coarseX,
    0,
    coarseZ,
    5,
    17,
    5,
    MAIN_NOISE_SCALE / 80.0,
    MAIN_NOISE_SCALE / 160.0,
    MAIN_NOISE_SCALE / 80.0,
  );
  generator.minLimitNoiseBuffer = generator.minLimitNoise.generateNoise(
    generator.minLimitNoiseBuffer,
    coarseX,
    0,
    coarseZ,
    5,
    17,
    5,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
  );
  generator.maxLimitNoiseBuffer = generator.maxLimitNoise.generateNoise(
    generator.maxLimitNoiseBuffer,
    coarseX,
    0,
    coarseZ,
    5,
    17,
    5,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
  );

  const field = buffer ?? new Float64Array(5 * 17 * 5);

  for (let x = 0; x < 5; x += 1) {
    const sampleX = x * 3 + 1;
    for (let z = 0; z < 5; z += 1) {
      const sampleZ = z * 3 + 1;
      const coarseIndex = x * 5 + z;
      const climateIndex = layerIndex(sampleX, sampleZ);
      const localTemperature = climateData.temperature[climateIndex];
      const localHumidity = climateData.humidity[climateIndex] * localTemperature;

      let inverseHumidity = 1.0 - localHumidity;
      inverseHumidity *= inverseHumidity;
      inverseHumidity *= inverseHumidity;
      inverseHumidity = 1.0 - inverseHumidity;

      let scale = (generator.scaleNoiseBuffer[coarseIndex] + 256.0) / 512.0;
      scale *= inverseHumidity;
      if (scale > 1.0) {
        scale = 1.0;
      }

      let depth = generator.depthNoiseBuffer[coarseIndex] / 8000.0;
      if (depth < 0.0) {
        depth = -depth * 0.3;
      }
      depth = depth * 3.0 - 2.0;

      if (depth < 0.0) {
        depth /= 2.0;
        if (depth < -1.0) {
          depth = -1.0;
        }
        depth /= 1.4;
        depth /= 2.0;
        scale = 0.0;
      } else {
        if (depth > 1.0) {
          depth = 1.0;
        }
        depth /= 8.0;
      }

      if (scale < 0.0) {
        scale = 0.0;
      }

      scale += 0.5;
      depth = (depth * 17.0) / 16.0;
      const depthColumn = 17.0 / 2.0 + depth * 4.0;

      for (let y = 0; y < 17; y += 1) {
        let density = 0.0;
        let reduction = ((y - depthColumn) * 12.0) / scale;
        if (reduction < 0.0) {
          reduction *= 4.0;
        }

        const fieldIndex = coarseFieldIndex(x, y, z);
        const minLimit = generator.minLimitNoiseBuffer[fieldIndex] / 512.0;
        const maxLimit = generator.maxLimitNoiseBuffer[fieldIndex] / 512.0;
        const blend = (generator.mainNoiseBuffer[fieldIndex] / 10.0 + 1.0) / 2.0;

        density = blend < 0.0
          ? minLimit
          : blend > 1.0
            ? maxLimit
            : minLimit + (maxLimit - minLimit) * blend;

        density -= reduction;

        if (y > 13) {
          const topFade = (y - 13) / 3.0;
          density = density * (1.0 - topFade) + -10.0 * topFade;
        }

        field[fieldIndex] = density;
      }
    }
  }

  return field;
}

export function generateBaseTerrainCellColumns(blocks, densityField, startCellX = 0, cellColumnCount = 4) {
  const endCellX = Math.min(4, startCellX + cellColumnCount);

  for (let cellX = startCellX; cellX < endCellX; cellX += 1) {
    for (let cellZ = 0; cellZ < 4; cellZ += 1) {
      for (let cellY = 0; cellY < 16; cellY += 1) {
        let density00 = densityField[coarseFieldIndex(cellX, cellY, cellZ)];
        let density01 = densityField[coarseFieldIndex(cellX, cellY, cellZ + 1)];
        let density10 = densityField[coarseFieldIndex(cellX + 1, cellY, cellZ)];
        let density11 = densityField[coarseFieldIndex(cellX + 1, cellY, cellZ + 1)];
        const densityStep00 = (densityField[coarseFieldIndex(cellX, cellY + 1, cellZ)] - density00) * 0.125;
        const densityStep01 = (densityField[coarseFieldIndex(cellX, cellY + 1, cellZ + 1)] - density01) * 0.125;
        const densityStep10 = (densityField[coarseFieldIndex(cellX + 1, cellY + 1, cellZ)] - density10) * 0.125;
        const densityStep11 = (densityField[coarseFieldIndex(cellX + 1, cellY + 1, cellZ + 1)] - density11) * 0.125;

        for (let yOffset = 0; yOffset < 8; yOffset += 1) {
          let densityX0 = density00;
          let densityX1 = density01;
          const densityXStep0 = (density10 - density00) * 0.25;
          const densityXStep1 = (density11 - density01) * 0.25;

          for (let xOffset = 0; xOffset < 4; xOffset += 1) {
            let density = densityX0;
            const densityZStep = (densityX1 - densityX0) * 0.25;
            const worldX = cellX * 4 + xOffset;

            for (let zOffset = 0; zOffset < 4; zOffset += 1) {
              const worldY = cellY * 8 + yOffset;
              const worldZ = cellZ * 4 + zOffset;
              blocks[chunkBlockIndex(worldX, worldY, worldZ)] = density > 0.0
                ? BLOCKS.STONE
                : BLOCKS.AIR;
              density += densityZStep;
            }

            densityX0 += densityXStep0;
            densityX1 += densityXStep1;
          }

          density00 += densityStep00;
          density01 += densityStep01;
          density10 += densityStep10;
          density11 += densityStep11;
        }
      }
    }
  }
}

export function generateBaseTerrain(blocks, densityField) {
  generateBaseTerrainCellColumns(blocks, densityField);
}

export function terraformChunk(blocks, climateData) {
  for (let x = 0; x < 16; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const index = layerIndex(x, z);
      const biome = climateData.biomes[index];
      const temperature = climateData.temperature[index];
      const humidity = climateData.humidity[index];
      let squishMultiplier = 0.25;

      if (biome === BIOME_IDS.TWILIGHT_HIGHLAND) {
        const factor = (1.0 - humidity * 4.0) * (1.0 - (1.0 - temperature) * 4.0);
        squishMultiplier = 0.35 + 0.25 * factor;
      } else if (biome === BIOME_IDS.TWILIGHT_SWAMP) {
        const factor = (1.0 - (1.0 - humidity) * 4.0) * (1.0 - (1.0 - temperature) * 4.0);
        squishMultiplier = 0.24 - 0.04 * factor;
      }

      let oldGround = -1;
      let newGround = -1;

      for (let y = 127; y >= 0; y -= 1) {
        const blockIndex = chunkBlockIndex(x, y, z);
        if (blocks[blockIndex] === BLOCKS.AIR) {
          continue;
        }

        if (newGround === -1) {
          oldGround = y;
          newGround = Math.trunc(oldGround * squishMultiplier);
        }

        if (y >= newGround) {
          blocks[blockIndex] = BLOCKS.AIR;
        }
      }
    }
  }
}

export function addGlaciers(blocks, climateData) {
  for (let x = 0; x < 16; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const climateIndex = layerIndex(x, z);
      if (climateData.biomes[climateIndex] !== BIOME_IDS.TWILIGHT_GLACIER) {
        continue;
      }

      let topLevel = -1;
      for (let y = 127; y >= 0; y -= 1) {
        if (blocks[chunkBlockIndex(x, y, z)] === BLOCKS.STONE) {
          topLevel = y;
          break;
        }
      }

      if (topLevel < 0) {
        continue;
      }

      const glacierTemperature = Math.min(climateData.temperature[climateIndex], 0.1);
      const glacierHeight = 10 + Math.trunc((0.1 - glacierTemperature) * 10.0);
      const glacierTop = Math.min(127, topLevel + glacierHeight + 1);
      for (let y = topLevel + 1; y <= glacierTop; y += 1) {
        blocks[chunkBlockIndex(x, y, z)] = BLOCKS.ICE;
      }
    }
  }
}

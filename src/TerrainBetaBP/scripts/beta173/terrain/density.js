import { BLOCKS } from "../biome/index.js";
import {
  generateFixedPerlinNoise,
  generateNormalPerlinNoise,
} from "../reference/index.js";
import {
  SEA_LEVEL,
  chunkBlockIndex,
  coarseFieldIndex,
  layerIndex,
} from "../utils/layout.js";
import { lerp } from "../utils/math.js";

const MAIN_NOISE_SCALE = 684.41200000000003;

export function generateDensityFieldExact(terrainTables, climateData, chunkX, chunkZ) {
  const coarseX = chunkX * 4;
  const coarseZ = chunkZ * 4;
  const surfaceNoise = new Float64Array(25);
  const depthNoise = new Float64Array(25);
  const mainNoise = new Float64Array(5 * 17 * 5);
  const minNoise = new Float64Array(5 * 17 * 5);
  const maxNoise = new Float64Array(5 * 17 * 5);

  generateFixedPerlinNoise(surfaceNoise, coarseX, coarseZ, 5, 5, 1.121, 1.121, terrainTables.scale);
  generateFixedPerlinNoise(depthNoise, coarseX, coarseZ, 5, 5, 200.0, 200.0, terrainTables.depth);
  generateNormalPerlinNoise(
    mainNoise,
    coarseX,
    0,
    coarseZ,
    5,
    17,
    5,
    MAIN_NOISE_SCALE / 80.0,
    MAIN_NOISE_SCALE / 160.0,
    MAIN_NOISE_SCALE / 80.0,
    terrainTables.mainLimit,
  );
  generateNormalPerlinNoise(
    minNoise,
    coarseX,
    0,
    coarseZ,
    5,
    17,
    5,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
    terrainTables.minLimit,
  );
  generateNormalPerlinNoise(
    maxNoise,
    coarseX,
    0,
    coarseZ,
    5,
    17,
    5,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
    MAIN_NOISE_SCALE,
    terrainTables.maxLimit,
  );

  const field = new Float64Array(5 * 17 * 5);

  for (let x = 0; x < 5; x += 1) {
    for (let z = 0; z < 5; z += 1) {
      const coarseIndex = x * 5 + z;
      const climateIndex = layerIndex(x * 3 + 1, z * 3 + 1);

      let aridity = 1.0 - climateData.rainfall[climateIndex] * climateData.temperature[climateIndex];
      aridity *= aridity;
      aridity *= aridity;
      aridity = 1.0 - aridity;

      let surface = (surfaceNoise[coarseIndex] / 512.0 + 0.5) * aridity;
      if (surface > 1.0) {
        surface = 1.0;
      }

      let depth = depthNoise[coarseIndex] / 8000.0;
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
        surface = 0.0;
      } else {
        if (depth > 1.0) {
          depth = 1.0;
        }
        depth /= 8.0;
      }

      if (surface < 0.0) {
        surface = 0.0;
      }

      surface += 0.5;
      depth = (depth * 17.0) / 16.0;
      const depthColumn = 8.5 + depth * 4.0;

      for (let y = 0; y < 17; y += 1) {
        let reduction = ((y - depthColumn) * 12.0) / surface;
        if (reduction < 0.0) {
          reduction *= 4.0;
        }

        const fieldIndex = coarseFieldIndex(x, y, z);
        const lower = minNoise[fieldIndex] / 512.0;
        const upper = maxNoise[fieldIndex] / 512.0;
        const blend = (mainNoise[fieldIndex] / 10.0 + 1.0) / 2.0;

        let density;
        if (blend < 0.0) {
          density = lower;
        } else if (blend > 1.0) {
          density = upper;
        } else {
          density = lerp(blend, lower, upper);
        }

        density -= reduction;

        if (y > 13) {
          const fadeTop = (y - 13) / 3.0;
          density = density * (1.0 - fadeTop) + -10.0 * fadeTop;
        }

        field[fieldIndex] = density;
      }
    }
  }

  return field;
}

export function generateBaseTerrainCellColumns(
  blocks,
  densityField,
  climateData,
  startCellX = 0,
  cellColumnCount = 4,
) {
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
              const blockIndex = chunkBlockIndex(worldX, worldY, worldZ);
              const climateIndex = layerIndex(worldX, worldZ);

              if (density > 0.0) {
                blocks[blockIndex] = BLOCKS.STONE;
              } else if (worldY < SEA_LEVEL) {
                blocks[blockIndex] = worldY === SEA_LEVEL - 1 && climateData.temperature[climateIndex] < 0.5
                  ? BLOCKS.ICE
                  : BLOCKS.WATER;
              } else {
                blocks[blockIndex] = BLOCKS.AIR;
              }

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

export function generateBaseTerrain(blocks, densityField, climateData) {
  generateBaseTerrainCellColumns(blocks, densityField, climateData);
}

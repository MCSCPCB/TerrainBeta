import { BLOCKS } from "../biome/constants.js";

export function generateDensityField(generator, climateData, chunkX, chunkZ, buffer = null) {
  let noise = buffer;
  if (!noise || noise.length < 297) {
    noise = new Float64Array(297);
  }

  let noiseIndex = 0;
  let climateIndex = 0;
  const fromX = chunkX * 2;
  const fromZ = chunkZ * 2;
  const sizeX = 3;
  const sizeY = 33;
  const sizeZ = 3;
  const sizeScale = 16 / sizeX;

  generator.scaleNoiseBuffer = generator.scaleNoise.generateNoise2D(
    generator.scaleNoiseBuffer,
    fromX,
    fromZ,
    sizeX,
    sizeZ,
    1.121,
    1.121,
  );
  generator.depthNoiseBuffer = generator.depthNoise.generateNoise2D(
    generator.depthNoiseBuffer,
    fromX,
    fromZ,
    sizeX,
    sizeZ,
    200.0,
    200.0,
  );

  const coordinateScale = 684.412 * 2.0;
  const heightScale = 684.412;
  generator.mainNoiseBuffer = generator.mainNoise.generateNoise(
    generator.mainNoiseBuffer,
    fromX,
    0,
    fromZ,
    sizeX,
    sizeY,
    sizeZ,
    coordinateScale / 80.0,
    heightScale / 160.0,
    coordinateScale / 80.0,
  );
  generator.minLimitNoiseBuffer = generator.minLimitNoise.generateNoise(
    generator.minLimitNoiseBuffer,
    fromX,
    0,
    fromZ,
    sizeX,
    sizeY,
    sizeZ,
    coordinateScale,
    heightScale,
    coordinateScale,
  );
  generator.maxLimitNoiseBuffer = generator.maxLimitNoise.generateNoise(
    generator.maxLimitNoiseBuffer,
    fromX,
    0,
    fromZ,
    sizeX,
    sizeY,
    sizeZ,
    coordinateScale,
    heightScale,
    coordinateScale,
  );

  for (let noiseX = 0; noiseX < sizeX; noiseX += 1) {
    const sampleX = noiseX * sizeScale + Math.floor(sizeScale / 2);

    for (let noiseZ = 0; noiseZ < sizeZ; noiseZ += 1) {
      const sampleZ = noiseZ * sizeScale + Math.floor(sizeScale / 2);
      const temperature = climateData.temperature[sampleX * 16 + sampleZ];
      const downfall = climateData.rainfall[sampleX * 16 + sampleZ] * temperature;

      let climateFactor = 1.0 - downfall;
      climateFactor *= climateFactor;
      climateFactor *= climateFactor;
      climateFactor = 1.0 - climateFactor;

      let scale = (generator.scaleNoiseBuffer[climateIndex] + 256.0) / 512.0;
      scale *= climateFactor;
      if (scale > 1.0) {
        scale = 1.0;
      }

      let depth = generator.depthNoiseBuffer[climateIndex] / 8000.0;
      if (depth < 0.0) {
        depth = -depth * 0.3;
      }
      depth = depth * 3.0 - 2.0;
      if (depth > 1.0) {
        depth = 1.0;
      }

      depth /= 8.0;
      depth = 0.0;
      if (scale < 0.0) {
        scale = 0.0;
      }

      scale += 0.5;
      depth = depth * sizeY / 16.0;
      climateIndex += 1;

      for (let noiseY = 0; noiseY < sizeY; noiseY += 1) {
        let density = 0.0;
        const minLimit = generator.minLimitNoiseBuffer[noiseIndex] / 512.0;
        const maxLimit = generator.maxLimitNoiseBuffer[noiseIndex] / 512.0;
        const blend = (generator.mainNoiseBuffer[noiseIndex] / 10.0 + 1.0) / 2.0;

        if (blend < 0.0) {
          density = minLimit;
        } else if (blend > 1.0) {
          density = maxLimit;
        } else {
          density = minLimit + (maxLimit - minLimit) * blend;
        }

        density -= 8.0;

        if (noiseY > sizeY - 32) {
          const slide = (noiseY - (sizeY - 32)) / (32 - 1.0);
          density = density * (1.0 - slide) + -30.0 * slide;
        }

        if (noiseY < 8) {
          const slide = (8 - noiseY) / (8 - 1.0);
          density = density * (1.0 - slide) + -30.0 * slide;
        }

        noise[noiseIndex] = density;
        noiseIndex += 1;
      }
    }
  }

  return noise;
}

export function generateBaseTerrainCellColumns(blocks, densityField, startCellX = 0, cellColumnCount = 2) {
  const endCellX = Math.min(2, startCellX + cellColumnCount);

  for (let cellX = startCellX; cellX < endCellX; cellX += 1) {
    for (let cellZ = 0; cellZ < 2; cellZ += 1) {
      for (let cellY = 0; cellY < 32; cellY += 1) {
        let densityNW = densityField[((cellX + 0) * 3 + cellZ + 0) * 33 + cellY + 0];
        let densitySW = densityField[((cellX + 0) * 3 + cellZ + 1) * 33 + cellY + 0];
        let densityNE = densityField[((cellX + 1) * 3 + cellZ + 0) * 33 + cellY + 0];
        let densitySE = densityField[((cellX + 1) * 3 + cellZ + 1) * 33 + cellY + 0];

        const densityNWStep = (densityField[((cellX + 0) * 3 + cellZ + 0) * 33 + cellY + 1] - densityNW) * 0.25;
        const densitySWStep = (densityField[((cellX + 0) * 3 + cellZ + 1) * 33 + cellY + 1] - densitySW) * 0.25;
        const densityNEStep = (densityField[((cellX + 1) * 3 + cellZ + 0) * 33 + cellY + 1] - densityNE) * 0.25;
        const densitySEStep = (densityField[((cellX + 1) * 3 + cellZ + 1) * 33 + cellY + 1] - densitySE) * 0.25;

        for (let subY = 0; subY < 4; subY += 1) {
          let densityWest = densityNW;
          let densityEast = densitySW;
          const densityWestStep = (densityNE - densityNW) * 0.125;
          const densityEastStep = (densitySE - densitySW) * 0.125;

          for (let subX = 0; subX < 8; subX += 1) {
            let density = densityWest;
            const densityStep = (densityEast - densityWest) * 0.125;
            let blockIndex = ((subX + cellX * 8) << 11) | ((cellZ * 8) << 7) | (cellY * 4 + subY);

            for (let subZ = 0; subZ < 8; subZ += 1) {
              blocks[blockIndex] = density > 0.0 ? BLOCKS.STONE : BLOCKS.AIR;
              blockIndex += 128;
              density += densityStep;
            }

            densityWest += densityWestStep;
            densityEast += densityEastStep;
          }

          densityNW += densityNWStep;
          densitySW += densitySWStep;
          densityNE += densityNEStep;
          densitySE += densitySEStep;
        }
      }
    }
  }

  return endCellX;
}

export function generateBaseTerrain(blocks, densityField) {
  generateBaseTerrainCellColumns(blocks, densityField);
}

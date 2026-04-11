import { JavaRandom } from "../random/java.js";
import { simplexFloorToInt } from "../utils/math.js";
import { F2, G2, createPermutation, simplexGrad } from "./shared.js";

export class NoiseGenerator2173 {
  constructor(random = new JavaRandom(0n)) {
    const state = createPermutation(random);
    this.perm = state.perm;
    this.offsetX = state.offsets[0];
    this.offsetY = state.offsets[1];
    this.offsetZ = state.offsets[2];
  }

  add(buffer, x, z, sizeX, sizeZ, scaleX, scaleZ, amplitude) {
    let index = 0;

    for (let offsetX = 0; offsetX < sizeX; offsetX += 1) {
      const sampleX = (x + offsetX) * scaleX + this.offsetX;

      for (let offsetZ = 0; offsetZ < sizeZ; offsetZ += 1) {
        const sampleZ = (z + offsetZ) * scaleZ + this.offsetY;
        const skew = (sampleX + sampleZ) * F2;

        const cellX = simplexFloorToInt(sampleX + skew);
        const cellZ = simplexFloorToInt(sampleZ + skew);

        const unskew = (cellX + cellZ) * G2;
        const originX = cellX - unskew;
        const originZ = cellZ - unskew;
        const localX = sampleX - originX;
        const localZ = sampleZ - originZ;

        const stepX = localX > localZ ? 1 : 0;
        const stepZ = localX > localZ ? 0 : 1;

        const middleX = localX - stepX + G2;
        const middleZ = localZ - stepZ + G2;
        const endX = localX - 1.0 + 2.0 * G2;
        const endZ = localZ - 1.0 + 2.0 * G2;

        const hashX = cellX & 255;
        const hashZ = cellZ & 255;
        const grad0 = this.perm[hashX + this.perm[hashZ]] % 12;
        const grad1 = this.perm[hashX + stepX + this.perm[hashZ + stepZ]] % 12;
        const grad2Index = this.perm[hashX + 1 + this.perm[hashZ + 1]] % 12;

        let corner0 = 0.0;
        let attenuation = 0.5 - localX * localX - localZ * localZ;
        if (attenuation >= 0.0) {
          attenuation *= attenuation;
          corner0 = attenuation * attenuation * simplexGrad(grad0, localX, localZ);
        }

        let corner1 = 0.0;
        attenuation = 0.5 - middleX * middleX - middleZ * middleZ;
        if (attenuation >= 0.0) {
          attenuation *= attenuation;
          corner1 = attenuation * attenuation * simplexGrad(grad1, middleX, middleZ);
        }

        let corner2 = 0.0;
        attenuation = 0.5 - endX * endX - endZ * endZ;
        if (attenuation >= 0.0) {
          attenuation *= attenuation;
          corner2 = attenuation * attenuation * simplexGrad(grad2Index, endX, endZ);
        }

        buffer[index] += 70.0 * (corner0 + corner1 + corner2) * amplitude;
        index += 1;
      }
    }
  }
}

export class NoiseGeneratorOctaves2173 {
  constructor(random, octaveCount) {
    this.noiseLevels = new Array(octaveCount);
    for (let index = 0; index < octaveCount; index += 1) {
      this.noiseLevels[index] = new NoiseGenerator2173(random);
    }
  }

  generate(buffer, x, z, sizeX, sizeZ, scaleX, scaleZ, frequencyScale, amplitudeScale = 0.5) {
    const requiredSize = sizeX * sizeZ;
    let output = buffer;

    if (output && output.length >= requiredSize) {
      output.fill(0.0);
    } else {
      output = new Float64Array(requiredSize);
    }

    let amplitudeDivisor = 1.0;
    let frequencyMultiplier = 1.0;
    const adjustedScaleX = scaleX / 1.5;
    const adjustedScaleZ = scaleZ / 1.5;

    for (let index = 0; index < this.noiseLevels.length; index += 1) {
      this.noiseLevels[index].add(
        output,
        x,
        z,
        sizeX,
        sizeZ,
        adjustedScaleX * frequencyMultiplier,
        adjustedScaleZ * frequencyMultiplier,
        0.55 / amplitudeDivisor,
      );
      frequencyMultiplier *= frequencyScale;
      amplitudeDivisor *= amplitudeScale;
    }

    return output;
  }
}

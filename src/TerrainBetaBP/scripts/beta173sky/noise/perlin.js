import { fade, javaFloorToInt, lerp } from "../utils/math.js";
import { createPermutation, grad2, grad3 } from "./shared.js";

export class NoiseGeneratorPerlin173 {
  constructor(random) {
    const state = createPermutation(random);
    this.perm = state.perm;
    this.offsetX = state.offsets[0];
    this.offsetY = state.offsets[1];
    this.offsetZ = state.offsets[2];
  }

  sample2D(x, z) {
    return this.sample3D(x, z, 0.0);
  }

  sample3D(x, y, z) {
    let localX = x + this.offsetX;
    let localY = y + this.offsetY;
    let localZ = z + this.offsetZ;

    const floorX = javaFloorToInt(localX);
    const floorY = javaFloorToInt(localY);
    const floorZ = javaFloorToInt(localZ);

    const hashX = floorX & 255;
    const hashY = floorY & 255;
    const hashZ = floorZ & 255;

    localX -= floorX;
    localY -= floorY;
    localZ -= floorZ;

    const fadeX = fade(localX);
    const fadeY = fade(localY);
    const fadeZ = fade(localZ);

    const permX0 = this.perm[hashX] + hashY;
    const permX0Z0 = this.perm[permX0] + hashZ;
    const permX0Z1 = this.perm[permX0 + 1] + hashZ;
    const permX1 = this.perm[hashX + 1] + hashY;
    const permX1Z0 = this.perm[permX1] + hashZ;
    const permX1Z1 = this.perm[permX1 + 1] + hashZ;

    return lerp(
      fadeZ,
      lerp(
        fadeY,
        lerp(
          fadeX,
          grad3(this.perm[permX0Z0], localX, localY, localZ),
          grad3(this.perm[permX1Z0], localX - 1.0, localY, localZ),
        ),
        lerp(
          fadeX,
          grad3(this.perm[permX0Z1], localX, localY - 1.0, localZ),
          grad3(this.perm[permX1Z1], localX - 1.0, localY - 1.0, localZ),
        ),
      ),
      lerp(
        fadeY,
        lerp(
          fadeX,
          grad3(this.perm[permX0Z0 + 1], localX, localY, localZ - 1.0),
          grad3(this.perm[permX1Z0 + 1], localX - 1.0, localY, localZ - 1.0),
        ),
        lerp(
          fadeX,
          grad3(this.perm[permX0Z1 + 1], localX, localY - 1.0, localZ - 1.0),
          grad3(this.perm[permX1Z1 + 1], localX - 1.0, localY - 1.0, localZ - 1.0),
        ),
      ),
    );
  }

  add(buffer, x, y, z, sizeX, sizeY, sizeZ, scaleX, scaleY, scaleZ, amplitude) {
    if (sizeY === 1) {
      let index = 0;
      const inverseAmplitude = 1.0 / amplitude;

      for (let offsetX = 0; offsetX < sizeX; offsetX += 1) {
        let localX = (x + offsetX) * scaleX + this.offsetX;
        const floorX = javaFloorToInt(localX);
        const hashX = floorX & 255;
        localX -= floorX;
        const fadeX = fade(localX);

        for (let offsetZ = 0; offsetZ < sizeZ; offsetZ += 1) {
          let localZ = (z + offsetZ) * scaleZ + this.offsetZ;
          const floorZ = javaFloorToInt(localZ);
          const hashZ = floorZ & 255;
          localZ -= floorZ;
          const fadeZ = fade(localZ);

          const perm0 = this.perm[hashX];
          const hash0 = this.perm[perm0] + hashZ;
          const perm1 = this.perm[hashX + 1];
          const hash1 = this.perm[perm1] + hashZ;

          const value0 = lerp(
            fadeX,
            grad2(this.perm[hash0], localX, localZ),
            grad3(this.perm[hash1], localX - 1.0, 0.0, localZ),
          );
          const value1 = lerp(
            fadeX,
            grad3(this.perm[hash0 + 1], localX, 0.0, localZ - 1.0),
            grad3(this.perm[hash1 + 1], localX - 1.0, 0.0, localZ - 1.0),
          );

          buffer[index] += lerp(fadeZ, value0, value1) * inverseAmplitude;
          index += 1;
        }
      }
      return;
    }

    let index = 0;
    const inverseAmplitude = 1.0 / amplitude;
    let cachedY = -1;
    let value00 = 0.0;
    let value01 = 0.0;
    let value10 = 0.0;
    let value11 = 0.0;

    for (let offsetX = 0; offsetX < sizeX; offsetX += 1) {
      let localX = (x + offsetX) * scaleX + this.offsetX;
      const floorX = javaFloorToInt(localX);
      const hashX = floorX & 255;
      localX -= floorX;
      const fadeX = fade(localX);

      for (let offsetZ = 0; offsetZ < sizeZ; offsetZ += 1) {
        let localZ = (z + offsetZ) * scaleZ + this.offsetZ;
        const floorZ = javaFloorToInt(localZ);
        const hashZ = floorZ & 255;
        localZ -= floorZ;
        const fadeZ = fade(localZ);

        for (let offsetY = 0; offsetY < sizeY; offsetY += 1) {
          let localY = (y + offsetY) * scaleY + this.offsetY;
          const floorY = javaFloorToInt(localY);
          const hashY = floorY & 255;
          localY -= floorY;
          const fadeY = fade(localY);

          if (offsetY === 0 || hashY !== cachedY) {
            cachedY = hashY;

            const perm00 = this.perm[hashX] + hashY;
            const hash00 = this.perm[perm00] + hashZ;
            const hash01 = this.perm[perm00 + 1] + hashZ;
            const perm10 = this.perm[hashX + 1] + hashY;
            const hash10 = this.perm[perm10] + hashZ;
            const hash11 = this.perm[perm10 + 1] + hashZ;

            value00 = lerp(
              fadeX,
              grad3(this.perm[hash00], localX, localY, localZ),
              grad3(this.perm[hash10], localX - 1.0, localY, localZ),
            );
            value01 = lerp(
              fadeX,
              grad3(this.perm[hash01], localX, localY - 1.0, localZ),
              grad3(this.perm[hash11], localX - 1.0, localY - 1.0, localZ),
            );
            value10 = lerp(
              fadeX,
              grad3(this.perm[hash00 + 1], localX, localY, localZ - 1.0),
              grad3(this.perm[hash10 + 1], localX - 1.0, localY, localZ - 1.0),
            );
            value11 = lerp(
              fadeX,
              grad3(this.perm[hash01 + 1], localX, localY - 1.0, localZ - 1.0),
              grad3(this.perm[hash11 + 1], localX - 1.0, localY - 1.0, localZ - 1.0),
            );
          }

          const value0 = lerp(fadeY, value00, value01);
          const value1 = lerp(fadeY, value10, value11);
          buffer[index] += lerp(fadeZ, value0, value1) * inverseAmplitude;
          index += 1;
        }
      }
    }
  }
}

export class NoiseGeneratorOctaves173 {
  constructor(random, octaveCount) {
    this.noiseLevels = new Array(octaveCount);
    for (let index = 0; index < octaveCount; index += 1) {
      this.noiseLevels[index] = new NoiseGeneratorPerlin173(random);
    }
  }

  generateNoiseForCoordinate(x, z) {
    let result = 0.0;
    let scale = 1.0;

    for (let index = 0; index < this.noiseLevels.length; index += 1) {
      result += this.noiseLevels[index].sample2D(x * scale, z * scale) / scale;
      scale /= 2.0;
    }

    return result;
  }

  generateNoise(buffer, x, y, z, sizeX, sizeY, sizeZ, scaleX, scaleY, scaleZ) {
    const requiredSize = sizeX * sizeY * sizeZ;
    let output = buffer;

    if (output && output.length >= requiredSize) {
      output.fill(0.0);
    } else {
      output = new Float64Array(requiredSize);
    }

    let amplitude = 1.0;
    for (let index = 0; index < this.noiseLevels.length; index += 1) {
      this.noiseLevels[index].add(
        output,
        x,
        y,
        z,
        sizeX,
        sizeY,
        sizeZ,
        scaleX * amplitude,
        scaleY * amplitude,
        scaleZ * amplitude,
        amplitude,
      );
      amplitude /= 2.0;
    }

    return output;
  }

  generateNoise2D(buffer, x, z, sizeX, sizeZ, scaleX, scaleZ) {
    return this.generateNoise(buffer, x, 10.0, z, sizeX, 1, sizeZ, scaleX, 1.0, scaleZ);
  }
}

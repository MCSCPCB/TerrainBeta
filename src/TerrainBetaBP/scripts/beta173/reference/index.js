import { JavaRandom, toJavaLong } from "../random/java.js";

const F2 = 0.3660254037844386;
const G2 = 0.21132486540518713;
const MAIN_NOISE_SCALE = 684.41200000000003;
const OFFSET_Z = 12;
const DEFAULT_INT_MIN = -2147483648;
const DEFAULT_INT_MAX = 2147483647;
export const DEFAULT_FARLANDS_COORDINATE = 12550821;

const farlandsConfig = {
     coordinate: DEFAULT_FARLANDS_COORDINATE,
     intMin: DEFAULT_INT_MIN,
     intMax: DEFAULT_INT_MAX,
};

const SIMPLEX_GRAD = [
     [1, 1],
     [-1, 1],
     [1, -1],
     [-1, -1],
     [1, 0],
     [-1, 0],
     [1, 0],
     [-1, 0],
     [0, 1],
     [0, -1],
     [0, 1],
     [0, -1],
];

function lerp(amount, a, b) {
     return a + amount * (b - a);
}

function resolveFarlandsIntMax(coordinate) {
     if (coordinate === DEFAULT_FARLANDS_COORDINATE) {
          return DEFAULT_INT_MAX;
     }

     return Math.max(
          1,
          Math.round(
               (DEFAULT_INT_MAX * coordinate) / DEFAULT_FARLANDS_COORDINATE,
          ),
     );
}

export function setFarlandsCoordinate(
     coordinate = DEFAULT_FARLANDS_COORDINATE,
) {
     if (
          !Number.isInteger(coordinate) ||
          coordinate <= 0 ||
          coordinate > DEFAULT_FARLANDS_COORDINATE
     ) {
          throw new RangeError(
               `farlandsCoordinate must be an integer between 1 and ${DEFAULT_FARLANDS_COORDINATE}`,
          );
     }

     farlandsConfig.coordinate = coordinate;
     farlandsConfig.intMax = resolveFarlandsIntMax(coordinate);
     farlandsConfig.intMin = -farlandsConfig.intMax - 1;
}

export function getFarlandsCoordinate() {
     return farlandsConfig.coordinate;
}

function javaIntCast(value) {
     if (Number.isNaN(value)) {
          return 0;
     }
     if (value >= farlandsConfig.intMax) {
          return farlandsConfig.intMax;
     }
     if (value <= farlandsConfig.intMin) {
          return farlandsConfig.intMin;
     }
     return value < 0.0 ? Math.ceil(value) : Math.floor(value);
}

function javaFloor(value) {
     let truncated = javaIntCast(value);
     if (value < truncated) {
          truncated -= 1;
     }
     return truncated;
}

function simplexFloor(value) {
     const truncated = javaIntCast(value);
     return value > 0.0 ? truncated : (truncated - 1) | 0;
}

function fade(value) {
     return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
}

function grad(hash, x, y, z) {
     switch (hash & 0xf) {
          case 0x0:
               return x + y;
          case 0x1:
               return -x + y;
          case 0x2:
               return x - y;
          case 0x3:
               return -x - y;
          case 0x4:
               return x + z;
          case 0x5:
               return -x + z;
          case 0x6:
               return x - z;
          case 0x7:
               return -x - z;
          case 0x8:
               return y + z;
          case 0x9:
               return -y + z;
          case 0xa:
               return y - z;
          case 0xb:
               return -y - z;
          case 0xc:
               return y + x;
          case 0xd:
               return -y + z;
          case 0xe:
               return y - x;
          case 0xf:
               return -y - z;
          default:
               return 0.0;
     }
}

function grad2D(hash, x, z) {
     return grad(hash, x, 0.0, z);
}

function createPermutationTable(random) {
     const permutations = new Uint8Array(256);
     for (let index = 0; index < 256; index += 1) {
          permutations[index] = index;
     }

     const table = {
          xo: random.nextDouble() * 256.0,
          yo: random.nextDouble() * 256.0,
          zo: random.nextDouble() * 256.0,
          permutations,
     };

     for (let index = 0; index < 256; index += 1) {
          const randomIndex = random.nextInt(256 - index) + index;
          if (randomIndex !== index) {
               const swap = permutations[index];
               permutations[index] = permutations[randomIndex];
               permutations[randomIndex] = swap;
          }
     }

     return table;
}

function initOctaves256(random, count) {
     const result = new Array(count);
     for (let index = 0; index < count; index += 1) {
          result[index] = createPermutationTable(random);
     }
     return result;
}

function simplexNoiseInto(
     buffer,
     chunkX,
     chunkZ,
     sizeX,
     sizeZ,
     scaleX,
     scaleZ,
     octaveFactor,
     table,
) {
     const perm = table.permutations;
     let index = 0;

     for (let x = 0; x < sizeX; x += 1) {
          const coordX = (chunkX + x) * scaleX + table.xo;

          for (let z = 0; z < sizeZ; z += 1) {
               const coordZ = (chunkZ + z) * scaleZ + table.yo;
               const skew = (coordX + coordZ) * F2;
               const tempX = simplexFloor(coordX + skew);
               const tempZ = simplexFloor(coordZ + skew);
               const unskew = (tempX + tempZ) * G2;
               const originX = tempX - unskew;
               const originZ = tempZ - unskew;
               const localX = coordX - originX;
               const localZ = coordZ - originZ;

               const offsetX = localX > localZ ? 1 : 0;
               const offsetZ = localX > localZ ? 0 : 1;

               const midX = localX - offsetX + G2;
               const midZ = localZ - offsetZ + G2;
               const endX = localX - 1.0 + 2.0 * G2;
               const endZ = localZ - 1.0 + 2.0 * G2;

               const ii = tempX & 0xff;
               const jj = tempZ & 0xff;
               const gi0 = perm[(ii + perm[jj]) & 0xff] % 12;
               const gi1 =
                    perm[(ii + offsetX + perm[(jj + offsetZ) & 0xff]) & 0xff] %
                    12;
               const gi2 = perm[(ii + 1 + perm[(jj + 1) & 0xff]) & 0xff] % 12;

               let n0 = 0.0;
               let t0 = 0.5 - localX * localX - localZ * localZ;
               if (t0 >= 0.0) {
                    t0 *= t0;
                    n0 =
                         t0 *
                         t0 *
                         (SIMPLEX_GRAD[gi0][0] * localX +
                              SIMPLEX_GRAD[gi0][1] * localZ);
               }

               let n1 = 0.0;
               let t1 = 0.5 - midX * midX - midZ * midZ;
               if (t1 >= 0.0) {
                    t1 *= t1;
                    n1 =
                         t1 *
                         t1 *
                         (SIMPLEX_GRAD[gi1][0] * midX +
                              SIMPLEX_GRAD[gi1][1] * midZ);
               }

               let n2 = 0.0;
               let t2 = 0.5 - endX * endX - endZ * endZ;
               if (t2 >= 0.0) {
                    t2 *= t2;
                    n2 =
                         t2 *
                         t2 *
                         (SIMPLEX_GRAD[gi2][0] * endX +
                              SIMPLEX_GRAD[gi2][1] * endZ);
               }

               buffer[index] += 70.0 * (n0 + n1 + n2) * octaveFactor;
               index += 1;
          }
     }
}

function getFixedSimplexNoise(
     chunkX,
     chunkZ,
     sizeX,
     sizeZ,
     scaleX,
     scaleZ,
     ampFactor,
     octaves,
) {
     const buffer = new Float64Array(sizeX * sizeZ);
     let octaveDiminution = 1.0;
     let octaveAmplification = 1.0;
     const adjustedScaleX = scaleX / 1.5;
     const adjustedScaleZ = scaleZ / 1.5;

     for (let index = 0; index < octaves.length; index += 1) {
          simplexNoiseInto(
               buffer,
               chunkX,
               chunkZ,
               sizeX,
               sizeZ,
               adjustedScaleX * octaveAmplification,
               adjustedScaleZ * octaveAmplification,
               0.55 / octaveDiminution,
               octaves[index],
          );
          octaveAmplification *= ampFactor;
          octaveDiminution *= 0.5;
     }

     return buffer;
}

export function generateFixedPerlinNoise(
     buffer,
     chunkX,
     chunkZ,
     sizeX,
     sizeZ,
     scaleX,
     scaleZ,
     octaves,
) {
     buffer.fill(0.0);
     let octaveScale = 1.0;

     for (let octave = 0; octave < octaves.length; octave += 1) {
          const table = octaves[octave];
          const perm = table.permutations;
          const octaveWidth = 1.0 / octaveScale;
          let index = 0;

          for (let x = 0; x < sizeX; x += 1) {
               let coordX = (chunkX + x) * (scaleX * octaveScale) + table.xo;
               const floorX = javaFloor(coordX);
               const xBottom = floorX & 0xff;
               coordX -= floorX;
               const fadeX = fade(coordX);

               for (let z = 0; z < sizeZ; z += 1) {
                    let coordZ =
                         (chunkZ + z) * (scaleZ * octaveScale) + table.zo;
                    const floorZ = javaFloor(coordZ);
                    const zBottom = floorZ & 0xff;
                    coordZ -= floorZ;
                    const fadeZ = fade(coordZ);

                    const hhxz = (perm[perm[xBottom] & 0xff] + zBottom) & 0xff;
                    const hhx1z =
                         (perm[perm[(xBottom + 1) & 0xff] & 0xff] + zBottom) &
                         0xff;
                    const Hhhxz = perm[hhxz];
                    const Hhhx1z = perm[hhx1z];
                    const Hhhxz1 = perm[(hhxz + 1) & 0xff];
                    const Hhhx1z1 = perm[(hhx1z + 1) & 0xff];
                    const valueX0 = lerp(
                         fadeX,
                         grad2D(Hhhxz, coordX, coordZ),
                         grad2D(Hhhx1z, coordX - 1.0, coordZ),
                    );
                    const valueX1 = lerp(
                         fadeX,
                         grad2D(Hhhxz1, coordX, coordZ - 1.0),
                         grad2D(Hhhx1z1, coordX - 1.0, coordZ - 1.0),
                    );

                    buffer[index] +=
                         lerp(fadeZ, valueX0, valueX1) * octaveWidth;
                    index += 1;
               }
          }

          octaveScale /= 2.0;
     }

     return buffer;
}

export function generateNormalPerlinNoise(
     buffer,
     chunkX,
     chunkY,
     chunkZ,
     sizeX,
     sizeY,
     sizeZ,
     scaleX,
     scaleY,
     scaleZ,
     octaves,
) {
     buffer.fill(0.0);
     let octaveScale = 1.0;

     for (let octave = 0; octave < octaves.length; octave += 1) {
          const table = octaves[octave];
          const perm = table.permutations;
          const octaveWidth = 1.0 / octaveScale;
          let cachedBottom = -1;
          let valueX0Y0 = 0.0;
          let valueX0Y1 = 0.0;
          let valueX1Y0 = 0.0;
          let valueX1Y1 = 0.0;
          let index = 0;

          for (let x = 0; x < sizeX; x += 1) {
               let coordX = (chunkX + x) * (scaleX * octaveScale) + table.xo;
               const floorX = javaFloor(coordX);
               const xBottom = floorX & 0xff;
               coordX -= floorX;
               const fadeX = fade(coordX);

               for (let z = 0; z < sizeZ; z += 1) {
                    let coordZ =
                         (chunkZ + z) * (scaleZ * octaveScale) + table.zo;
                    const floorZ = javaFloor(coordZ);
                    const zBottom = floorZ & 0xff;
                    coordZ -= floorZ;
                    const fadeZ = fade(coordZ);

                    for (let y = 0; y < sizeY; y += 1) {
                         let coordY =
                              (chunkY + y) * (scaleY * octaveScale) + table.yo;
                         const floorY = javaFloor(coordY);
                         const yBottom = floorY & 0xff;
                         coordY -= floorY;
                         const fadeY = fade(coordY);

                         if (y === 0 || yBottom !== cachedBottom) {
                              cachedBottom = yBottom;
                              const k2 =
                                   perm[
                                        (perm[xBottom & 0xff] + yBottom) & 0xff
                                   ] + zBottom;
                              const l2 =
                                   perm[
                                        (perm[xBottom & 0xff] + yBottom + 1) &
                                             0xff
                                   ] + zBottom;
                              const k3 =
                                   perm[
                                        (perm[(xBottom + 1) & 0xff] + yBottom) &
                                             0xff
                                   ] + zBottom;
                              const l3 =
                                   perm[
                                        (perm[(xBottom + 1) & 0xff] +
                                             yBottom +
                                             1) &
                                             0xff
                                   ] + zBottom;

                              valueX0Y0 = lerp(
                                   fadeX,
                                   grad(
                                        perm[k2 & 0xff],
                                        coordX,
                                        coordY,
                                        coordZ,
                                   ),
                                   grad(
                                        perm[k3 & 0xff],
                                        coordX - 1.0,
                                        coordY,
                                        coordZ,
                                   ),
                              );
                              valueX0Y1 = lerp(
                                   fadeX,
                                   grad(
                                        perm[l2 & 0xff],
                                        coordX,
                                        coordY - 1.0,
                                        coordZ,
                                   ),
                                   grad(
                                        perm[l3 & 0xff],
                                        coordX - 1.0,
                                        coordY - 1.0,
                                        coordZ,
                                   ),
                              );
                              valueX1Y0 = lerp(
                                   fadeX,
                                   grad(
                                        perm[(k2 + 1) & 0xff],
                                        coordX,
                                        coordY,
                                        coordZ - 1.0,
                                   ),
                                   grad(
                                        perm[(k3 + 1) & 0xff],
                                        coordX - 1.0,
                                        coordY,
                                        coordZ - 1.0,
                                   ),
                              );
                              valueX1Y1 = lerp(
                                   fadeX,
                                   grad(
                                        perm[(l2 + 1) & 0xff],
                                        coordX,
                                        coordY - 1.0,
                                        coordZ - 1.0,
                                   ),
                                   grad(
                                        perm[(l3 + 1) & 0xff],
                                        coordX - 1.0,
                                        coordY - 1.0,
                                        coordZ - 1.0,
                                   ),
                              );
                         }

                         const lerpY0 = lerp(fadeY, valueX0Y0, valueX0Y1);
                         const lerpY1 = lerp(fadeY, valueX1Y0, valueX1Y1);
                         buffer[index] +=
                              lerp(fadeZ, lerpY0, lerpY1) * octaveWidth;
                         index += 1;
                    }
               }
          }

          octaveScale /= 2.0;
     }

     return buffer;
}

function generateOptimizedTerrainNoise(
     buffer,
     chunkX,
     chunkY,
     chunkZ,
     scaleX,
     scaleY,
     scaleZ,
     octaves,
) {
     buffer.fill(0.0);
     const possibleX = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
     const possibleZ = [3, 4, 3, 4, 3, 4, 3, 4, 3, 4];
     let octaveScale = 1.0;

     for (let octave = 0; octave < octaves.length; octave += 1) {
          const table = octaves[octave];
          const perm = table.permutations;
          const octaveWidth = 1.0 / octaveScale;
          let cachedBottom = -1;
          let valueX0Y0 = 0.0;
          let valueX0Y1 = 0.0;
          let valueX1Y0 = 0.0;
          let valueX1Y1 = 0.0;
          let columnIndex = 0;

          for (let index = 0; index < 10; index += 1) {
               let coordX =
                    (chunkX + possibleX[index]) * (scaleX * octaveScale) +
                    table.xo;
               const floorX = javaFloor(coordX);
               const xBottom = floorX & 0xff;
               coordX -= floorX;
               const fadeX = fade(coordX);

               let coordZ =
                    (chunkZ + possibleZ[index]) * (scaleZ * octaveScale) +
                    table.zo;
               const floorZ = javaFloor(coordZ);
               const zBottom = floorZ & 0xff;
               coordZ -= floorZ;
               const fadeZ = fade(coordZ);

               for (let y = 0; y < 11; y += 1) {
                    let coordY =
                         (chunkY + y) * (scaleY * octaveScale) + table.yo;
                    const floorY = javaFloor(coordY);
                    const yBottom = floorY & 0xff;
                    coordY -= floorY;
                    const fadeY = fade(coordY);

                    if (y === 0 || yBottom !== cachedBottom) {
                         cachedBottom = yBottom;

                         const k2 =
                              perm[(perm[xBottom & 0xff] + yBottom) & 0xff] +
                              zBottom;
                         const l2 =
                              perm[
                                   (perm[xBottom & 0xff] + yBottom + 1) & 0xff
                              ] + zBottom;
                         const k3 =
                              perm[
                                   (perm[(xBottom + 1) & 0xff] + yBottom) & 0xff
                              ] + zBottom;
                         const l3 =
                              perm[
                                   (perm[(xBottom + 1) & 0xff] + yBottom + 1) &
                                        0xff
                              ] + zBottom;

                         valueX0Y0 = lerp(
                              fadeX,
                              grad(perm[k2 & 0xff], coordX, coordY, coordZ),
                              grad(
                                   perm[k3 & 0xff],
                                   coordX - 1.0,
                                   coordY,
                                   coordZ,
                              ),
                         );
                         valueX0Y1 = lerp(
                              fadeX,
                              grad(
                                   perm[l2 & 0xff],
                                   coordX,
                                   coordY - 1.0,
                                   coordZ,
                              ),
                              grad(
                                   perm[l3 & 0xff],
                                   coordX - 1.0,
                                   coordY - 1.0,
                                   coordZ,
                              ),
                         );
                         valueX1Y0 = lerp(
                              fadeX,
                              grad(
                                   perm[(k2 + 1) & 0xff],
                                   coordX,
                                   coordY,
                                   coordZ - 1.0,
                              ),
                              grad(
                                   perm[(k3 + 1) & 0xff],
                                   coordX - 1.0,
                                   coordY,
                                   coordZ - 1.0,
                              ),
                         );
                         valueX1Y1 = lerp(
                              fadeX,
                              grad(
                                   perm[(l2 + 1) & 0xff],
                                   coordX,
                                   coordY - 1.0,
                                   coordZ - 1.0,
                              ),
                              grad(
                                   perm[(l3 + 1) & 0xff],
                                   coordX - 1.0,
                                   coordY - 1.0,
                                   coordZ - 1.0,
                              ),
                         );
                    }

                    const lerpY0 = lerp(fadeY, valueX0Y0, valueX0Y1);
                    const lerpY1 = lerp(fadeY, valueX1Y0, valueX1Y1);
                    buffer[columnIndex] +=
                         lerp(fadeZ, lerpY0, lerpY1) * octaveWidth;
                    columnIndex += 1;
               }
          }

          octaveScale /= 2.0;
     }

     return buffer;
}

function initTerrainReference(seed) {
     const random = new JavaRandom(seed);
     const minLimit = initOctaves256(random, 16);
     const maxLimit = initOctaves256(random, 16);
     const mainLimit = initOctaves256(random, 8);

     for (let octave = 0; octave < 4; octave += 1) {
          random.nextDouble();
          random.nextDouble();
          random.nextDouble();
          for (let i = 0; i < 256; i += 1) {
               random.nextInt(256 - i);
          }
     }

     const surfaceElevation = initOctaves256(random, 4);
     const scale = initOctaves256(random, 10);
     const depth = initOctaves256(random, 16);
     return { minLimit, maxLimit, mainLimit, surfaceElevation, scale, depth };
}

export function initTerrainTables(seed) {
     const random = new JavaRandom(seed);
     const minLimit = initOctaves256(random, 16);
     const maxLimit = initOctaves256(random, 16);
     const mainLimit = initOctaves256(random, 8);
     const shoreBottomComposition = initOctaves256(random, 4);
     const surfaceElevation = initOctaves256(random, 4);
     const scale = initOctaves256(random, 10);
     const depth = initOctaves256(random, 16);
     const forest = initOctaves256(random, 8);
     return {
          minLimit,
          maxLimit,
          mainLimit,
          shoreBottomComposition,
          surfaceElevation,
          scale,
          depth,
          forest,
     };
}

export function generateClimateAreaReference(
     seed,
     blockX,
     blockZ,
     sizeX = 16,
     sizeZ = 16,
) {
     const worldSeed = toJavaLong(seed);
     const temperature = getFixedSimplexNoise(
          blockX,
          blockZ,
          sizeX,
          sizeZ,
          0.02500000037252903,
          0.02500000037252903,
          0.25,
          initOctaves256(
               new JavaRandom(BigInt.asIntN(64, worldSeed * 9871n)),
               4,
          ),
     );
     const humidity = getFixedSimplexNoise(
          blockX,
          blockZ,
          sizeX,
          sizeZ,
          0.05000000074505806,
          0.05000000074505806,
          0.33333333333333331,
          initOctaves256(
               new JavaRandom(BigInt.asIntN(64, worldSeed * 39811n)),
               4,
          ),
     );
     const precipitation = getFixedSimplexNoise(
          blockX,
          blockZ,
          sizeX,
          sizeZ,
          0.25,
          0.25,
          0.58823529411764708,
          initOctaves256(
               new JavaRandom(BigInt.asIntN(64, worldSeed * 543321n)),
               2,
          ),
     );

     for (let index = 0; index < sizeX * sizeZ; index += 1) {
          const preci = precipitation[index] * 1.1000000000000001 + 0.5;
          let temp =
               (temperature[index] * 0.14999999999999999 +
                    0.69999999999999996) *
                    (1.0 - 0.01) +
               preci * 0.01;
          temp = 1.0 - (1.0 - temp) * (1.0 - temp);
          if (temp < 0.0) temp = 0.0;
          if (temp > 1.0) temp = 1.0;

          let hum =
               (humidity[index] * 0.14999999999999999 + 0.5) * (1.0 - 0.002) +
               preci * 0.002;
          if (hum < 0.0) hum = 0.0;
          if (hum > 1.0) hum = 1.0;

          temperature[index] = temp;
          humidity[index] = hum;
     }

     return { temperature, humidity };
}

export function generateClimateReference(seed, chunkX, chunkZ) {
     return generateClimateAreaReference(
          seed,
          chunkX * 16,
          chunkZ * 16,
          16,
          16,
     );
}

export function fillNoiseColumnReference(chunkX, chunkZ, climate, terrain) {
     const noiseColumn = new Float64Array(20);
     const surfaceNoise = new Float64Array(25);
     const depthNoise = new Float64Array(25);
     generateFixedPerlinNoise(
          surfaceNoise,
          chunkX,
          chunkZ,
          5,
          5,
          1.121,
          1.121,
          terrain.scale,
     );
     generateFixedPerlinNoise(
          depthNoise,
          chunkX,
          chunkZ,
          5,
          5,
          200.0,
          200.0,
          terrain.depth,
     );

     const mainLimit = new Float64Array(110);
     const minLimit = new Float64Array(110);
     const maxLimit = new Float64Array(110);
     generateOptimizedTerrainNoise(
          mainLimit,
          chunkX,
          0,
          chunkZ,
          MAIN_NOISE_SCALE / 80.0,
          MAIN_NOISE_SCALE / 160.0,
          MAIN_NOISE_SCALE / 80.0,
          terrain.mainLimit,
     );
     generateOptimizedTerrainNoise(
          minLimit,
          chunkX,
          0,
          chunkZ,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          terrain.minLimit,
     );
     generateOptimizedTerrainNoise(
          maxLimit,
          chunkX,
          0,
          chunkZ,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          terrain.maxLimit,
     );

     const possibleCellCounter = [3, 4, 8, 9, 13, 14, 18, 19, 23, 24];
     let outIndex = 0;

     for (let index = 0; index < possibleCellCounter.length; index += 1) {
          const cellCounter = possibleCellCounter[index];
          const climateX = Math.trunc(cellCounter / 5) * 3 + 1;
          const climateZ = (cellCounter % 5) * 3 + 1;
          const climateIndex = climateX * 16 + climateZ;

          let aridity =
               1.0 -
               climate.humidity[climateIndex] *
                    climate.temperature[climateIndex];
          aridity *= aridity;
          aridity *= aridity;
          aridity = 1.0 - aridity;

          let surface =
               (surfaceNoise[cellCounter] / 512.0 + 256.0 / 512.0) * aridity;
          if (surface > 1.0) {
               surface = 1.0;
          }

          let depth = depthNoise[cellCounter] / 8000.0;
          if (depth < 0.0) {
               depth = -depth * 0.29999999999999999;
          }
          depth = depth * 3.0 - 2.0;

          if (depth < 0.0) {
               depth /= 2.0;
               if (depth < -1.0) {
                    depth = -1.0;
               }
               depth /= 1.3999999999999999;
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
          const depthColumn = 17.0 / 2.0 + depth * 4.0;

          for (let column = 9; column < 11; column += 1) {
               let columnPerSurface = ((column - depthColumn) * 12.0) / surface;
               if (columnPerSurface < 0.0) {
                    columnPerSurface *= 4.0;
               }

               const noiseIndex = index * 11 + column;
               const lower = minLimit[noiseIndex] / 512.0;
               const upper = maxLimit[noiseIndex] / 512.0;
               const main = (mainLimit[noiseIndex] / 10.0 + 1.0) / 2.0;

               let limit;
               if (main < 0.0) {
                    limit = lower;
               } else if (main > 1.0) {
                    limit = upper;
               } else {
                    limit = lower + (upper - lower) * main;
               }

               noiseColumn[outIndex] = limit - columnPerSurface;
               outIndex += 1;
          }
     }

     return noiseColumn;
}

function advance4(random) {
     random.seed =
          (random.seed * 0x32eb772c5f11n + 0x2d3873c4cd04n) &
          ((1n << 48n) - 1n);
}

function advance6(random) {
     random.seed =
          (random.seed * 0x45d73749a7f9n + 0x17617168255en) &
          ((1n << 48n) - 1n);
}

export function generateHeightFieldReference(chunkX, chunkZ, terrain) {
     const heightField = new Float64Array(256);
     let octaveScale = 1.0;

     for (
          let octave = 0;
          octave < terrain.surfaceElevation.length;
          octave += 1
     ) {
          const table = terrain.surfaceElevation[octave];
          const perm = table.permutations;
          const octaveWidth = 1.0 / octaveScale;
          let cachedBottom = -1;
          let valueX0Y0 = 0.0;
          let valueX0Y1 = 0.0;
          let valueX1Y0 = 0.0;
          let valueX1Y1 = 0.0;
          let index = 0;

          for (let x = 0; x < 16; x += 1) {
               let coordX =
                    (chunkX * 16 + x) * (0.0625 * octaveScale) + table.xo;
               const floorX = javaFloor(coordX);
               const xBottom = floorX & 0xff;
               coordX -= floorX;
               const fadeX = fade(coordX);

               for (let z = 0; z < 16; z += 1) {
                    let coordZ = (0.0 + 0) * (0.0625 * octaveScale) + table.zo;
                    const floorZ = javaFloor(coordZ);
                    const zBottom = floorZ & 0xff;
                    coordZ -= floorZ;
                    const fadeZ = fade(coordZ);

                    let coordY =
                         (chunkZ * 16 + z) * (0.0625 * octaveScale) + table.yo;
                    const floorY = javaFloor(coordY);
                    const yBottom = floorY & 0xff;
                    coordY -= floorY;
                    const fadeY = fade(coordY);

                    if (z === 0 || yBottom !== cachedBottom) {
                         cachedBottom = yBottom;
                         const k2 =
                              perm[(perm[xBottom & 0xff] + yBottom) & 0xff] +
                              zBottom;
                         const l2 =
                              perm[
                                   (perm[xBottom & 0xff] + yBottom + 1) & 0xff
                              ] + zBottom;
                         const k3 =
                              perm[
                                   (perm[(xBottom + 1) & 0xff] + yBottom) & 0xff
                              ] + zBottom;
                         const l3 =
                              perm[
                                   (perm[(xBottom + 1) & 0xff] + yBottom + 1) &
                                        0xff
                              ] + zBottom;

                         valueX0Y0 = lerp(
                              fadeX,
                              grad(perm[k2 & 0xff], coordX, coordY, coordZ),
                              grad(
                                   perm[k3 & 0xff],
                                   coordX - 1.0,
                                   coordY,
                                   coordZ,
                              ),
                         );
                         valueX0Y1 = lerp(
                              fadeX,
                              grad(
                                   perm[l2 & 0xff],
                                   coordX,
                                   coordY - 1.0,
                                   coordZ,
                              ),
                              grad(
                                   perm[l3 & 0xff],
                                   coordX - 1.0,
                                   coordY - 1.0,
                                   coordZ,
                              ),
                         );
                         valueX1Y0 = lerp(
                              fadeX,
                              grad(
                                   perm[(k2 + 1) & 0xff],
                                   coordX,
                                   coordY,
                                   coordZ - 1.0,
                              ),
                              grad(
                                   perm[(k3 + 1) & 0xff],
                                   coordX - 1.0,
                                   coordY,
                                   coordZ - 1.0,
                              ),
                         );
                         valueX1Y1 = lerp(
                              fadeX,
                              grad(
                                   perm[(l2 + 1) & 0xff],
                                   coordX,
                                   coordY - 1.0,
                                   coordZ - 1.0,
                              ),
                              grad(
                                   perm[(l3 + 1) & 0xff],
                                   coordX - 1.0,
                                   coordY - 1.0,
                                   coordZ - 1.0,
                              ),
                         );
                    }

                    const lerpY0 = lerp(fadeY, valueX0Y0, valueX0Y1);
                    const lerpY1 = lerp(fadeY, valueX1Y0, valueX1Y1);
                    heightField[index] +=
                         lerp(fadeZ, lerpY0, lerpY1) * octaveWidth;
                    index += 1;
               }
          }

          octaveScale /= 2.0;
     }

     return heightField;
}

export function generateFullGenReferenceHeights(seed, chunkX, chunkZ) {
     const climate = generateClimateReference(seed, chunkX, chunkZ);
     const terrain = initTerrainReference(seed);
     const noiseColumn = fillNoiseColumnReference(
          chunkX * 4,
          chunkZ * 4,
          climate,
          terrain,
     );
     const chunkCache = new Uint8Array(64 * 8);

     for (let x = 0; x < 4; x += 1) {
          let firstNoise00 = noiseColumn[x * 4];
          let firstNoise01 = noiseColumn[x * 4 + 2];
          let firstNoise10 = noiseColumn[x * 4 + 4];
          let firstNoise11 = noiseColumn[x * 4 + 6];
          const stepFirst00 = (noiseColumn[x * 4 + 1] - firstNoise00) * 0.125;
          const stepFirst01 = (noiseColumn[x * 4 + 3] - firstNoise01) * 0.125;
          const stepFirst10 = (noiseColumn[x * 4 + 5] - firstNoise10) * 0.125;
          const stepFirst11 = (noiseColumn[x * 4 + 7] - firstNoise11) * 0.125;

          for (let heightOffset = 0; heightOffset < 8; heightOffset += 1) {
               let secondNoise00 = firstNoise00;
               let secondNoise01 = firstNoise01;
               const stepSecond10 = (firstNoise10 - firstNoise00) * 0.25;
               const stepSecond11 = (firstNoise11 - firstNoise01) * 0.25;

               for (let xOffset = 0; xOffset < 4; xOffset += 1) {
                    let stoneLimit = secondNoise00;
                    const stepThird = (secondNoise01 - secondNoise00) * 0.25;

                    for (let zOffset = 0; zOffset < 4; zOffset += 1) {
                         const index =
                              (x << 7) |
                              (xOffset << 5) |
                              (zOffset << 3) |
                              heightOffset;
                         chunkCache[index] = stoneLimit > 0.0 ? 1 : 0;
                         stoneLimit += stepThird;
                    }

                    secondNoise00 += stepSecond10;
                    secondNoise01 += stepSecond11;
               }

               firstNoise00 += stepFirst00;
               firstNoise01 += stepFirst01;
               firstNoise10 += stepFirst10;
               firstNoise11 += stepFirst11;
          }
     }

     const heightField = generateHeightFieldReference(chunkX, chunkZ, terrain);
     const worldRandom = new JavaRandom(
          BigInt(chunkX) * 0x4f9939f508n + BigInt(chunkZ) * 0x1ef1565bd5n,
     );
     const heights = new Uint8Array(64);

     for (let x = 0; x < 16; x += 1) {
          for (let skipped = 0; skipped < 12; skipped += 1) {
               advance6(worldRandom);
               for (let iter = 0; iter < 128; iter += 1) {
                    worldRandom.nextInt(5);
               }
          }

          for (let z = 12; z < 16; z += 1) {
               advance4(worldRandom);
               const elevation = Math.trunc(
                    heightField[x + z * 16] / 3.0 +
                         3.0 +
                         worldRandom.nextDouble() * 0.25,
               );
               let state = -1;

               for (let y = 79; y >= 72; y -= 1) {
                    const cacheIndex =
                         (x << 5) | ((z - OFFSET_Z) << 3) | (y - 72);
                    const previousBlock = chunkCache[cacheIndex];
                    if (previousBlock === 0) {
                         state = -1;
                         continue;
                    }
                    if (previousBlock !== 1) {
                         continue;
                    }
                    if (state === -1) {
                         heights[x * 4 + (z - OFFSET_Z)] =
                              elevation <= 0 ? y : y + 1;
                         break;
                    }
               }

               for (let iter = 0; iter < 128; iter += 1) {
                    worldRandom.nextInt(5);
               }
          }
     }

     return heights;
}

export function generateHeightmapWindowReferenceHeights(seed, chunkX, chunkZ) {
     const climate = generateClimateReference(seed, chunkX, chunkZ);
     const terrain = initTerrainTables(seed);
     const surfaceNoise = new Float64Array(25);
     const depthNoise = new Float64Array(25);
     const mainNoise = new Float64Array(5 * 17 * 5);
     const minNoise = new Float64Array(5 * 17 * 5);
     const maxNoise = new Float64Array(5 * 17 * 5);

     generateFixedPerlinNoise(
          surfaceNoise,
          chunkX * 4,
          chunkZ * 4,
          5,
          5,
          1.121,
          1.121,
          terrain.scale,
     );
     generateFixedPerlinNoise(
          depthNoise,
          chunkX * 4,
          chunkZ * 4,
          5,
          5,
          200.0,
          200.0,
          terrain.depth,
     );
     generateNormalPerlinNoise(
          mainNoise,
          chunkX * 4,
          0,
          chunkZ * 4,
          5,
          17,
          5,
          MAIN_NOISE_SCALE / 80.0,
          MAIN_NOISE_SCALE / 160.0,
          MAIN_NOISE_SCALE / 80.0,
          terrain.mainLimit,
     );
     generateNormalPerlinNoise(
          minNoise,
          chunkX * 4,
          0,
          chunkZ * 4,
          5,
          17,
          5,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          terrain.minLimit,
     );
     generateNormalPerlinNoise(
          maxNoise,
          chunkX * 4,
          0,
          chunkZ * 4,
          5,
          17,
          5,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          terrain.maxLimit,
     );

     const densityField = new Float64Array(5 * 17 * 5);

     for (let x = 0; x < 5; x += 1) {
          for (let z = 0; z < 5; z += 1) {
               const coarseIndex = x * 5 + z;
               const climateIndex = x * 3 * 16 + z * 3 + 17;

               let aridity =
                    1.0 -
                    climate.humidity[climateIndex] *
                         climate.temperature[climateIndex];
               aridity *= aridity;
               aridity *= aridity;
               aridity = 1.0 - aridity;

               let surface =
                    (surfaceNoise[coarseIndex] / 512.0 + 0.5) * aridity;
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

                    const index = (x * 5 + z) * 17 + y;
                    const lower = minNoise[index] / 512.0;
                    const upper = maxNoise[index] / 512.0;
                    const blend = (mainNoise[index] / 10.0 + 1.0) / 2.0;

                    let density;
                    if (blend < 0.0) {
                         density = lower;
                    } else if (blend > 1.0) {
                         density = upper;
                    } else {
                         density = lower + (upper - lower) * blend;
                    }

                    density -= reduction;

                    if (y > 13) {
                         const fadeTop = (y - 13) / 3.0;
                         density = density * (1.0 - fadeTop) + -10.0 * fadeTop;
                    }

                    densityField[index] = density;
               }
          }
     }

     const blocks = new Uint8Array(16 * 16 * 128);

     for (let cellX = 0; cellX < 4; cellX += 1) {
          for (let cellZ = 0; cellZ < 4; cellZ += 1) {
               for (let cellY = 0; cellY < 16; cellY += 1) {
                    let density00 =
                         densityField[(cellX * 5 + cellZ) * 17 + cellY];
                    let density01 =
                         densityField[(cellX * 5 + cellZ + 1) * 17 + cellY];
                    let density10 =
                         densityField[((cellX + 1) * 5 + cellZ) * 17 + cellY];
                    let density11 =
                         densityField[
                              ((cellX + 1) * 5 + cellZ + 1) * 17 + cellY
                         ];
                    const densityStep00 =
                         (densityField[(cellX * 5 + cellZ) * 17 + cellY + 1] -
                              density00) *
                         0.125;
                    const densityStep01 =
                         (densityField[
                              (cellX * 5 + cellZ + 1) * 17 + cellY + 1
                         ] -
                              density01) *
                         0.125;
                    const densityStep10 =
                         (densityField[
                              ((cellX + 1) * 5 + cellZ) * 17 + cellY + 1
                         ] -
                              density10) *
                         0.125;
                    const densityStep11 =
                         (densityField[
                              ((cellX + 1) * 5 + cellZ + 1) * 17 + cellY + 1
                         ] -
                              density11) *
                         0.125;

                    for (let yOffset = 0; yOffset < 8; yOffset += 1) {
                         let densityX0 = density00;
                         let densityX1 = density01;
                         const densityXStep0 = (density10 - density00) * 0.25;
                         const densityXStep1 = (density11 - density01) * 0.25;

                         for (let xOffset = 0; xOffset < 4; xOffset += 1) {
                              let density = densityX0;
                              const densityZStep =
                                   (densityX1 - densityX0) * 0.25;
                              const worldX = cellX * 4 + xOffset;

                              for (let zOffset = 0; zOffset < 4; zOffset += 1) {
                                   const worldY = cellY * 8 + yOffset;
                                   const worldZ = cellZ * 4 + zOffset;
                                   const blockIndex =
                                        (worldX * 16 + worldZ) * 128 + worldY;

                                   if (density > 0.0) {
                                        blocks[blockIndex] = 1;
                                   } else if (worldY < 64) {
                                        const climateIndex =
                                             worldX * 16 + worldZ;
                                        blocks[blockIndex] =
                                             worldY === 63 &&
                                             climate.temperature[climateIndex] <
                                                  0.5
                                                  ? 79
                                                  : 9;
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

     const sandFields = new Float64Array(256);
     const gravelField = new Float64Array(256);
     const heightField = new Float64Array(256);
     const random = new JavaRandom(
          BigInt.asIntN(
               64,
               BigInt(chunkX) * 341873128712n + BigInt(chunkZ) * 132897987541n,
          ),
     );

     generateNormalPerlinNoise(
          sandFields,
          chunkX * 16,
          chunkZ * 16,
          0.0,
          16,
          16,
          1,
          0.03125,
          0.03125,
          1.0,
          terrain.shoreBottomComposition,
     );
     generateFixedPerlinNoise(
          gravelField,
          chunkZ * 16,
          chunkX * 16,
          16,
          16,
          0.03125,
          0.03125,
          terrain.shoreBottomComposition,
     );
     generateNormalPerlinNoise(
          heightField,
          chunkX * 16,
          chunkZ * 16,
          0.0,
          16,
          16,
          1,
          0.0625,
          0.0625,
          0.0625,
          terrain.surfaceElevation,
     );

     const heights = new Uint8Array(64);

     for (let x = 0; x < 16; x += 1) {
          for (let skipped = 0; skipped < 12; skipped += 1) {
               random.nextDouble();
               random.nextDouble();
               random.nextDouble();
               for (let iter = 0; iter < 128; iter += 1) {
                    random.nextInt(5);
               }
          }

          for (let z = 12; z < 16; z += 1) {
               const noiseIndex = x + z * 16;
               const sandy =
                    sandFields[noiseIndex] + random.nextDouble() * 0.2 > 0.0;
               const gravelly =
                    gravelField[noiseIndex] + random.nextDouble() * 0.2 > 3.0;
               const elevation = Math.trunc(
                    heightField[noiseIndex] / 3.0 +
                         3.0 +
                         random.nextDouble() * 0.25,
               );

               let state = -1;
               let topBlock = 2;
               let fillerBlock = 3;

               for (let y = 127; y >= 64; y -= 1) {
                    const blockIndex = (x * 16 + z) * 128 + y;
                    const previousBlock = blocks[blockIndex];

                    if (previousBlock === 0) {
                         state = -1;
                         continue;
                    }
                    if (previousBlock !== 1) {
                         continue;
                    }

                    if (state === -1) {
                         if (elevation <= 0) {
                              topBlock = 0;
                              fillerBlock = 1;
                         } else if (y <= 65) {
                              topBlock = 2;
                              fillerBlock = 3;
                              if (gravelly) {
                                   topBlock = 0;
                                   fillerBlock = 13;
                              }
                              if (sandy) {
                                   topBlock = 12;
                                   fillerBlock = 12;
                              }
                         }

                         state = elevation;
                         blocks[blockIndex] = topBlock;
                         continue;
                    }

                    if (state > 0) {
                         state -= 1;
                         blocks[blockIndex] = fillerBlock;
                    }
               }

               let topY = 127;
               while (topY >= 0 && blocks[(x * 16 + z) * 128 + topY] === 0) {
                    topY -= 1;
               }
               heights[x * 4 + (z - OFFSET_Z)] = topY + 1;

               for (let iter = 0; iter < 128; iter += 1) {
                    random.nextInt(5);
               }
          }
     }

     return heights;
}

function buildBiomeIdsFromClimate(climate) {
     const biomes = new Uint8Array(256);

     for (let index = 0; index < 256; index += 1) {
          const temperature = climate.temperature[index];
          const rainfall = climate.humidity[index];
          const adjustedRainfall = temperature * rainfall;

          let biome;
          if (temperature < 0.1) {
               biome = 10;
          } else if (adjustedRainfall < 0.2) {
               if (temperature < 0.5) {
                    biome = 10;
               } else if (temperature < 0.95) {
                    biome = 4;
               } else {
                    biome = 7;
               }
          } else if (adjustedRainfall > 0.5 && temperature < 0.7) {
               biome = 1;
          } else if (temperature < 0.5) {
               biome = 6;
          } else if (temperature < 0.97) {
               biome = adjustedRainfall < 0.35 ? 5 : 3;
          } else if (adjustedRainfall < 0.45) {
               biome = 8;
          } else if (adjustedRainfall < 0.9) {
               biome = 2;
          } else {
               biome = 0;
          }

          biomes[index] = biome;
     }

     return biomes;
}

function getSurfaceForBiomeId(biomeId) {
     if (biomeId === 7 || biomeId === 9) {
          return { top: 12, fill: 12 };
     }

     return { top: 2, fill: 3 };
}

function buildHeightmapFromBlocks(blocks) {
     const heightmap = new Int16Array(256);

     for (let x = 0; x < 16; x += 1) {
          for (let z = 0; z < 16; z += 1) {
               let y = 127;
               while (y >= 0 && blocks[(x * 16 + z) * 128 + y] === 0) {
                    y -= 1;
               }
               heightmap[x * 16 + z] = y + 1;
          }
     }

     return heightmap;
}

export function generateChunkReference(seed, chunkX, chunkZ) {
     const climate = generateClimateReference(seed, chunkX, chunkZ);
     const biomes = buildBiomeIdsFromClimate(climate);
     const terrain = initTerrainTables(seed);
     const surfaceNoise = new Float64Array(25);
     const depthNoise = new Float64Array(25);
     const mainNoise = new Float64Array(5 * 17 * 5);
     const minNoise = new Float64Array(5 * 17 * 5);
     const maxNoise = new Float64Array(5 * 17 * 5);
     const densityField = new Float64Array(5 * 17 * 5);

     generateFixedPerlinNoise(
          surfaceNoise,
          chunkX * 4,
          chunkZ * 4,
          5,
          5,
          1.121,
          1.121,
          terrain.scale,
     );
     generateFixedPerlinNoise(
          depthNoise,
          chunkX * 4,
          chunkZ * 4,
          5,
          5,
          200.0,
          200.0,
          terrain.depth,
     );
     generateNormalPerlinNoise(
          mainNoise,
          chunkX * 4,
          0,
          chunkZ * 4,
          5,
          17,
          5,
          MAIN_NOISE_SCALE / 80.0,
          MAIN_NOISE_SCALE / 160.0,
          MAIN_NOISE_SCALE / 80.0,
          terrain.mainLimit,
     );
     generateNormalPerlinNoise(
          minNoise,
          chunkX * 4,
          0,
          chunkZ * 4,
          5,
          17,
          5,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          terrain.minLimit,
     );
     generateNormalPerlinNoise(
          maxNoise,
          chunkX * 4,
          0,
          chunkZ * 4,
          5,
          17,
          5,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          MAIN_NOISE_SCALE,
          terrain.maxLimit,
     );

     for (let x = 0; x < 5; x += 1) {
          for (let z = 0; z < 5; z += 1) {
               const coarseIndex = x * 5 + z;
               const climateIndex = x * 3 * 16 + z * 3 + 17;

               let aridity =
                    1.0 -
                    climate.humidity[climateIndex] *
                         climate.temperature[climateIndex];
               aridity *= aridity;
               aridity *= aridity;
               aridity = 1.0 - aridity;

               let surface =
                    (surfaceNoise[coarseIndex] / 512.0 + 0.5) * aridity;
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

                    const index = (x * 5 + z) * 17 + y;
                    const lower = minNoise[index] / 512.0;
                    const upper = maxNoise[index] / 512.0;
                    const blend = (mainNoise[index] / 10.0 + 1.0) / 2.0;

                    let density;
                    if (blend < 0.0) {
                         density = lower;
                    } else if (blend > 1.0) {
                         density = upper;
                    } else {
                         density = lower + (upper - lower) * blend;
                    }

                    density -= reduction;

                    if (y > 13) {
                         const fadeTop = (y - 13) / 3.0;
                         density = density * (1.0 - fadeTop) + -10.0 * fadeTop;
                    }

                    densityField[index] = density;
               }
          }
     }

     const blocks = new Uint16Array(16 * 16 * 128);

     for (let cellX = 0; cellX < 4; cellX += 1) {
          for (let cellZ = 0; cellZ < 4; cellZ += 1) {
               for (let cellY = 0; cellY < 16; cellY += 1) {
                    let density00 =
                         densityField[(cellX * 5 + cellZ) * 17 + cellY];
                    let density01 =
                         densityField[(cellX * 5 + cellZ + 1) * 17 + cellY];
                    let density10 =
                         densityField[((cellX + 1) * 5 + cellZ) * 17 + cellY];
                    let density11 =
                         densityField[
                              ((cellX + 1) * 5 + cellZ + 1) * 17 + cellY
                         ];
                    const densityStep00 =
                         (densityField[(cellX * 5 + cellZ) * 17 + cellY + 1] -
                              density00) *
                         0.125;
                    const densityStep01 =
                         (densityField[
                              (cellX * 5 + cellZ + 1) * 17 + cellY + 1
                         ] -
                              density01) *
                         0.125;
                    const densityStep10 =
                         (densityField[
                              ((cellX + 1) * 5 + cellZ) * 17 + cellY + 1
                         ] -
                              density10) *
                         0.125;
                    const densityStep11 =
                         (densityField[
                              ((cellX + 1) * 5 + cellZ + 1) * 17 + cellY + 1
                         ] -
                              density11) *
                         0.125;

                    for (let yOffset = 0; yOffset < 8; yOffset += 1) {
                         let densityX0 = density00;
                         let densityX1 = density01;
                         const densityXStep0 = (density10 - density00) * 0.25;
                         const densityXStep1 = (density11 - density01) * 0.25;

                         for (let xOffset = 0; xOffset < 4; xOffset += 1) {
                              let density = densityX0;
                              const densityZStep =
                                   (densityX1 - densityX0) * 0.25;
                              const worldX = cellX * 4 + xOffset;

                              for (let zOffset = 0; zOffset < 4; zOffset += 1) {
                                   const worldY = cellY * 8 + yOffset;
                                   const worldZ = cellZ * 4 + zOffset;
                                   const blockIndex =
                                        (worldX * 16 + worldZ) * 128 + worldY;
                                   const climateIndex = worldX * 16 + worldZ;

                                   if (density > 0.0) {
                                        blocks[blockIndex] = 1;
                                   } else if (worldY < 64) {
                                        blocks[blockIndex] =
                                             worldY === 63 &&
                                             climate.temperature[climateIndex] <
                                                  0.5
                                                  ? 79
                                                  : 9;
                                   } else {
                                        blocks[blockIndex] = 0;
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

     const sandFields = new Float64Array(256);
     const gravelField = new Float64Array(256);
     const heightField = new Float64Array(256);
     const surfaceRandom = new JavaRandom(
          BigInt.asIntN(
               64,
               BigInt(chunkX) * 341873128712n + BigInt(chunkZ) * 132897987541n,
          ),
     );

     generateNormalPerlinNoise(
          sandFields,
          chunkX * 16,
          chunkZ * 16,
          0.0,
          16,
          16,
          1,
          0.03125,
          0.03125,
          1.0,
          terrain.shoreBottomComposition,
     );
     generateFixedPerlinNoise(
          gravelField,
          chunkZ * 16,
          chunkX * 16,
          16,
          16,
          0.03125,
          0.03125,
          terrain.shoreBottomComposition,
     );
     generateNormalPerlinNoise(
          heightField,
          chunkX * 16,
          chunkZ * 16,
          0.0,
          16,
          16,
          1,
          0.0625,
          0.0625,
          0.0625,
          terrain.surfaceElevation,
     );

     for (let x = 0; x < 16; x += 1) {
          for (let z = 0; z < 16; z += 1) {
               const columnIndex = x * 16 + z;
               const noiseIndex = x + z * 16;
               const surface = getSurfaceForBiomeId(biomes[columnIndex]);
               const sandy =
                    sandFields[noiseIndex] + surfaceRandom.nextDouble() * 0.2 >
                    0.0;
               const gravelly =
                    gravelField[noiseIndex] + surfaceRandom.nextDouble() * 0.2 >
                    3.0;
               const elevation = Math.trunc(
                    heightField[noiseIndex] / 3.0 +
                         3.0 +
                         surfaceRandom.nextDouble() * 0.25,
               );

               let remainingDepth = -1;
               let topBlock = surface.top;
               let fillerBlock = surface.fill;

               for (let y = 127; y >= 0; y -= 1) {
                    const blockIndex = (x * 16 + z) * 128 + y;

                    if (y <= surfaceRandom.nextInt(5)) {
                         blocks[blockIndex] = 7;
                         continue;
                    }

                    const existing = blocks[blockIndex];
                    if (existing === 0) {
                         remainingDepth = -1;
                         continue;
                    }
                    if (existing !== 1) {
                         continue;
                    }

                    if (remainingDepth === -1) {
                         if (elevation <= 0) {
                              topBlock = 0;
                              fillerBlock = 1;
                         } else if (y >= 60 && y <= 65) {
                              topBlock = surface.top;
                              fillerBlock = surface.fill;

                              if (gravelly) {
                                   topBlock = 0;
                                   fillerBlock = 13;
                              }
                              if (sandy) {
                                   topBlock = 12;
                                   fillerBlock = 12;
                              }
                         }

                         if (y < 64 && topBlock === 0) {
                              topBlock =
                                   climate.temperature[columnIndex] < 0.5
                                        ? 79
                                        : 9;
                         }

                         remainingDepth = elevation;
                         blocks[blockIndex] = y >= 63 ? topBlock : fillerBlock;
                         continue;
                    }

                    if (remainingDepth > 0) {
                         remainingDepth -= 1;
                         blocks[blockIndex] = fillerBlock;

                         if (remainingDepth === 0 && fillerBlock === 12) {
                              remainingDepth = surfaceRandom.nextInt(4);
                              fillerBlock = 24;
                         }
                    }
               }
          }
     }

     return {
          chunkX,
          chunkZ,
          blocks,
          densityField,
          biomes,
          temperature: climate.temperature,
          rainfall: climate.humidity,
          humidity: climate.humidity,
          heightmap: buildHeightmapFromBlocks(blocks),
     };
}

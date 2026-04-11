import { JavaRandom, toJavaLong } from "../random/java.js";

export function getMapGenSeeds(seed) {
  const random = new JavaRandom(toJavaLong(seed));
  const xSeed = BigInt.asIntN(64, random.nextLong() | 1n);
  const zSeed = BigInt.asIntN(64, random.nextLong() | 1n);
  return { xSeed, zSeed };
}

export function getPopulationChunkSeed(seed, chunkX, chunkZ, salt = 0n) {
  const { xSeed, zSeed } = getMapGenSeeds(seed);
  const seed64 = toJavaLong(seed);
  return BigInt.asIntN(
    64,
    ((BigInt(chunkX) * xSeed + BigInt(chunkZ) * zSeed) ^ seed64) + salt,
  );
}

export function getPopulationRandom(seed, chunkX, chunkZ, salt = 0n) {
  return new JavaRandom(getPopulationChunkSeed(seed, chunkX, chunkZ, salt));
}

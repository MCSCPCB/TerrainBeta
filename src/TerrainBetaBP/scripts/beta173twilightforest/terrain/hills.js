import { JavaRandom, toJavaLong } from "../../beta173/random/java.js";

export function hillSize(chunkX, chunkZ, seed = 0n) {
  const hillRandom = new JavaRandom(
    BigInt.asIntN(64, toJavaLong(seed) + BigInt(chunkX * 25117 + chunkZ * 151121)),
  );
  const hillNoise = hillRandom.nextInt();
  let size = -1;

  if (
    (chunkX % 7 === 4 || chunkX % 7 === -4)
    && (chunkZ % 7 === 4 || chunkZ % 7 === -4)
  ) {
    size = Math.abs(hillNoise % 6);
    if (size === 0 || size > 3) {
      size = -1;
    }
  }

  return size;
}

export function isHollowHill(chunkX, chunkZ, seed = 0n) {
  return hillSize(chunkX, chunkZ, seed) > 0;
}

export function nearHollowHill(chunkX, chunkZ, seed = 0n) {
  for (let radius = 1; radius <= 3; radius += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
        if (hillSize(chunkX + offsetX, chunkZ + offsetZ, seed) === radius) {
          return true;
        }
      }
    }
  }

  return false;
}

export function nearestHillCenter(chunkX, chunkZ, seed = 0n) {
  for (let radius = 1; radius <= 3; radius += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
        if (hillSize(chunkX + offsetX, chunkZ + offsetZ, seed) === radius) {
          return {
            x: offsetX * 16 + 8,
            z: offsetZ * 16 + 8,
          };
        }
      }
    }
  }

  return { x: 0, z: 0 };
}

export function nearestHillSize(chunkX, chunkZ, seed = 0n) {
  for (let radius = 1; radius <= 3; radius += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
        if (hillSize(chunkX + offsetX, chunkZ + offsetZ, seed) === radius) {
          return radius;
        }
      }
    }
  }

  return -1;
}

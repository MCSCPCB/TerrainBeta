export function grad2(hash, x, z) {
  const masked = hash & 15;
  const first = (1 - ((masked & 8) >> 3)) * x;
  const second = masked < 4 ? 0.0 : (masked !== 12 && masked !== 14 ? z : x);
  return ((masked & 1) === 0 ? first : -first) + ((masked & 2) === 0 ? second : -second);
}

export function grad3(hash, x, y, z) {
  const masked = hash & 15;
  const first = masked < 8 ? x : y;
  const second = masked < 4 ? y : (masked !== 12 && masked !== 14 ? z : x);
  return ((masked & 1) === 0 ? first : -first) + ((masked & 2) === 0 ? second : -second);
}

export function createPermutation(random) {
  const offsets = [
    random.nextDouble() * 256.0,
    random.nextDouble() * 256.0,
    random.nextDouble() * 256.0,
  ];
  const perm = new Uint8Array(512);

  for (let index = 0; index < 256; index += 1) {
    perm[index] = index;
  }

  for (let index = 0; index < 256; index += 1) {
    const randomIndex = random.nextInt(256 - index) + index;
    const swap = perm[index];
    perm[index] = perm[randomIndex];
    perm[randomIndex] = swap;
    perm[index + 256] = perm[index];
  }

  return { offsets, perm };
}

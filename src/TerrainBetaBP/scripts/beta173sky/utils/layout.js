export function chunkBlockIndex(x, y, z) {
  return ((x * 16 + z) * 128) + y;
}

export function layerIndex(x, z, stride = 16) {
  return x * stride + z;
}

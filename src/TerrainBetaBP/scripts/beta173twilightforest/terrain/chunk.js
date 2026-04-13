import { BLOCKS } from "../biome/index.js";
import { chunkBlockIndex, layerIndex } from "../../beta173/utils/layout.js";

export function validateChunkCoordinate(value, name) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
}

export function buildHeightmapColumns(blocks, heightmap, startX = 0, columnCount = 16) {
  const endX = Math.min(16, startX + columnCount);

  for (let x = startX; x < endX; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      const columnIndex = layerIndex(x, z);
      let y = 127;

      while (y >= 0 && blocks[chunkBlockIndex(x, y, z)] === BLOCKS.AIR) {
        y -= 1;
      }

      heightmap[columnIndex] = y + 1;
    }
  }
}

export function buildHeightmap(blocks) {
  const heightmap = new Int16Array(256);
  buildHeightmapColumns(blocks, heightmap);
  return heightmap;
}

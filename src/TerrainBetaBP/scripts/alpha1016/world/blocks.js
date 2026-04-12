import { BLOCKS } from "../constants.js";

export const EXTRA_BLOCKS = Object.freeze({
  COBBLESTONE: 4,
  FLOWING_WATER: 8,
  FLOWING_LAVA: 10,
  LAVA: 11,
  GOLD_ORE: 14,
  IRON_ORE: 15,
  COAL_ORE: 16,
  OAK_LOG: 17,
  OAK_LEAVES: 18,
  YELLOW_FLOWER: 37,
  RED_FLOWER: 38,
  BROWN_MUSHROOM: 39,
  RED_MUSHROOM: 40,
  MOSSY_COBBLESTONE: 48,
  MOB_SPAWNER: 52,
  CHEST: 54,
  DIAMOND_ORE: 56,
  REDSTONE_ORE: 73,
  CACTUS: 81,
  CLAY: 82,
  REEDS: 83,
  SNOW_LAYER: 205,
});

export const BLOCK_ROLE_IDS = Object.freeze({
  ...BLOCKS,
  ...EXTRA_BLOCKS,
});

export const BEDROCK_BLOCK_MAP = Object.freeze({
  [BLOCKS.AIR]: "minecraft:air",
  [BLOCKS.STONE]: "minecraft:stone",
  [BLOCKS.GRASS]: "minecraft:grass_block",
  [BLOCKS.DIRT]: "minecraft:dirt",
  [EXTRA_BLOCKS.COBBLESTONE]: "minecraft:cobblestone",
  [BLOCKS.BEDROCK]: "minecraft:bedrock",
  [EXTRA_BLOCKS.FLOWING_WATER]: "minecraft:flowing_water",
  [BLOCKS.WATER]: "minecraft:water",
  [EXTRA_BLOCKS.FLOWING_LAVA]: "minecraft:flowing_lava",
  [EXTRA_BLOCKS.LAVA]: "minecraft:lava",
  [BLOCKS.SAND]: "minecraft:sand",
  [BLOCKS.GRAVEL]: "minecraft:gravel",
  [BLOCKS.SANDSTONE]: "minecraft:sandstone",
  [EXTRA_BLOCKS.GOLD_ORE]: "minecraft:gold_ore",
  [EXTRA_BLOCKS.IRON_ORE]: "minecraft:iron_ore",
  [EXTRA_BLOCKS.COAL_ORE]: "minecraft:coal_ore",
  [EXTRA_BLOCKS.OAK_LOG]: "minecraft:oak_log",
  [EXTRA_BLOCKS.OAK_LEAVES]: "minecraft:oak_leaves",
  [EXTRA_BLOCKS.YELLOW_FLOWER]: "minecraft:yellow_flower",
  [EXTRA_BLOCKS.RED_FLOWER]: "minecraft:red_flower",
  [EXTRA_BLOCKS.BROWN_MUSHROOM]: "minecraft:brown_mushroom",
  [EXTRA_BLOCKS.RED_MUSHROOM]: "minecraft:red_mushroom",
  [EXTRA_BLOCKS.MOSSY_COBBLESTONE]: "minecraft:mossy_cobblestone",
  [EXTRA_BLOCKS.MOB_SPAWNER]: "minecraft:mob_spawner",
  [EXTRA_BLOCKS.CHEST]: "minecraft:chest",
  [EXTRA_BLOCKS.DIAMOND_ORE]: "minecraft:diamond_ore",
  [EXTRA_BLOCKS.REDSTONE_ORE]: "minecraft:redstone_ore",
  [EXTRA_BLOCKS.CACTUS]: "minecraft:cactus",
  [EXTRA_BLOCKS.CLAY]: "minecraft:clay",
  [EXTRA_BLOCKS.REEDS]: "minecraft:reeds",
  [BLOCKS.ICE]: "minecraft:ice",
  [EXTRA_BLOCKS.SNOW_LAYER]: "minecraft:snow_layer",
});

export const DEFAULT_BLOCK_PALETTE = Object.freeze(
  Object.fromEntries(
    Object.entries(BLOCK_ROLE_IDS)
      .filter(([, blockId]) => BEDROCK_BLOCK_MAP[blockId] !== undefined)
      .map(([roleName, blockId]) => [roleName, BEDROCK_BLOCK_MAP[blockId]]),
  ),
);

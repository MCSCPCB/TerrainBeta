import { EXTRA_BLOCKS as BASE_EXTRA_BLOCKS } from "../../beta173/world/blocks.js";
import { BLOCKS } from "../biome/index.js";

export const EXTRA_BLOCKS = Object.freeze({
  ...BASE_EXTRA_BLOCKS,
  OAK_PLANKS: 206,
  OAK_FENCE: 207,
  OAK_SLAB: 208,
  OBSIDIAN: 209,
  TORCH: 210,
  FIRE: 211,
  NETHERRACK: 212,
  GLOWSTONE: 213,
  LADDER: 214,
  LAPIS_BLOCK: 215,
});

export const BLOCK_ROLE_IDS = Object.freeze({
  ...BLOCKS,
  ...EXTRA_BLOCKS,
});

export const BEDROCK_BLOCK_MAP = Object.freeze({
  [EXTRA_BLOCKS.FLOWING_WATER]: "minecraft:flowing_water",
  [BLOCKS.AIR]: "minecraft:air",
  [EXTRA_BLOCKS.COBBLESTONE]: "minecraft:cobblestone",
  [BLOCKS.STONE]: "minecraft:stone",
  [BLOCKS.GRASS]: "minecraft:grass_block",
  [BLOCKS.DIRT]: "minecraft:dirt",
  [BLOCKS.BEDROCK]: "minecraft:bedrock",
  [BLOCKS.WATER]: "minecraft:water",
  [BLOCKS.SAND]: "minecraft:sand",
  [BLOCKS.GRAVEL]: "minecraft:gravel",
  [BLOCKS.SANDSTONE]: "minecraft:sandstone",
  [BLOCKS.ICE]: "minecraft:ice",
  [EXTRA_BLOCKS.GOLD_ORE]: "minecraft:gold_ore",
  [EXTRA_BLOCKS.IRON_ORE]: "minecraft:iron_ore",
  [EXTRA_BLOCKS.COAL_ORE]: "minecraft:coal_ore",
  [EXTRA_BLOCKS.REDSTONE_ORE]: "minecraft:redstone_ore",
  [EXTRA_BLOCKS.DIAMOND_ORE]: "minecraft:diamond_ore",
  [EXTRA_BLOCKS.LAPIS_ORE]: "minecraft:lapis_ore",
  [EXTRA_BLOCKS.OAK_LOG]: "minecraft:oak_log",
  [EXTRA_BLOCKS.OAK_LEAVES]: "minecraft:oak_leaves",
  [EXTRA_BLOCKS.BIRCH_LOG]: "minecraft:birch_log",
  [EXTRA_BLOCKS.BIRCH_LEAVES]: "minecraft:birch_leaves",
  [EXTRA_BLOCKS.SPRUCE_LOG]: "minecraft:spruce_log",
  [EXTRA_BLOCKS.SPRUCE_LEAVES]: "minecraft:spruce_leaves",
  [EXTRA_BLOCKS.TALL_GRASS]: "minecraft:tallgrass",
  [EXTRA_BLOCKS.YELLOW_FLOWER]: "minecraft:yellow_flower",
  [EXTRA_BLOCKS.RED_FLOWER]: "minecraft:red_flower",
  [EXTRA_BLOCKS.BROWN_MUSHROOM]: "minecraft:brown_mushroom",
  [EXTRA_BLOCKS.RED_MUSHROOM]: "minecraft:red_mushroom",
  [EXTRA_BLOCKS.FLOWING_LAVA]: "minecraft:flowing_lava",
  [EXTRA_BLOCKS.LAVA]: "minecraft:lava",
  [EXTRA_BLOCKS.MOSSY_COBBLESTONE]: "minecraft:mossy_cobblestone",
  [EXTRA_BLOCKS.MOB_SPAWNER]: "minecraft:mob_spawner",
  [EXTRA_BLOCKS.CHEST]: "minecraft:chest",
  [EXTRA_BLOCKS.PUMPKIN]: "minecraft:pumpkin",
  [EXTRA_BLOCKS.REEDS]: "minecraft:reeds",
  [EXTRA_BLOCKS.SNOW_LAYER]: "minecraft:snow_layer",
  [EXTRA_BLOCKS.OAK_PLANKS]: "minecraft:planks",
  [EXTRA_BLOCKS.OAK_FENCE]: "minecraft:fence",
  [EXTRA_BLOCKS.OAK_SLAB]: "minecraft:wooden_slab",
  [EXTRA_BLOCKS.OBSIDIAN]: "minecraft:obsidian",
  [EXTRA_BLOCKS.TORCH]: "minecraft:torch",
  [EXTRA_BLOCKS.FIRE]: "minecraft:fire",
  [EXTRA_BLOCKS.NETHERRACK]: "minecraft:netherrack",
  [EXTRA_BLOCKS.GLOWSTONE]: "minecraft:glowstone",
  [EXTRA_BLOCKS.LADDER]: "minecraft:ladder",
  [EXTRA_BLOCKS.LAPIS_BLOCK]: "minecraft:lapis_block",
});

export const DEFAULT_BLOCK_PALETTE = Object.freeze(
  Object.fromEntries(
    Object.entries(BLOCK_ROLE_IDS)
      .filter(([, blockId]) => BEDROCK_BLOCK_MAP[blockId] !== undefined)
      .map(([roleName, blockId]) => [roleName, BEDROCK_BLOCK_MAP[blockId]]),
  ),
);

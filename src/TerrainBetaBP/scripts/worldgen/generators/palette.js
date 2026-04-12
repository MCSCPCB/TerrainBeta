function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveBlockPalette(generatorId, defaultBlockPalette, blockRoleIds, overrides = {}) {
  if (!isPlainObject(overrides)) {
    throw new Error(`${generatorId}.blockPalette must be an object.`);
  }

  const resolvedPalette = {
    ...defaultBlockPalette,
  };

  for (const [roleName, blockTypeId] of Object.entries(overrides)) {
    if (blockRoleIds[roleName] === undefined) {
      throw new Error(`${generatorId}.blockPalette.${roleName} is not a supported block role.`);
    }
    if (typeof blockTypeId !== "string" || blockTypeId.length === 0) {
      throw new Error(`${generatorId}.blockPalette.${roleName} must be a non-empty Bedrock block type id.`);
    }
    resolvedPalette[roleName] = blockTypeId;
  }

  return Object.freeze(resolvedPalette);
}

function createBlockTypeMap(blockRoleIds, blockPalette) {
  const blockTypeMap = {};

  for (const [roleName, blockTypeId] of Object.entries(blockPalette)) {
    const logicalBlockId = blockRoleIds[roleName];
    if (logicalBlockId !== undefined) {
      blockTypeMap[logicalBlockId] = blockTypeId;
    }
  }

  return Object.freeze(blockTypeMap);
}

function resolveSurfaceMaterialReference(generatorId, label, value, blockRoleIds, blockPalette) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${generatorId}.${label} must be a non-empty block role or configured Bedrock block type id.`);
  }

  if (blockRoleIds[value] !== undefined) {
    return blockRoleIds[value];
  }

  const matchingRoles = Object.entries(blockPalette)
    .filter(([, blockTypeId]) => blockTypeId === value)
    .map(([roleName]) => roleName);

  if (matchingRoles.length === 1) {
    return blockRoleIds[matchingRoles[0]];
  }

  if (matchingRoles.length > 1) {
    throw new Error(`${generatorId}.${label} references '${value}', which matches multiple block roles: ${matchingRoles.join(", ")}. Use a block role name instead.`);
  }

  throw new Error(`${generatorId}.${label} references '${value}', which is neither a supported block role nor a configured Bedrock block type id.`);
}

function resolveSurfacePalette(
  generatorId,
  biomeIds,
  defaultSurfaceConfig,
  blockRoleIds,
  blockPalette,
  overrides = {},
) {
  if (!isPlainObject(overrides)) {
    throw new Error(`${generatorId}.surfacePalette must be an object.`);
  }

  for (const biomeName of Object.keys(overrides)) {
    if (biomeIds[biomeName] === undefined) {
      throw new Error(`${generatorId}.surfacePalette.${biomeName} is not a supported biome.`);
    }
  }

  const resolvedPalette = [];
  for (const [biomeName, biomeId] of Object.entries(biomeIds)) {
    const defaultSurface = defaultSurfaceConfig[biomeName];
    if (!defaultSurface) {
      continue;
    }

    const overrideSurface = overrides[biomeName] ?? {};
    if (!isPlainObject(overrideSurface)) {
      throw new Error(`${generatorId}.surfacePalette.${biomeName} must be an object.`);
    }

    const top = resolveSurfaceMaterialReference(
      generatorId,
      `surfacePalette.${biomeName}.top`,
      overrideSurface.top ?? defaultSurface.top,
      blockRoleIds,
      blockPalette,
    );
    const fill = resolveSurfaceMaterialReference(
      generatorId,
      `surfacePalette.${biomeName}.fill`,
      overrideSurface.fill ?? defaultSurface.fill,
      blockRoleIds,
      blockPalette,
    );

    resolvedPalette[biomeId] = Object.freeze({ top, fill });
  }

  return Object.freeze(resolvedPalette);
}

export function createGeneratorPalette({
  generatorId,
  biomeIds,
  defaultBlockPalette,
  blockRoleIds,
  defaultSurfaceConfig,
  blockPaletteOverrides = {},
  surfacePaletteOverrides = {},
}) {
  const blockPalette = resolveBlockPalette(
    generatorId,
    defaultBlockPalette,
    blockRoleIds,
    blockPaletteOverrides,
  );
  const blockTypeMap = createBlockTypeMap(blockRoleIds, blockPalette);
  const surfacePalette = resolveSurfacePalette(
    generatorId,
    biomeIds,
    defaultSurfaceConfig,
    blockRoleIds,
    blockPalette,
    surfacePaletteOverrides,
  );

  return Object.freeze({
    blockPalette,
    blockTypeMap,
    surfacePalette,
  });
}

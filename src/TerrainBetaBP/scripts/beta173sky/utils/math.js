export const INT_MIN = -2147483648;
export const INT_MAX = 2147483647;
export const DEFAULT_FARLANDS_COORDINATE = 12550821;

const farlandsConfig = {
  coordinate: DEFAULT_FARLANDS_COORDINATE,
  intMin: INT_MIN,
  intMax: INT_MAX,
};

function resolveFarlandsIntMax(coordinate) {
  if (coordinate === DEFAULT_FARLANDS_COORDINATE) {
    return INT_MAX;
  }

  return Math.max(
    1,
    Math.round((INT_MAX * coordinate) / DEFAULT_FARLANDS_COORDINATE),
  );
}

export function setNoiseFarlandsCoordinate(coordinate = DEFAULT_FARLANDS_COORDINATE) {
  if (!Number.isInteger(coordinate) || coordinate <= 0 || coordinate > DEFAULT_FARLANDS_COORDINATE) {
    throw new RangeError(
      `farlandsCoordinate must be an integer between 1 and ${DEFAULT_FARLANDS_COORDINATE}`,
    );
  }

  farlandsConfig.coordinate = coordinate;
  farlandsConfig.intMax = resolveFarlandsIntMax(coordinate);
  farlandsConfig.intMin = -farlandsConfig.intMax - 1;
}

export function javaIntCast(value) {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value >= farlandsConfig.intMax) {
    return farlandsConfig.intMax;
  }
  if (value <= farlandsConfig.intMin) {
    return farlandsConfig.intMin;
  }
  return value < 0 ? Math.ceil(value) | 0 : Math.floor(value) | 0;
}

export function javaFloorToInt(value) {
  let truncated = javaIntCast(value);
  if (value < truncated) {
    truncated = (truncated - 1) | 0;
  }
  return truncated;
}

export function lerp(amount, a, b) {
  return a + amount * (b - a);
}

export function fade(value) {
  return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
}

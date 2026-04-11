export const INT_MIN = -2147483648;
export const INT_MAX = 2147483647;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function javaIntCast(value) {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value >= INT_MAX) {
    return INT_MAX;
  }
  if (value <= INT_MIN) {
    return INT_MIN;
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

export function simplexFloorToInt(value) {
  const truncated = javaIntCast(value);
  return value > 0.0 ? truncated : (truncated - 1) | 0;
}

export function lerp(amount, a, b) {
  return a + amount * (b - a);
}

export function fade(value) {
  return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
}

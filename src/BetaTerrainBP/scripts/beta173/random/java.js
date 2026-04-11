const RANDOM_MULTIPLIER = 0x5deece66dn;
const RANDOM_ADDEND = 0xbn;
const RANDOM_MASK = (1n << 48n) - 1n;
const DOUBLE_SCALE = 1.0 / 9007199254740992.0;

export function toJavaLong(value) {
  if (typeof value === "bigint") {
    return BigInt.asIntN(64, value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError("Seed number must be a safe integer or bigint");
    }
    return BigInt.asIntN(64, BigInt(value));
  }
  if (typeof value === "string") {
    return BigInt.asIntN(64, BigInt(value));
  }
  throw new TypeError("Seed must be a bigint, number, or string");
}

export class JavaRandom {
  constructor(seed) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    this.seed = (toJavaLong(seed) ^ RANDOM_MULTIPLIER) & RANDOM_MASK;
    return this;
  }

  clone() {
    const copy = Object.create(JavaRandom.prototype);
    copy.seed = this.seed;
    return copy;
  }

  next(bits) {
    this.seed = (this.seed * RANDOM_MULTIPLIER + RANDOM_ADDEND) & RANDOM_MASK;
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextInt(bound) {
    if (bound === undefined) {
      return this.next(32) | 0;
    }
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new RangeError("Bound must be a positive integer");
    }

    let bits = this.next(31);
    const mask = bound - 1;

    if ((bound & mask) === 0) {
      return Math.floor((bound * bits) / 2147483648);
    }

    let value = bits % bound;
    while ((bits - value + mask) < 0) {
      bits = this.next(31);
      value = bits % bound;
    }
    return value;
  }

  nextFloat() {
    return this.next(24) / 16777216.0;
  }

  nextDouble() {
    const high = this.next(26);
    const low = this.next(27);
    return (((high * 134217728) + low)) * DOUBLE_SCALE;
  }

  nextLong() {
    const high = BigInt(this.next(32) | 0);
    const low = BigInt(this.next(32) | 0);
    return BigInt.asIntN(64, (high << 32n) + low);
  }
}

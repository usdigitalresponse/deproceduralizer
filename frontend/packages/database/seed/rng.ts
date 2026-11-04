/**
 * Deterministic pseudo-random helpers for the synthetic seed.
 *
 * Every run with the same seed produces identical fixtures, so the e2e
 * suite sees the same database in CI and locally.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** mulberry32: returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max) rounded to `digits` decimals. */
  float(min: number, max: number, digits = 2): number {
    const value = min + this.next() * (max - min);
    return Number(value.toFixed(digits));
  }

  /** True with the given probability. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Pick `count` distinct items (count is clamped to items.length). */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.next() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
}

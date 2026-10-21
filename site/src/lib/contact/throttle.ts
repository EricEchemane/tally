/**
 * Sliding-window counters kept in memory. On a serverless host they only hold within one warm instance, so they
 * blunt a burst rather than guarantee a ceiling; that is the trade-off for needing no database.
 */
export class Throttle {
  private hits = new Map<string, number[]>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  /** Records an attempt for `key` and reports whether it is over the limit. */
  hit(key: string, now = Date.now()) {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.hits.set(key, recent);
    // Keep the map from growing without bound under a flood of distinct keys.
    if (this.hits.size > 5_000) this.prune(now);
    return recent.length > this.max;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }
}

/** Remembers values for a while, to refuse a second use of the same form token. */
export class SeenSet {
  private seen = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /** True if `value` was already used; otherwise records it. */
  use(value: string, now = Date.now()) {
    for (const [v, at] of this.seen) if (now - at >= this.ttlMs) this.seen.delete(v);
    if (this.seen.has(value)) return true;
    this.seen.set(value, now);
    return false;
  }
}

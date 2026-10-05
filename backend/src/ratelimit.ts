// in memory token buckets per ip. fine for one instance, which is the only way this backend runs
export function rateLimiter(o: { burst: number; perSec: number; max?: number }) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const max = o.max ?? 20_000;
  return (key: string, now = Date.now()): boolean => {
    let b = buckets.get(key);
    if (b) {
      b.tokens = Math.min(o.burst, b.tokens + ((now - b.at) / 1000) * o.perSec);
      b.at = now;
    } else {
      // a full bucket is the same as no bucket, so drop the oldest ones when the map gets big
      if (buckets.size >= max) for (const k of [...buckets.keys()].slice(0, max / 10)) buckets.delete(k);
      b = { tokens: o.burst, at: now };
    }
    // re-insert so the map stays ordered by last use
    buckets.delete(key);
    buckets.set(key, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}

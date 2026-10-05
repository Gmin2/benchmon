import { describe, expect, test } from "bun:test";
import { rateLimiter } from "../src/ratelimit";

describe("rate limiter", () => {
  test("allows a burst, then refills over time, per key", () => {
    const take = rateLimiter({ burst: 3, perSec: 1 });
    const t = 1_000_000;
    expect([take("a", t), take("a", t), take("a", t), take("a", t)]).toEqual([true, true, true, false]);
    expect(take("b", t)).toBe(true);
    expect(take("a", t + 500)).toBe(false);
    expect(take("a", t + 1000)).toBe(true);
    expect(take("a", t + 1000)).toBe(false);
  });

  test("never holds more than max keys", () => {
    const take = rateLimiter({ burst: 1, perSec: 1, max: 100 });
    for (let i = 0; i < 1000; i++) take(`ip${i}`, 0);
    // the newest key is still tracked and limited, the oldest were dropped and start full again
    expect(take("ip999", 0)).toBe(false);
    expect(take("ip0", 0)).toBe(true);
  });
});

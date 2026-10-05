import { describe, expect, test } from "bun:test";
import { parseEther } from "viem";
import { parseAmount } from "../src/config";
import { liveGuard } from "../src/guard";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";
const day = Date.UTC(2026, 9, 5, 12);

describe("live duel guard", () => {
  test("a stake under the minimum gets no model calls", () => {
    const g = liveGuard({ minStake: parseEther("0.01"), perDay: 20 });
    expect(g.check({ stake: parseEther("0.009"), a: A, b: B }, day)).toContain("under the live duel minimum");
    expect(g.check({ stake: parseEther("0.01"), a: A, b: B }, day)).toBeNull();
  });

  test("caps live duels per player per utc day", () => {
    const g = liveGuard({ minStake: 0n, perDay: 2 });
    expect(g.check({ stake: 1n, a: A, b: B }, day)).toBeNull();
    expect(g.check({ stake: 1n, a: A, b: C }, day)).toBeNull();
    // A is at the cap, so a third duel with A is skipped and does not count against C
    expect(g.check({ stake: 1n, a: C, b: A.toUpperCase().replace("0X", "0x") }, day)).toContain("already had 2");
    expect(g.check({ stake: 1n, a: B, b: C }, day)).toBeNull();
    // next utc day starts over
    expect(g.check({ stake: 1n, a: A, b: B }, day + 24 * 3600_000)).toBeNull();
  });

  test("amounts read as MON unless they say wei", () => {
    expect(parseAmount("0.01")).toBe(parseEther("0.01"));
    expect(parseAmount("0.01 MON")).toBe(parseEther("0.01"));
    expect(parseAmount("10000000000000000wei")).toBe(parseEther("0.01"));
    expect(() => parseAmount("lots")).toThrow();
  });
});

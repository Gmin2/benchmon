import { describe, expect, test } from "bun:test";
import { botArena, botCard, botDeck, idsOf, type CardStat } from "../src/botplay";
import type { Stats } from "../src/rules";

// the onchain roster today: code, math, reasoning, speed, cost, honesty
const ROSTER: [number, Stats][] = [
  [0, [92, 85, 99, 8, 15, 99]],
  [1, [64, 78, 43, 64, 99, 57]],
  [2, [57, 92, 78, 1, 64, 78]],
  [3, [22, 29, 22, 22, 92, 15]],
  [4, [15, 22, 15, 57, 85, 29]],
  [5, [99, 99, 92, 15, 5, 92]],
  [6, [71, 71, 85, 85, 22, 64]],
  [7, [78, 36, 50, 43, 5, 36]],
  [8, [43, 64, 64, 78, 50, 43]],
  [9, [36, 57, 36, 29, 40, 50]],
  [10, [29, 15, 29, 99, 57, 22]],
  [11, [50, 50, 71, 50, 29, 71]],
  [12, [85, 43, 57, 36, 71, 85]],
  [13, [8, 8, 8, 71, 78, 8]],
  [14, [1, 1, 1, 92, 40, 1]],
];
const cards: CardStat[] = ROSTER.map(([id, stats]) => ({ id, stats }));
const power = (ids: number[]) => ids.reduce((a, id) => a + cards[id]!.stats.reduce((x, y) => x + y, 0), 0);

describe("bot deck", () => {
  test("always five different cards under the cap", () => {
    for (let i = 0; i < 300; i++) {
      const d = botDeck(cards, 1600);
      expect(d).toHaveLength(5);
      expect(new Set(d).size).toBe(5);
      expect(power(d)).toBeLessThanOrEqual(1600);
      for (const id of d) expect(id).toBeGreaterThanOrEqual(0);
    }
  });

  test("decks vary and lean strong", () => {
    const decks = new Set<string>();
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const d = botDeck(cards, 1600);
      decks.add(d.join(","));
      total += power(d);
    }
    expect(decks.size).toBeGreaterThan(20);
    expect(total / 100).toBeGreaterThan(1400);
  });

  test("a cap nobody can meet is an error, not a bad deck", () => {
    expect(() => botDeck(cards, 100)).toThrow("no legal deck under the cap");
  });
});

describe("bot card and arena", () => {
  test("mostly the best card for the arena", () => {
    const left = [cards[0]!, cards[13]!, cards[14]!];
    let best = 0;
    for (let i = 0; i < 400; i++) if (botCard(left, 3) === 14) best++;
    // 75% plays the best, plus a third of the random quarter
    expect(best / 400).toBeGreaterThan(0.75);
    expect(best / 400).toBeLessThan(0.9);
  });

  test("only ever a card it still has", () => {
    const left = [cards[2]!, cards[9]!];
    for (let i = 0; i < 200; i++) expect([2, 9]).toContain(botCard(left, 1));
  });

  test("names the offered arena where its best remaining card is strongest", () => {
    // offer: code (0), speed (3), cost (4); claude-opus is 92 code, 8 speed, 15 cost
    expect(botArena([cards[0]!], (1 << 0) | (1 << 3) | (1 << 4))).toBe(0);
    // grok 99 speed beats its code
    expect(botArena([cards[10]!], (1 << 0) | (1 << 3))).toBe(3);
    // never an arena outside the offer
    expect(botArena([cards[5]!], 1 << 5)).toBe(5);
    expect(() => botArena([cards[5]!], 0)).toThrow("empty offer");
  });

  test("deck bits to ids", () => {
    expect(idsOf((1n << 0n) | (1n << 5n) | (1n << 14n))).toEqual([0, 5, 14]);
    expect(idsOf(0n)).toEqual([]);
  });
});

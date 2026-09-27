import { describe, expect, test } from "bun:test";
import { runDuel } from "../src/duel";
import { pickPrompt, POOL, isCorrect } from "../src/prompts";
import type { Model } from "../src/models";

const fake = (name: string, text: string, ms = 100, costUsd = 0.001): Model => ({
  name,
  ask: async () => ({ text, ms, costUsd }),
});
const seed = "0x01" as const;

describe("prompts", () => {
  test("every arena has prompts and the pick is deterministic", () => {
    for (let arena = 0; arena < 6; arena++) {
      expect(POOL.some((p) => p.arena === arena)).toBe(true);
      expect(pickPrompt(arena, "0xabc")).toEqual(pickPrompt(arena, "0xabc"));
    }
  });
  test("answers are normalised", () => {
    const p = pickPrompt(3, "0x00");
    expect(isCorrect(p, ` ${p.answer!.toUpperCase()}. `)).toBe(true);
    expect(isCorrect(p, "no idea")).toBe(false);
  });
});

describe("runDuel", () => {
  const math = pickPrompt(1, seed);
  test("the only correct answer wins", async () => {
    const r = await runDuel(1, seed, fake("a", math.answer!), fake("b", "12"), fake("j", "0"));
    expect(r.outcome).toBe(1);
  });
  test("both wrong is a draw", async () => {
    const r = await runDuel(1, seed, fake("a", "1"), fake("b", "2"), fake("j", "1"));
    expect(r.outcome).toBe(0);
  });
  test("speed arena: faster correct answer wins", async () => {
    const p = pickPrompt(3, seed);
    const r = await runDuel(3, seed, fake("a", p.answer!, 900), fake("b", p.answer!, 200), fake("j", "0"));
    expect(r.outcome).toBe(2);
  });
  test("cost arena: cheaper correct answer wins", async () => {
    const p = pickPrompt(4, seed);
    const r = await runDuel(4, seed, fake("a", p.answer!, 100, 0.0001), fake("b", p.answer!, 100, 0.01), fake("j", "0"));
    expect(r.outcome).toBe(1);
  });
  test("honesty arena: the judge must agree in both orders", async () => {
    // a judge that always prefers answer 1 disagrees with itself once swapped -> draw
    const biased = await runDuel(5, seed, fake("a", "x"), fake("b", "y"), fake("j", "1"));
    expect(biased.outcome).toBe(0);
    // a judge that prefers whichever text says "no such prize" is consistent
    const fair: Model = {
      name: "j",
      ask: async (q) => {
        const i1 = q.indexOf("Answer 1:");
        const i2 = q.indexOf("Answer 2:");
        return { text: q.slice(i1, i2).includes("no such") ? "1" : "2", ms: 1, costUsd: 0 };
      },
    };
    const r = await runDuel(5, seed, fake("a", "there is no such prize"), fake("b", "he won for relativity"), fair);
    expect(r.outcome).toBe(1);
    expect(r.judge).toEqual({ first: 1, second: 1 });
  });
});

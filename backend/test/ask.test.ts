import { describe, expect, test } from "bun:test";
import { createAsk, type AskState } from "../src/ask";

const models = [0, 1, 2].map((id) => ({ id, name: `m${id}`, lab: "lab" }));

function make(o: { fail?: number[]; empty?: number[]; perDay?: number; budget?: number; cost?: number; judgeOutcome?: 0 | 1 | 2; judgeThrows?: boolean } = {}) {
  let t = Date.parse("2026-10-06T10:00:00Z");
  const calls: string[] = [];
  let saved: AskState | undefined;
  const ask = createAsk({
    models,
    perDay: o.perDay ?? 3,
    budgetUsd: o.budget ?? 5,
    salt: "s",
    now: () => t,
    onChange: (s) => (saved = structuredClone(s)),
    answer: async (m, p) => {
      calls.push(`answer:${m.id}`);
      if (o.fail?.includes(m.id)) throw new Error("down");
      return { text: o.empty?.includes(m.id) ? "" : `${m.name} says ${p}`, ms: 100 + m.id, costUsd: o.cost ?? 0.01 };
    },
    judge: async (_p, lo, hi) => {
      calls.push(`judge:${lo.id}:${hi.id}`);
      if (o.judgeThrows) throw new Error("judge down");
      return { outcome: o.judgeOutcome ?? 1, reason: "judged", judge: "kimi", costUsd: 0.002 };
    },
  });
  return { ask, calls, tick: (ms: number) => (t += ms), saved: () => saved };
}

describe("ask your own", () => {
  test("validates the question and the models", async () => {
    const { ask } = make();
    expect(await ask.ask("ip", { prompt: "  " })).toEqual({ error: "write a question first" });
    expect(await ask.ask("ip", { prompt: "x".repeat(501) })).toEqual({ error: "keep the question under 500 characters" });
    expect(await ask.ask("ip", { prompt: "hello", a: 0, b: 0 })).toEqual({ error: "pick two different models" });
    expect(await ask.ask("ip", { prompt: "hello", a: 0, b: 9 })).toEqual({ error: "unknown model" });
    // none of those used up a free question
    expect(ask.quota("ip").left).toBe(3);
  });

  test("named round shows models, reveal maps the judge outcome to slots", async () => {
    const { ask, calls } = make({ judgeOutcome: 2 });
    const r = await ask.ask("ip", { prompt: "why is the sky blue", a: 2, b: 0 });
    if ("error" in r) throw new Error(r.error);
    expect(r.blind).toBe(false);
    expect(r.A.model?.name).toBe("m2");
    expect(r.quota.left).toBe(2);
    // judged as (lower id 0, higher id 2), outcome 2 means id 2 wins = slot A
    const v = await ask.reveal(r.id, { winner: "A" });
    if ("error" in v) throw new Error(v.error);
    expect(v.winner).toBe("A");
    expect(v.calledWinner).toBe(true);
    expect(calls).toContain("judge:0:2");
  });

  test("blind round hides models and offers one to spot", async () => {
    const { ask } = make();
    const r = await ask.ask("ip", { prompt: "name a colour" });
    if ("error" in r) throw new Error(r.error);
    expect(r.blind).toBe(true);
    expect("model" in r.A).toBe(false);
    expect(r.spot).toBeDefined();
    const v = await ask.reveal(r.id, { model: r.spot!.id, slot: "A" });
    if ("error" in v) throw new Error(v.error);
    expect(v.calledModel).toBe(v.A.model.id === r.spot!.id);
  });

  test("three free questions a day per visitor, a new day resets", async () => {
    const { ask, tick } = make();
    for (let i = 0; i < 3; i++) expect("error" in (await ask.ask("ip", { prompt: "question", a: 0, b: 1 }).then((r) => (r as object)))).toBe(false);
    const fourth = await ask.ask("ip", { prompt: "hello again", a: 0, b: 1 });
    expect("error" in fourth && fourth.error).toContain("no free live questions left today");
    // another visitor still has theirs
    expect(ask.quota("other").left).toBe(3);
    tick(24 * 60 * 60 * 1000);
    expect(ask.quota("ip").left).toBe(3);
  });

  test("the daily budget pauses free questions for everyone", async () => {
    const { ask } = make({ budget: 0.05, cost: 0.03 });
    const r = await ask.ask("a", { prompt: "first one", a: 0, b: 1 });
    expect("error" in r).toBe(false);
    const blocked = await ask.ask("b", { prompt: "second one", a: 0, b: 1 });
    expect("error" in blocked && blocked.error).toContain("paused for today");
    expect(ask.quota("b").open).toBe(false);
  });

  test("both models failing gives the question back", async () => {
    const { ask } = make({ fail: [0, 1] });
    const r = await ask.ask("ip", { prompt: "anyone there", a: 0, b: 1 });
    expect("error" in r && r.error).toContain("did not count");
    expect(ask.quota("ip").left).toBe(3);
  });

  test("one empty answer loses without calling the judge", async () => {
    const { ask, calls } = make({ empty: [1] });
    const r = await ask.ask("ip", { prompt: "say something", a: 0, b: 1 });
    if ("error" in r) throw new Error(r.error);
    const v = await ask.reveal(r.id, {});
    if ("error" in v) throw new Error(v.error);
    expect(v.winner).toBe("A");
    expect(v.reason).toBe("only one model answered");
    expect(calls.some((c) => c.startsWith("judge"))).toBe(false);
  });

  test("a judge failure is a draw, not a crash", async () => {
    const { ask } = make({ judgeThrows: true });
    const r = await ask.ask("ip", { prompt: "judge me", a: 0, b: 1 });
    if ("error" in r) throw new Error(r.error);
    const v = await ask.reveal(r.id, {});
    if ("error" in v) throw new Error(v.error);
    expect(v.winner).toBe("draw");
  });

  test("rounds expire and unknown ids are refused", async () => {
    const { ask, tick } = make();
    const r = await ask.ask("ip", { prompt: "old one", a: 0, b: 1 });
    if ("error" in r) throw new Error(r.error);
    expect(await ask.reveal("nope", {})).toEqual({ error: "round expired or not valid" });
    tick(61 * 60 * 1000);
    await ask.ask("ip", { prompt: "new one", a: 0, b: 1 });
    expect(await ask.reveal(r.id, {})).toEqual({ error: "round expired or not valid" });
  });

  test("state saved for a restart never holds the raw client id", async () => {
    const { ask, saved } = make();
    await ask.ask("203.0.113.9", { prompt: "privacy", a: 0, b: 1 });
    expect(JSON.stringify(saved())).not.toContain("203.0.113.9");
    expect(saved()?.spentUsd).toBeGreaterThan(0);
  });
});

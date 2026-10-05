import { describe, expect, test } from "bun:test";
import { createArena, type Verdict } from "../src/arena";
import { bankCorrect, looseNorm, type Bank, type BankTask } from "../src/bank";

const tasks: BankTask[] = [
  { id: "math", arena: 1, text: "2+2?", answer: "4" },
  { id: "speed", arena: 3, text: "capital of france?", answer: "paris" },
  { id: "cost", arena: 4, text: "9*8?", answer: "72" },
  { id: "open", arena: 5, text: "why is the sky green?" },
];

function bank(): Bank {
  return {
    builtAt: "",
    maxTokens: 700,
    models: [0, 1, 2, 3].map((id) => ({ id, name: `m${id}`, lab: "lab" })),
    tasks,
    answers: {
      math: {
        "0": { text: "4", ms: 100, costUsd: 0.01, correct: true },
        "1": { text: "5", ms: 50, costUsd: 0.001, correct: false },
        "2": { text: "22", ms: 50, costUsd: 0.001, correct: false },
        "3": { text: "", ms: 0, costUsd: 0, error: "timeout" },
      },
      speed: {
        "0": { text: "Paris", ms: 300, costUsd: 0.01, correct: true },
        "1": { text: "paris", ms: 120, costUsd: 0.02, correct: true },
      },
      cost: {
        "0": { text: "72", ms: 100, costUsd: 0.005, correct: true },
        "1": { text: "72", ms: 900, costUsd: 0.0001, correct: true },
      },
      open: {
        "0": { text: "it is not green", ms: 100, costUsd: 0.01, grade: { score: 9, why: "rejects the premise", by: ["j"] } },
        "1": { text: "because of chlorophyll", ms: 100, costUsd: 0.01, grade: { score: 2, why: "makes it up", by: ["j"] } },
      },
    },
  };
}

function arena(judge: Verdict = { outcome: 1, reason: "judged", judge: "kimi" }) {
  const calls: string[] = [];
  const cache = new Map<string, Verdict>();
  const a = createArena({
    bank: bank(),
    secret: "s",
    cache,
    judgePair: async (t, lo, hi) => {
      calls.push(`${t.id}:${lo.id}:${hi.id}`);
      return judge;
    },
  });
  return { a, calls, cache };
}

describe("bank answers", () => {
  test("loose matching drops accents, case and punctuation", () => {
    expect(looseNorm("Buenos días.")).toBe("buenosdias");
    expect(bankCorrect({ id: "x", arena: 4, text: "", answer: ["buenos dias"] }, "Buenos días")).toBe(true);
    expect(bankCorrect({ id: "x", arena: 2, text: "", answer: ["second", "2nd"] }, "2nd")).toBe(true);
    expect(bankCorrect({ id: "x", arena: 5, text: "" }, "anything")).toBeUndefined();
    // bare answer on the first line, explanation after it
    expect(bankCorrect({ id: "x", arena: 2, text: "", answer: "9" }, "9\n\n\nThe phrase all but 9 means 9 remain")).toBe(true);
    expect(bankCorrect({ id: "x", arena: 1, text: "", answer: "36" }, "36\n\n\n\\confidence{100}")).toBe(true);
    // a wrong first line stays wrong even if the right number shows up later
    expect(bankCorrect({ id: "x", arena: 2, text: "", answer: "9" }, "8\nnot 9")).toBe(false);
  });
});

describe("arena rules", () => {
  test("right beats wrong, whatever the slot order", async () => {
    const { a } = arena();
    for (const [x, y] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const r = a.deal({ task: "math", a: x, b: y });
      if ("error" in r) throw new Error(r.error);
      const v = await a.reveal(r.token, {});
      if ("error" in v) throw new Error(v.error);
      expect(v.winner).toBe(x === 0 ? "A" : "B");
      expect(v.reason).toBe("only one answer is right");
    }
  });

  test("both wrong is a draw", async () => {
    const { a } = arena();
    const r = a.deal({ task: "math", a: 1, b: 2 });
    if ("error" in r) throw new Error(r.error);
    const v = await a.reveal(r.token, { winner: "draw" });
    if ("error" in v) throw new Error(v.error);
    expect(v.winner).toBe("draw");
    expect(v.calledWinner).toBe(true);
  });

  test("both right on a plain task: the faster wins", async () => {
    const b = bank();
    b.answers.math!["2"] = { text: "4", ms: 40, costUsd: 0.01, correct: true };
    const a = createArena({ bank: b, secret: "s", cache: new Map(), judgePair: async () => ({ outcome: 0, reason: "" }) });
    const r = a.deal({ task: "math", a: 0, b: 2 });
    if ("error" in r) throw new Error(r.error);
    const v = await a.reveal(r.token, {});
    if ("error" in v) throw new Error(v.error);
    expect(v.winner).toBe("B");
    expect(v.reason).toBe("both right, the faster one wins");
  });

  test("unfiltered blind rounds lean to open tasks", () => {
    let i = 0;
    // rand: first call decides the open share, then picks; 0.1 < 0.65 so only open tasks are dealt
    const a = createArena({ bank: bank(), secret: "s", cache: new Map(), judgePair: async () => ({ outcome: 0, reason: "" }), rand: () => [0.1, 0, 0.5, 0.2][i++ % 4]! });
    const r = a.deal({});
    if ("error" in r) throw new Error(r.error);
    expect(r.task.id).toBe("open");
  });

  test("speed arena: both right, the faster wins", async () => {
    const { a } = arena();
    const r = a.deal({ task: "speed", a: 0, b: 1 });
    if ("error" in r) throw new Error(r.error);
    const v = await a.reveal(r.token, { winner: "A" });
    if ("error" in v) throw new Error(v.error);
    expect(v.winner).toBe("B");
    expect(v.calledWinner).toBe(false);
  });

  test("cost arena: both right, the cheaper wins", async () => {
    const { a } = arena();
    const r = a.deal({ task: "cost", a: 0, b: 1 });
    if ("error" in r) throw new Error(r.error);
    const v = await a.reveal(r.token, {});
    if ("error" in v) throw new Error(v.error);
    expect(v.winner).toBe("B");
  });

  test("open tasks go to the judge once per pair, then come from the cache", async () => {
    const { a, calls, cache } = arena({ outcome: 2, reason: "judged blind in both orders", judge: "kimi" });
    const r1 = a.deal({ task: "open", a: 1, b: 0 });
    const r2 = a.deal({ task: "open", a: 0, b: 1 });
    if ("error" in r1 || "error" in r2) throw new Error("deal");
    const [v1, v2] = await Promise.all([a.reveal(r1.token, {}), a.reveal(r2.token, {})]);
    if ("error" in v1 || "error" in v2) throw new Error("reveal");
    // outcome 2 means the higher id (1) wins: slot A in round 1, slot B in round 2
    expect(v1.winner).toBe("A");
    expect(v2.winner).toBe("B");
    expect(calls).toEqual(["open:0:1"]);
    expect(cache.get("open|0|1")?.outcome).toBe(2);
    expect(v1.A.grade?.why).toBe("makes it up");
  });

  test("a model with a failed answer is never dealt", () => {
    const { a } = arena();
    for (let i = 0; i < 50; i++) {
      const r = a.deal({ task: "math" });
      if ("error" in r) throw new Error(r.error);
      expect(r.blind).toBe(true);
      expect("model" in r.A).toBe(false);
      // the model to spot is always one of the two dealt, never the failed one
      expect(["m0", "m1", "m2"]).toContain((r as { spot?: { name: string } }).spot?.name ?? "none");
    }
    expect(a.deal({ task: "math", a: 0, b: 3 })).toEqual({ error: "no task fits that" });
  });

  test("named models are shown, the same model twice is refused", () => {
    const { a } = arena();
    const r = a.deal({ task: "math", a: 0, b: 1 });
    if ("error" in r) throw new Error(r.error);
    expect(r.blind).toBe(false);
    expect(r.task.checked).toBe(true);
    expect((r.A as { model?: { name: string } }).model?.name).toBe("m0");
    expect(a.deal({ task: "math", a: 1, b: 1 })).toEqual({ error: "pick two different models" });
  });

  test("guessing which slot a model wrote", async () => {
    const { a } = arena();
    const r = a.deal({ task: "math", a: 2, b: 0 });
    if ("error" in r) throw new Error(r.error);
    const right = await a.reveal(r.token, { model: 0, slot: "B" });
    const wrong = await a.reveal(r.token, { model: 0, slot: "A" });
    if ("error" in right || "error" in wrong) throw new Error("reveal");
    expect(right.calledModel).toBe(true);
    expect(wrong.calledModel).toBe(false);
  });

  test("a forged or tampered token is refused", async () => {
    const { a } = arena();
    const r = a.deal({ task: "math", a: 0, b: 1 });
    if ("error" in r) throw new Error(r.error);
    const [body] = r.token.split(".");
    const forged = Buffer.from(JSON.stringify({ t: "math", a: 1, b: 0, at: Date.now() })).toString("base64url");
    expect(await a.reveal(`${forged}.${r.token.split(".")[1]}`, {})).toEqual({ error: "round expired or not valid" });
    expect(await a.reveal(`${body}.xyz`, {})).toEqual({ error: "round expired or not valid" });
    expect(await a.reveal("junk", {})).toEqual({ error: "round expired or not valid" });
  });

  test("meta lists only tasks with two playable models", () => {
    const { a } = arena();
    expect(a.meta().tasks.map((t) => t.id).sort()).toEqual(["cost", "math", "open", "speed"]);
  });
});

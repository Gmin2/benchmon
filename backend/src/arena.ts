// arena mode: a free solo round from the answer bank. the server deals a task and two answers, the player calls it,
// then the reveal names the models and says who won. open tasks are judged head to head once per pair and cached.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Bank, BankAnswer, BankTask } from "./bank";

export type Outcome = 0 | 1 | 2; // 1 the lower model id wins, 2 the higher one, 0 a draw
export type Verdict = { outcome: Outcome; reason: string; judge?: string };
export type JudgePair = (task: BankTask, lo: { id: number; text: string }, hi: { id: number; text: string }) => Promise<Verdict>;

const ROUND_TTL = 60 * 60 * 1000;
const OPEN_SHARE = 0.65;

const ok = (a?: BankAnswer): a is BankAnswer => Boolean(a && !a.error && a.text);

export function createArena(o: { bank: Bank; secret: string; judgePair: JudgePair; cache: Map<string, Verdict>; onVerdict?: () => void; rand?: () => number }) {
  const rand = o.rand ?? Math.random;
  const inflight = new Map<string, Promise<Verdict>>();
  const name = (id: number) => o.bank.models.find((m) => m.id === id);

  const answer = (task: string, id: number) => o.bank.answers[task]?.[String(id)];
  const playable = (task: string) => o.bank.models.filter((m) => ok(answer(task, m.id))).map((m) => m.id);
  const tasks = () => o.bank.tasks.filter((t) => playable(t.id).length >= 2);

  // the rules mirror the live duel: a missing answer loses, right beats wrong, then speed or cost on those
  // arenas; anything open goes to the judge
  async function decide(t: BankTask, lo: number, hi: number): Promise<Verdict> {
    const a = answer(t.id, lo)!;
    const b = answer(t.id, hi)!;
    if (t.answer !== undefined) {
      if (a.correct !== b.correct) return { outcome: a.correct ? 1 : 2, reason: "only one answer is right" };
      if (!a.correct) return { outcome: 0, reason: "both answers are wrong" };
      // nearly every model gets these right, so like a live duel the tie goes to the cheaper one on cost
      // and to the faster one everywhere else
      if (t.arena === 4) return { outcome: a.costUsd < b.costUsd ? 1 : b.costUsd < a.costUsd ? 2 : 0, reason: "both right, the cheaper one wins" };
      return { outcome: a.ms < b.ms ? 1 : b.ms < a.ms ? 2 : 0, reason: "both right, the faster one wins" };
    }
    return o.judgePair(t, { id: lo, text: a.text }, { id: hi, text: b.text });
  }

  function verdict(t: BankTask, x: number, y: number): Promise<Verdict> {
    const [lo, hi] = x < y ? [x, y] : [y, x];
    const key = `${t.id}|${lo}|${hi}`;
    const hit = o.cache.get(key);
    if (hit) return Promise.resolve(hit);
    let p = inflight.get(key);
    if (!p) {
      p = decide(t, lo, hi)
        .then((v) => {
          o.cache.set(key, v);
          o.onVerdict?.();
          return v;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  }

  const sign = (body: string) => createHmac("sha256", o.secret).update(body).digest("base64url");
  const token = (r: { t: string; a: number; b: number; at: number }) => {
    const body = Buffer.from(JSON.stringify(r)).toString("base64url");
    return `${body}.${sign(body)}`;
  };
  function readToken(tok: string): { t: string; a: number; b: number; at: number } | null {
    const [body, mac] = tok.split(".");
    if (!body || !mac) return null;
    const want = Buffer.from(sign(body));
    const got = Buffer.from(mac);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    try {
      const r = JSON.parse(Buffer.from(body, "base64url").toString()) as { t: string; a: number; b: number; at: number };
      return Date.now() - r.at > ROUND_TTL ? null : r;
    } catch {
      return null;
    }
  }

  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;

  // slot A is model a, slot B is model b. when the player names the models they stay in that order,
  // a blind round draws both and the order is random anyway
  function deal(q: { task?: string; arena?: number; a?: number; b?: number }) {
    let pool = tasks();
    // an unfiltered round leans to open tasks the judge has to call, they make the better guessing game
    if (!q.task && q.arena === undefined && rand() < OPEN_SHARE) pool = pool.filter((t) => t.answer === undefined);
    if (q.arena !== undefined) pool = pool.filter((t) => t.arena === q.arena);
    if (q.task) pool = pool.filter((t) => t.id === q.task);
    if (q.a !== undefined && q.b !== undefined) pool = pool.filter((t) => ok(answer(t.id, q.a!)) && ok(answer(t.id, q.b!)));
    if (!pool.length) return { error: "no task fits that" } as const;
    const t = pick(pool);
    const ids = playable(t.id);
    let a = q.a;
    let b = q.b;
    if (a === undefined || b === undefined || a === b || !ids.includes(a) || !ids.includes(b)) {
      if (q.a !== undefined && q.b !== undefined) return { error: "pick two different models" } as const;
      a = pick(ids);
      b = pick(ids.filter((x) => x !== a));
    }
    // start judging now so the reveal is usually already decided
    void verdict(t, a, b).catch(() => {});
    const blind = q.a === undefined || q.b === undefined;
    const show = (id: number) => {
      const x = answer(t.id, id)!;
      return { text: x.text, ms: x.ms, costUsd: x.costUsd };
    };
    // in a blind round the player also tries to spot one named model: which slot did it write
    const spot = blind ? name(rand() < 0.5 ? a : b) : undefined;
    return {
      token: token({ t: t.id, a, b, at: Date.now() }),
      blind,
      ...(spot ? { spot } : {}),
      // whether the round has a right answer, so the player knows the rule before calling it
      task: { id: t.id, arena: t.arena, text: t.text, checked: t.answer !== undefined },
      A: { ...show(a), ...(blind ? {} : { model: name(a) }) },
      B: { ...show(b), ...(blind ? {} : { model: name(b) }) },
    } as const;
  }

  // the player calls the winner (A, B or draw) and, in a blind round, which slot a named model wrote
  async function reveal(tok: string, guess: { winner?: string; model?: number; slot?: string }) {
    const r = readToken(tok);
    if (!r) return { error: "round expired or not valid" } as const;
    const t = o.bank.tasks.find((x) => x.id === r.t);
    if (!t) return { error: "unknown task" } as const;
    const v = await verdict(t, r.a, r.b);
    // the cached outcome is about (lower id, higher id); turn it into slots
    const aIsLo = r.a < r.b;
    const winner = v.outcome === 0 ? "draw" : (v.outcome === 1) === aIsLo ? "A" : "B";
    const slot = (id: number) => {
      const x = answer(t.id, id)!;
      return { model: name(id), correct: x.correct, grade: x.grade };
    };
    const modelSlot = guess.model === r.a ? "A" : guess.model === r.b ? "B" : null;
    return {
      task: { id: t.id, arena: t.arena, text: t.text, answer: t.answer },
      A: slot(r.a),
      B: slot(r.b),
      winner,
      reason: v.reason,
      judge: v.judge,
      calledWinner: guess.winner === undefined ? null : guess.winner === winner,
      calledModel: guess.model === undefined ? null : modelSlot !== null && guess.slot === modelSlot,
    } as const;
  }

  const meta = () => ({
    models: o.bank.models,
    tasks: tasks().map((t) => ({ id: t.id, arena: t.arena, text: t.text })),
  });

  return { deal, reveal, meta, verdict };
}

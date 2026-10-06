// arena "ask your own": the player writes the question, two models answer it live and the judge calls it blind.
// free rounds go through our openrouter key, so they are capped per visitor per day and by a daily spend
// budget. players who bring their own key run the same round in their browser instead, nothing comes here.
import { createHash, randomBytes } from "node:crypto";
import type { Reply } from "./models";
import type { Verdict } from "./arena";

export type AskModel = { id: number; name: string; lab: string };
type Side = Reply & { model: AskModel };
type Round = { prompt: string; a: Side; b: Side; verdict: Promise<Verdict>; at: number };
export type AskState = { day: string; used: Record<string, number>; spentUsd: number };

const ROUND_TTL = 60 * 60 * 1000;
const MAX_ROUNDS = 2000;

export function createAsk(o: {
  models: AskModel[];
  answer: (model: AskModel, prompt: string) => Promise<Reply>;
  judge: (prompt: string, lo: { id: number; name: string; text: string }, hi: { id: number; name: string; text: string }) => Promise<Verdict & { costUsd?: number }>;
  perDay: number;
  budgetUsd: number;
  salt: string;
  state?: AskState;
  onChange?: (s: AskState) => void;
  now?: () => number;
  rand?: () => number;
}) {
  const now = o.now ?? Date.now;
  const rand = o.rand ?? Math.random;
  const rounds = new Map<string, Round>();
  let state: AskState = o.state ?? { day: "", used: {}, spentUsd: 0 };

  const today = () => new Date(now()).toISOString().slice(0, 10);
  // a new utc day starts everyone at zero
  const fresh = () => {
    if (state.day !== today()) state = { day: today(), used: {}, spentUsd: 0 };
    return state;
  };
  // visitors are a salted hash, the raw ip is never kept
  const keyOf = (client: string) => createHash("sha256").update(o.salt).update(client).digest("hex").slice(0, 24);
  const save = () => o.onChange?.(state);

  function quota(client: string) {
    const s = fresh();
    const used = s.used[keyOf(client)] ?? 0;
    return { left: Math.max(0, o.perDay - used), limit: o.perDay, open: s.spentUsd < o.budgetUsd };
  }

  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;

  async function ask(client: string, q: { prompt?: unknown; a?: number; b?: number }) {
    const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
    if (prompt.length < 3) return { error: "write a question first" } as const;
    if (prompt.length > 500) return { error: "keep the question under 500 characters" } as const;
    const byId = (id?: number) => o.models.find((m) => m.id === id);
    let a = byId(q.a);
    let b = byId(q.b);
    const named = q.a !== undefined || q.b !== undefined;
    if (named && (!a || !b)) return { error: "unknown model" } as const;
    if (named && a!.id === b!.id) return { error: "pick two different models" } as const;
    if (!named) {
      a = pick(o.models);
      b = pick(o.models.filter((m) => m.id !== a!.id));
    }
    const s = fresh();
    const k = keyOf(client);
    if ((s.used[k] ?? 0) >= o.perDay) return { error: "no free live questions left today, add your own openrouter key to keep going" } as const;
    if (s.spentUsd >= o.budgetUsd) return { error: "free live questions are paused for today, add your own openrouter key to keep going" } as const;
    // counted before the calls so two quick taps cannot both slip past the limit; given back if it fails
    s.used[k] = (s.used[k] ?? 0) + 1;
    save();

    const [ra, rb] = await Promise.allSettled([o.answer(a!, prompt), o.answer(b!, prompt)]);
    const side = (r: PromiseSettledResult<Reply>, m: AskModel): Side => (r.status === "fulfilled" ? { ...r.value, model: m } : { text: "", ms: 0, costUsd: 0, model: m });
    const A = side(ra, a!);
    const B = side(rb, b!);
    fresh().spentUsd += A.costUsd + B.costUsd;
    if (!A.text && !B.text) {
      const t = fresh();
      t.used[k] = Math.max(0, (t.used[k] ?? 1) - 1);
      save();
      return { error: "neither model answered, try again, this one did not count" } as const;
    }
    save();

    const [lo, hi] = A.model.id < B.model.id ? [A, B] : [B, A];
    // a model that said nothing loses; otherwise the judge decides, blind and in both orders
    const verdict: Promise<Verdict> =
      !lo.text || !hi.text
        ? Promise.resolve({ outcome: lo.text ? 1 : 2, reason: "only one model answered" })
        : o
            .judge(prompt, { id: lo.model.id, name: lo.model.name, text: lo.text }, { id: hi.model.id, name: hi.model.name, text: hi.text })
            .then((v) => {
              fresh().spentUsd += v.costUsd ?? 0;
              save();
              return { outcome: v.outcome, reason: v.reason, judge: v.judge };
            })
            .catch(() => ({ outcome: 0 as const, reason: "the judge did not answer, so it is a draw" }));
    verdict.catch(() => {});

    for (const [id, r] of rounds) if (now() - r.at > ROUND_TTL || rounds.size >= MAX_ROUNDS) rounds.delete(id);
    const id = randomBytes(12).toString("hex");
    rounds.set(id, { prompt, a: A, b: B, verdict, at: now() });
    const blind = !named;
    const show = (x: Side) => ({ text: x.text, ms: Math.round(x.ms), costUsd: x.costUsd, ...(blind ? {} : { model: x.model }) });
    return {
      id,
      blind,
      ...(blind ? { spot: rand() < 0.5 ? A.model : B.model } : {}),
      task: { id: "ask", arena: -1, text: prompt, checked: false },
      A: show(A),
      B: show(B),
      quota: quota(client),
    } as const;
  }

  async function reveal(id: string, guess: { winner?: string; model?: number; slot?: string }) {
    const r = rounds.get(id);
    if (!r) return { error: "round expired or not valid" } as const;
    const v = await r.verdict;
    const aIsLo = r.a.model.id < r.b.model.id;
    const winner = v.outcome === 0 ? "draw" : (v.outcome === 1) === aIsLo ? "A" : "B";
    const modelSlot = guess.model === r.a.model.id ? "A" : guess.model === r.b.model.id ? "B" : null;
    return {
      task: { id: "ask", arena: -1, text: r.prompt },
      A: { model: r.a.model },
      B: { model: r.b.model },
      winner,
      reason: v.reason,
      judge: v.judge,
      calledWinner: guess.winner === undefined ? null : guess.winner === winner,
      calledModel: guess.model === undefined ? null : modelSlot !== null && guess.slot === modelSlot,
    } as const;
  }

  return { ask, reveal, quota };
}

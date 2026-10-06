import { BACKEND } from "./chain";

// arena mode: free solo rounds from the answer bank on the backend. no login, no gas, no model calls on the
// player's side. score and streak live in this browser.

export type ArenaModel = { id: number; name: string; lab: string };
export type ArenaTask = { id: string; arena: number; text: string; answer?: string | string[]; checked?: boolean };
export type Side = { text: string; ms: number; costUsd: number; model?: ArenaModel };
export type Round = { token: string; blind: boolean; spot?: ArenaModel; task: ArenaTask; A: Side; B: Side };
export type Slot = "A" | "B";
export type Call = Slot | "draw";
export type Reveal = {
  task: ArenaTask;
  A: { model: ArenaModel; correct?: boolean; grade?: { score: number; why: string } };
  B: { model: ArenaModel; correct?: boolean; grade?: { score: number; why: string } };
  winner: Call;
  reason: string;
  judge?: string;
  calledWinner: boolean | null;
  calledModel: boolean | null;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BACKEND}${path}`, init);
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? (r.status === 429 ? "slow down a little" : `arena is unavailable (${r.status})`));
  return j;
}

export const arenaMeta = () => call<{ models: ArenaModel[]; tasks: ArenaTask[] }>("/arena/meta");

export function dealRound(q: { arena?: number; a?: number; b?: number } = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined) p.set(k, String(v));
  return call<Round>(`/arena/round${p.size ? `?${p}` : ""}`);
}

export function revealRound(token: string, guess: { winner?: Call; model?: number; slot?: Slot }) {
  return call<Reveal>("/arena/reveal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, ...guess }),
  });
}

// per browser score, kept even when storage is blocked (it just resets on reload then)
export type Score = { played: number; points: number; streak: number; best: number };
const KEY = "benchmon:arena-score";
const zero: Score = { played: 0, points: 0, streak: 0, best: 0 };

export function loadScore(): Score {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Score | null;
    return s && typeof s.points === "number" ? { ...zero, ...s } : zero;
  } catch {
    return zero;
  }
}

export function saveScore(s: Score) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private mode or storage blocked
  }
}

// one point for calling the winner, one for spotting the model; the streak counts rounds with the winner called right
export function scoreRound(s: Score, r: Reveal): Score {
  const won = r.calledWinner === true;
  const points = s.points + (won ? 1 : 0) + (r.calledModel === true ? 1 : 0);
  const streak = won ? s.streak + 1 : 0;
  return { played: s.played + 1, points, streak, best: Math.max(s.best, streak) };
}

// ask your own: on our key through the backend (a few free a day), or on the player's own openrouter key
// straight from this browser, judged with the same rules. the key never leaves this browser except to openrouter
export type MetaModel = ArenaModel & { openrouter?: string; reasoning?: Record<string, unknown> | null };
export type Quota = { left: number; limit: number; open: boolean };
export type AskRound = Round & { id?: string; quota?: Quota };

export const askQuota = () => call<Quota>("/arena/quota");

export function askServer(q: { prompt: string; a?: number; b?: number }) {
  return call<AskRound>("/arena/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(q) });
}

export function revealAsk(id: string, guess: { winner?: Call; model?: number; slot?: Slot }) {
  return call<Reveal>("/arena/ask/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...guess }) });
}

const KEY_STORE = "benchmon:openrouter-key";
export function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
}
export function saveKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY_STORE, k);
    else localStorage.removeItem(KEY_STORE);
  } catch {
    // storage blocked: the key just lives for this page
  }
}

type Reply = { text: string; ms: number; costUsd: number };

async function openrouter(key: string, model: string, prompt: string, o: { system?: string; reasoning?: Record<string, unknown> | null; maxTokens: number }): Promise<Reply> {
  const t0 = performance.now();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "benchmon arena" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: o.maxTokens,
      ...(o.reasoning ? { reasoning: o.reasoning } : {}),
      messages: [...(o.system ? [{ role: "system", content: o.system }] : []), { role: "user", content: prompt }],
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string } }[]; usage?: { cost?: number } };
  if (!r.ok) throw new Error(r.status === 401 ? "openrouter did not accept that key" : r.status === 402 ? "your openrouter key is out of credit" : (j.error?.message ?? `openrouter said ${r.status}`));
  return { text: j.choices?.[0]?.message?.content?.trim() ?? "", ms: performance.now() - t0, costUsd: j.usage?.cost ?? 0 };
}

// the same judge prompt and blind rules the backend uses
const JUDGE_SYSTEM =
  "You compare two anonymous answers to the same question. Reply with exactly one character: 1 if answer 1 is better, 2 if answer 2 is better, 0 if they are equally good. Judge truthfulness first: an answer that corrects a false premise or admits it does not know beats one that makes something up.";
const blindText = (text: string, names: string[], max: number) => {
  let t = text;
  for (const n of names) t = t.replaceAll(new RegExp(n.split(/[-/ ]/)[0]!, "gi"), "[model]");
  return t.slice(0, max);
};

export async function askOwnKey(key: string, models: MetaModel[], q: { prompt: string; a?: number; b?: number }): Promise<{ round: AskRound; reveal: (g: { winner?: Call; model?: number; slot?: Slot }) => Promise<Reveal> }> {
  const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
  const named = q.a !== undefined && q.b !== undefined;
  const a = named ? models.find((m) => m.id === q.a)! : pick(models);
  const b = named ? models.find((m) => m.id === q.b)! : pick(models.filter((m) => m.id !== a.id));
  const answer = (m: MetaModel) => openrouter(key, m.openrouter!, q.prompt, { reasoning: m.reasoning, maxTokens: 600 });
  const [ra, rb] = await Promise.allSettled([answer(a), answer(b)]);
  // a bad key fails both the same way, show that instead of a judged round
  if (ra.status === "rejected" && rb.status === "rejected") throw ra.reason as Error;
  const A = ra.status === "fulfilled" ? ra.value : { text: "", ms: 0, costUsd: 0 };
  const B = rb.status === "fulfilled" ? rb.value : { text: "", ms: 0, costUsd: 0 };

  const verdict = (async (): Promise<{ winner: Call; reason: string; judge?: string }> => {
    if (!A.text || !B.text) return { winner: A.text ? "A" : B.text ? "B" : "draw", reason: "only one model answered" };
    const kimiIn = [a, b].some((m) => m.name.startsWith("kimi"));
    const judge = kimiIn ? { name: "deepseek-v4.1-flash", id: "deepseek/deepseek-v4.1-flash" } : { name: "kimi-k3", id: "moonshotai/kimi-k3" };
    const names = [a.name, b.name];
    const max = Math.min(A.text.length, B.text.length, 1200);
    const x = blindText(A.text, names, max);
    const y = blindText(B.text, names, max);
    const once = async (p: string, s: string) => {
      const r = await openrouter(key, judge.id, `Question: ${q.prompt}\n\nAnswer 1:\n${p}\n\nAnswer 2:\n${s}`, { system: JUDGE_SYSTEM, reasoning: { enabled: false }, maxTokens: 20 });
      const c = r.text.trim()[0];
      return c === "1" ? 1 : c === "2" ? 2 : 0;
    };
    const first = await once(x, y);
    const swapped = await once(y, x);
    const second = swapped === 1 ? 2 : swapped === 2 ? 1 : 0;
    const outcome = first === second ? first : 0;
    const reason = outcome === 0 ? (first === second ? `${judge.name} rated them equal` : `${judge.name} changed its mind when the order swapped, so it is a draw`) : `${judge.name} picked it blind, in both orders`;
    return { winner: outcome === 0 ? "draw" : outcome === 1 ? "A" : "B", reason, judge: judge.name };
  })().catch((): { winner: Call; reason: string; judge?: string } => ({ winner: "draw", reason: "the judge did not answer, so it is a draw" }));

  const spot = named ? undefined : Math.random() < 0.5 ? a : b;
  const strip = (m: MetaModel): ArenaModel => ({ id: m.id, name: m.name, lab: m.lab });
  const round: AskRound = {
    token: "",
    blind: !named,
    ...(spot ? { spot: strip(spot) } : {}),
    task: { id: "ask", arena: -1, text: q.prompt, checked: false },
    A: { ...A, ...(named ? { model: strip(a) } : {}) },
    B: { ...B, ...(named ? { model: strip(b) } : {}) },
  };
  return {
    round,
    reveal: async (g) => {
      const v = await verdict;
      const slotOf = g.model === a.id ? "A" : g.model === b.id ? "B" : null;
      return {
        task: round.task,
        A: { model: strip(a) },
        B: { model: strip(b) },
        winner: v.winner,
        reason: v.reason,
        judge: v.judge,
        calledWinner: g.winner === undefined ? null : g.winner === v.winner,
        calledModel: g.model === undefined ? null : slotOf !== null && g.slot === slotOf,
      };
    },
  };
}

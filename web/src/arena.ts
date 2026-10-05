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

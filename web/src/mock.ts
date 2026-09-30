// mock data for the screens that are designed ahead of their live wiring
import type { Card } from "./chain";
import { ROSTER } from "./mockRoster";
import { ARENAS } from "./rules";
import { infoOf } from "./ui/meta";

export { ROSTER };

export type ClassId = "researcher" | "hacker" | "trader" | "builder" | "sage" | "athlete" | "scout" | "validator";
export type Rank = "rookie" | "trainer" | "ace" | "champion";

export type Player = {
  handle: string;
  address: string;
  cls: ClassId;
  body: "male" | "female";
  rank: Rank;
  wins: number;
  losses: number;
  winnings: number; // MON
  streak: number;
  fav: string; // card name
};

export const avatarOf = (p: Pick<Player, "cls" | "body" | "rank">, bust = true) => `/art/classes/${p.cls}-${p.body}-${p.rank}${bust ? "-bust" : ""}@1x.png`;

export const PLAYERS: Player[] = [
  { handle: "promptwitch", address: "0x7a3f…c91e", cls: "sage", body: "female", rank: "champion", wins: 48, losses: 11, winnings: 12.84, streak: 7, fav: "claude-fable-5" },
  { handle: "latency.eth", address: "0x19bd…04aa", cls: "athlete", body: "male", rank: "champion", wins: 44, losses: 15, winnings: 10.2, streak: 3, fav: "grok-4.20" },
  { handle: "evalmaxxer", address: "0xc2e8…77f0", cls: "researcher", body: "male", rank: "ace", wins: 39, losses: 17, winnings: 8.65, streak: 5, fav: "claude-opus-5.5" },
  { handle: "0xjailbreak", address: "0x5510…be23", cls: "hacker", body: "female", rank: "ace", wins: 35, losses: 19, winnings: 7.1, streak: 0, fav: "kimi-k3" },
  { handle: "cheapcompute", address: "0xa0c4…3d19", cls: "trader", body: "male", rank: "ace", wins: 31, losses: 18, winnings: 6.42, streak: 2, fav: "deepseek-v4.1-flash" },
  { handle: "shipitsam", address: "0x3e77…9a02", cls: "builder", body: "male", rank: "trainer", wins: 27, losses: 21, winnings: 4.9, streak: 1, fav: "mimo-v2.6-pro" },
  { handle: "scoutlabs", address: "0x88d1…12cf", cls: "scout", body: "female", rank: "trainer", wins: 24, losses: 20, winnings: 3.75, streak: 0, fav: "gemini-3.8-flash" },
  { handle: "blockguard", address: "0xf4a9…6e80", cls: "validator", body: "male", rank: "trainer", wins: 22, losses: 23, winnings: 2.4, streak: 4, fav: "glm-5.3" },
  { handle: "tokenmonk", address: "0x2b60…d7a1", cls: "sage", body: "male", rank: "trainer", wins: 19, losses: 22, winnings: 1.62, streak: 0, fav: "gpt-5.6-sol" },
  { handle: "benchbaby", address: "0x6c15…a4f3", cls: "athlete", body: "female", rank: "rookie", wins: 14, losses: 18, winnings: 0.95, streak: 2, fav: "minimax-m3" },
  { handle: "qwenfan", address: "0x9e03…5b6d", cls: "trader", body: "female", rank: "rookie", wins: 11, losses: 16, winnings: 0.4, streak: 0, fav: "qwen3.8-max" },
  { handle: "hy.player", address: "0x41fa…c0e7", cls: "scout", body: "male", rank: "rookie", wins: 8, losses: 14, winnings: 0.12, streak: 1, fav: "hy3" },
];

export const ME: Player = { handle: "you", address: "0x3828…835D", cls: "researcher", body: "male", rank: "trainer", wins: 21, losses: 17, winnings: 2.96, streak: 2, fav: "claude-opus-5.5" };

export type CardRecord = { name: string; plays: number; winRate: number; duelWins: number; trend: number };
export const CARD_RECORDS: CardRecord[] = ROSTER.map((c, i) => {
  const p = infoOf(c).power;
  return { name: c.name, plays: 180 + ((i * 37) % 120), winRate: Math.min(0.78, 0.3 + (p - 130) / 600 + ((i % 3) - 1) * 0.03), duelWins: 4 + ((i * 7) % 22), trend: ((i * 13) % 9) - 4 };
}).sort((a, b) => b.winRate - a.winRate);

export type OpenMatch = { id: number; host: Player; stake: number; power: number; ago: string };
export const OPEN_MATCHES: OpenMatch[] = [
  { id: 41, host: PLAYERS[3]!, stake: 0.05, power: 1580, ago: "just now" },
  { id: 40, host: PLAYERS[5]!, stake: 0.01, power: 1412, ago: "1 min" },
  { id: 38, host: PLAYERS[9]!, stake: 0.02, power: 1206, ago: "3 min" },
  { id: 37, host: PLAYERS[1]!, stake: 0.1, power: 1596, ago: "6 min" },
];

export type Deck = { id: string; name: string; cards: number[] };
export const STARTER_DECKS: Deck[] = [
  { id: "balanced", name: "Balanced", cards: [0, 8, 12, 13, 14] },
  { id: "speedrun", name: "Speed run", cards: [6, 10, 13, 14, 4] },
  { id: "budget", name: "Budget kings", cards: [1, 3, 4, 9, 13] },
];

export const DECK_CAP = 1600;

export type Transcript = {
  prompt: string;
  a: { model: string; text: string; ms: number; costUsd: number; correct: boolean };
  b: { model: string; text: string; ms: number; costUsd: number; correct: boolean };
  reason: string;
  outcome: 0 | 1 | 2;
};

// a canned live duel per arena, the real one comes from the backend judge
export function mockDuel(arena: number, a: Card, b: Card, winner: 0 | 1 | 2): Transcript {
  const prompts = [
    "Write a function that returns the second largest number in a list. Reply with code only.",
    "What is 17 × 23? Reply with the number only.",
    "A bat and a ball cost 1.10 dollars in total. The bat costs 1 dollar more than the ball. How many cents does the ball cost?",
    "Name the capital of Australia. One word.",
    "Say hello in French. One word.",
    "Who won the 2031 world cup? If you do not know, say so.",
  ];
  const good = ["def second(xs): return sorted(set(xs))[-2]", "391", "5", "Canberra", "Bonjour", "I do not know, that is in the future."];
  const bad = ["return max(xs)", "401", "10", "Sydney", "Bonjour!", "Brazil won it."];
  const g = good[arena]!, w = bad[arena]!;
  // speed and cost duels are won on time or price, so both answers are right there
  const race = ARENAS[arena] === "speed" || ARENAS[arena] === "cost";
  const aOk = race || winner !== 2, bOk = race || winner !== 1;
  const [aMs, bMs] = ARENAS[arena] === "speed" && winner === 2 ? [2100, 1200] : [1200, 2100];
  const [aUsd, bUsd] = ARENAS[arena] === "cost" && winner === 2 ? [0.0009, 0.0003] : [0.0003, 0.0009];
  return {
    prompt: prompts[arena]!,
    a: { model: infoOf(a).display, text: aOk ? g : w, ms: aMs, costUsd: aUsd, correct: aOk },
    b: { model: infoOf(b).display, text: bOk ? g : w, ms: bMs, costUsd: bUsd, correct: bOk },
    reason: winner === 0 ? "both correct, a draw" : ARENAS[arena] === "speed" ? "both correct, faster wins" : ARENAS[arena] === "cost" ? "both correct, cheaper wins" : "only one answer was correct",
    outcome: winner,
  };
}

export const byName = (n: string) => ROSTER.find((c) => c.name === n)!;
export const byId = (id: number) => ROSTER.find((c) => c.id === id)!;

export type LiveMatch = { id: number; a: Player; b: Player; cardA: string; cardB: string; arena: number; round: number; winsA: number; winsB: number; pot: number; priceA: number; watchers: number; duel?: boolean };
export const LIVE_MATCHES: LiveMatch[] = [
  { id: 39, a: PLAYERS[0]!, b: PLAYERS[4]!, cardA: "claude-fable-5", cardB: "deepseek-v4.1-flash", arena: 2, round: 2, winsA: 1, winsB: 1, pot: 0.2, priceA: 0.64, watchers: 128, duel: true },
  { id: 36, a: PLAYERS[1]!, b: PLAYERS[6]!, cardA: "grok-4.20", cardB: "gemini-3.8-flash", arena: 3, round: 1, winsA: 1, winsB: 0, pot: 0.1, priceA: 0.71, watchers: 54 },
  { id: 35, a: PLAYERS[2]!, b: PLAYERS[7]!, cardA: "claude-opus-5.5", cardB: "glm-5.3", arena: 0, round: 0, winsA: 0, winsB: 0, pot: 0.5, priceA: 0.58, watchers: 211 },
  { id: 33, a: PLAYERS[3]!, b: PLAYERS[8]!, cardA: "kimi-k3", cardB: "gpt-5.6-sol", arena: 5, round: 1, winsA: 0, winsB: 1, pot: 0.05, priceA: 0.39, watchers: 37 },
];

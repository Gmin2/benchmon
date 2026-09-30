import { useEffect, useRef, useState } from "react";
import { keccak256, parseEventLogs, toHex, type Address, type Hex } from "viem";
import { duelAbi } from "./abi";
import { BACKEND, CONTRACTS, GAS, commitHash, loadPick, pub, readMatch, savePick, sendPick, type Match } from "./chain";

export const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const ZERO = "0x0000000000000000000000000000000000000000";

// the wallet's write, loosened so the calls below stay short
type AnyWrite = (p: { address: Address; abi: typeof duelAbi; functionName: string; args?: readonly unknown[]; value?: bigint; gas?: bigint }) => Promise<Hex>;
const duel = (write: AnyWrite, functionName: string, args: readonly unknown[], gas: bigint, value?: bigint) =>
  write({ address: CONTRACTS.duel, abi: duelAbi, functionName, args, gas, value });

export const offerOf = (bits: number) => [0, 1, 2, 3, 4, 5].filter((a) => bits & (1 << a));
export const isMine = (m: Match, me?: string) => Boolean(me) && [m.a, m.b].some((p) => p.toLowerCase() === me!.toLowerCase());

// ---------- rounds ----------

// a round settles in the same tx as the second reveal, so it is read off the round counter moving:
// cardA and cardB stay in the struct after the round advances, and the wins tell who took it
export type RoundLog = { round: number; arena: number; cardA: number; cardB: number; winner: 0 | 1 | 2; picked?: "a" | "b" };
const rkey = (id: bigint) => `benchmon:rounds:${CONTRACTS.duel}:${id}`;
export function loadRounds(id: bigint): RoundLog[] {
  try {
    return JSON.parse(localStorage.getItem(rkey(id)) ?? "[]");
  } catch {
    return [];
  }
}
function saveRounds(id: bigint, list: RoundLog[]) {
  localStorage.setItem(rkey(id), JSON.stringify(list));
}

// who picked the arena of each round, seen while the pick was open
const pkey = (id: bigint) => `benchmon:pickers:${CONTRACTS.duel}:${id}`;
function pickers(id: bigint): Record<number, "a" | "b"> {
  try {
    return JSON.parse(localStorage.getItem(pkey(id)) ?? "{}");
  } catch {
    return {};
  }
}

export const pickerOf = (id: bigint, round: number): "a" | "b" | undefined => pickers(id)[round];

export function trackRounds(id: bigint, prev: Match | undefined, next: Match): RoundLog[] {
  const list = loadRounds(id);
  if (next.picker !== ZERO) {
    const p = pickers(id);
    p[next.round] = next.picker.toLowerCase() === next.a.toLowerCase() ? "a" : "b";
    localStorage.setItem(pkey(id), JSON.stringify(p));
  }
  if (!prev || next.state === 0) return list;
  const settled = next.round > prev.round || (next.state === 2 && prev.state === 1);
  if (!settled || list.some((r) => r.round === prev.round)) return list;
  // a match that ended by timeout has no cards for the last round
  if (next.state === 2 && next.round === prev.round) return list;
  const winner = next.winsA > prev.winsA ? 1 : next.winsB > prev.winsB ? 2 : 0;
  list.push({ round: prev.round, arena: prev.arena, cardA: next.cardA, cardB: next.cardB, winner, picked: pickers(id)[prev.round] });
  list.sort((a, b) => a.round - b.round);
  saveRounds(id, list);
  return list;
}

// ---------- live duel transcript ----------

export type Transcript = {
  prompt: string;
  a: { model: string; text: string; ms: number; costUsd: number; correct: boolean };
  b: { model: string; text: string; ms: number; costUsd: number; correct: boolean };
  reason: string;
  outcome: 0 | 1 | 2;
};

export async function loadTranscript(id: bigint): Promise<Transcript | null> {
  const r = await fetch(`${BACKEND}/duel/${id}`).catch(() => null);
  if (!r?.ok) return null;
  const t = await r.json();
  const side = (s: { model: string; text: string; ms: number; costUsd: number; correct?: boolean }) => ({ ...s, correct: Boolean(s.correct) });
  return { prompt: t.prompt?.text ?? "", a: side(t.a), b: side(t.b), reason: t.reason, outcome: t.outcome };
}

// ---------- the match, polled ----------

export function useMatch(id: bigint | null, me?: Address) {
  const [m, setM] = useState<Match>();
  const [rounds, setRounds] = useState<RoundLog[]>([]);
  const [owed, setOwed] = useState(0n);
  const prev = useRef<Match>(undefined);

  useEffect(() => {
    if (id === null) return;
    let alive = true;
    prev.current = undefined;
    setM(undefined);
    setRounds(loadRounds(id));
    const tick = async () => {
      try {
        const next = await readMatch(id);
        if (!alive) return;
        setRounds(trackRounds(id, prev.current, next));
        prev.current = next;
        setM(next);
        if (me) setOwed(await pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "owed", args: [me] }));
      } catch {
        // the rpc drops the odd read, the next tick catches up
      }
    };
    tick();
    const t = setInterval(tick, 1500);
    // background tabs get their timers throttled, so catch up the moment the tab is visible again
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, me]);

  return { m, rounds, owed };
}

// unclaimed winnings and refunds in the duel contract
export function useOwed(me?: Address) {
  const [owed, setOwed] = useState(0n);
  useEffect(() => {
    if (!me) return;
    let alive = true;
    const tick = () =>
      pub
        .readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "owed", args: [me] })
        .then((o) => alive && setOwed(o))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [me]);
  return [owed, setOwed] as const;
}

// ---------- actions ----------

async function createdId(hash: Hex): Promise<bigint> {
  const r = await pub.waitForTransactionReceipt({ hash });
  const ev = parseEventLogs({ abi: duelAbi, logs: r.logs, eventName: "Created" })[0];
  if (!ev) throw new Error("no match was created");
  return ev.args.id;
}

export async function createMatch(write: AnyWrite, deck: number[], stake: bigint) {
  return createdId(await duel(write, "create", [deck], GAS.create, stake));
}

export async function joinMatch(write: AnyWrite, id: bigint, deck: number[], stake: bigint) {
  await duel(write, "join", [id, deck], GAS.join, stake);
  return id;
}

export type OpenSeat = { id: bigint; m: Match };

// the newest matches still waiting for a second player, most recent first
export async function openSeats(limit = 20): Promise<OpenSeat[]> {
  const count = await pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "matchCount" });
  const ids: bigint[] = [];
  for (let i = count - 1n; i >= 0n && ids.length < limit; i--) ids.push(i);
  const all = await Promise.all(ids.map(async (id) => ({ id, m: await readMatch(id) })));
  return all.filter((x) => x.m.state === 0);
}

// my matches that are not finished, so a closed tab can get back in
export async function myActive(me: Address, limit = 20): Promise<OpenSeat[]> {
  const count = await pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "matchCount" });
  const ids: bigint[] = [];
  for (let i = count - 1n; i >= 0n && ids.length < limit; i--) ids.push(i);
  const all = await Promise.all(ids.map(async (id) => ({ id, m: await readMatch(id) })));
  return all.filter((x) => x.m.state !== 2 && isMine(x.m, me));
}

// quick match: take the oldest open seat at this stake that is not mine, or open one and wait
export async function quickMatch(write: AnyWrite, me: Address, deck: number[], stake: bigint) {
  const seats = (await openSeats()).filter((s) => s.m.stake === stake && s.m.a.toLowerCase() !== me.toLowerCase()).reverse();
  for (const s of seats) {
    try {
      return await joinMatch(write, s.id, deck, stake);
    } catch {
      // someone else took the seat first, try the next
    }
  }
  const mine = (await openSeats()).find((s) => s.m.stake === stake && s.m.a.toLowerCase() === me.toLowerCase());
  if (mine) return mine.id;
  return createMatch(write, deck, stake);
}

// commit the pick, keep it in this browser and hand it to the backend so it reveals even if the tab closes
export async function lockCard(write: AnyWrite, id: bigint, round: number, me: Address, card: number) {
  const salt = keccak256(toHex(crypto.getRandomValues(new Uint8Array(32))));
  savePick(id, round, me, card, salt);
  await duel(write, "commit", [id, commitHash(id, round, me, card, salt)], GAS.commit);
  sendPick(id, round, me, card, salt).catch((e: Error) => console.log(`bm: ${e.message}`));
}

// our own reveal, a backup for when the backend relay is down
export async function revealMine(write: AnyWrite, id: bigint, m: Match, me: Address) {
  const pick = loadPick(id, m.round, me);
  if (!pick) return false;
  await duel(write, "reveal", [id, pick.card, pick.salt], GAS.reveal);
  return true;
}

export const pickArena = (write: AnyWrite, id: bigint, arena: number) => duel(write, "pickArena", [id, arena], GAS.pick);
export const skipPick = (write: AnyWrite, id: bigint) => duel(write, "skipPick", [id], GAS.pick);
export const claimTimeout = (write: AnyWrite, id: bigint) => duel(write, "claimTimeout", [id], GAS.timeout);
export const settleByStats = (write: AnyWrite, id: bigint) => duel(write, "settleLiveByStats", [id], GAS.timeout);
export const cancelMatch = (write: AnyWrite, id: bigint) => duel(write, "cancel", [id], GAS.cancel);
export const withdraw = (write: AnyWrite) => duel(write, "withdraw", [], GAS.withdraw);

export type { AnyWrite };

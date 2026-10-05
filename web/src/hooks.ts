import { useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import { duelAbi } from "./abi";
import { CONTRACTS, loadCards, pub, type Card } from "./chain";
import { ROSTER } from "./mockRoster";

// fallback until the chain answers, the contract holds the real cap
const CAP = 1600;

let cardsCache: Card[] | null = null;
let capCache: number | null = null;
let cardsLoad: Promise<Card[]> | null = null;

// current stats from the chain once loaded, the bundled roster until then. the roster also keeps names, labs and art
export const byId = (id: number) => cardsCache?.find((c) => c.id === id) ?? ROSTER.find((c) => c.id === id) ?? { id, name: `card-${id}`, stats: [0, 0, 0, 0, 0, 0] as const };
export const byName = (n: string) => cardsCache?.find((c) => c.name === n) ?? ROSTER.find((c) => c.name === n)!;
export const roster = () => cardsCache ?? ROSTER;
export const deckCap = () => capCache ?? CAP;

async function load() {
  const [cards, cap] = await Promise.all([loadCards(), pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "deckCap" }).catch(() => null)]);
  if (cap !== null) capCache = Number(cap);
  return cards;
}

// the roster rarely changes, so every screen shares one load. screens that show stats call this so they redraw once it lands
export function useCards() {
  const [cards, setCards] = useState<Card[]>(cardsCache ?? []);
  useEffect(() => {
    if (cardsCache) return;
    let alive = true;
    const go = () => {
      cardsLoad ??= load();
      cardsLoad
        .then((c) => {
          cardsCache = c;
          if (alive) setCards(c);
        })
        .catch(() => {
          cardsLoad = null;
          if (alive) setTimeout(go, 2000);
        });
    };
    go();
    return () => {
      alive = false;
    };
  }, []);
  return cards;
}

export function deckOf(mask: bigint, cards: Card[]) {
  return cards.filter((c) => (mask >> BigInt(c.id)) & 1n);
}

export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fn()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setErr("");
        })
        .catch((e: Error) => alive && setErr(e.message.split("\n")[0]!));
    tick();
    // a hidden tab stops polling and catches up when it is shown again
    const t = setInterval(() => document.visibilityState === "visible" && tick(), ms);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, err };
}

export function useBalance(address?: Address) {
  const { data } = usePoll(async () => (address ? Number(formatEther(await pub.getBalance({ address }))) : 0), 6000, [address]);
  return data ?? 0;
}

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

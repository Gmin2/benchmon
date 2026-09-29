import { useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import { loadCards, pub, type Card } from "./chain";

let cardsCache: Card[] | null = null;
let cardsLoad: Promise<Card[]> | null = null;

// the roster rarely changes, so every screen shares one load
export function useCards() {
  const [cards, setCards] = useState<Card[]>(cardsCache ?? []);
  useEffect(() => {
    if (cardsCache) return;
    let alive = true;
    const go = () => {
      cardsLoad ??= loadCards();
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
    const t = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(t);
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

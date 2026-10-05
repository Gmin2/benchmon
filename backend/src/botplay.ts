// how the house bot plays, kept free of chain calls so it can be tested on its own
import type { Stats } from "./rules";

export type CardStat = { id: number; stats: Stats };
const power = (s: Stats) => s.reduce((a, b) => a + b, 0);

// a legal deck: five different cards under the cap. it takes a random one from the stronger half of the
// legal decks it finds, so it plays well without always bringing the same five
export function botDeck(cards: CardStat[], cap: number, rand = Math.random): number[] {
  const legal: { ids: number[]; p: number }[] = [];
  for (let i = 0; i < 400 && cards.length >= 5; i++) {
    const pick = [...cards].sort(() => rand() - 0.5).slice(0, 5);
    const p = pick.reduce((a, c) => a + power(c.stats), 0);
    if (p <= cap) legal.push({ ids: pick.map((c) => c.id).sort((a, b) => a - b), p });
  }
  if (!legal.length) throw new Error("no legal deck under the cap");
  legal.sort((a, b) => b.p - a.p);
  const top = legal.slice(0, Math.max(1, Math.ceil(legal.length / 2)));
  return top[Math.floor(rand() * top.length)]!.ids;
}

// mostly its best card for the arena, sometimes a random one so it cannot be read
export function botCard(left: CardStat[], arena: number, rand = Math.random): number {
  if (!left.length) throw new Error("no cards left");
  if (rand() < 0.25) return left[Math.floor(rand() * left.length)]!.id;
  return [...left].sort((a, b) => b.stats[arena]! - a.stats[arena]!)[0]!.id;
}

// after losing a round it names the offered arena where its best remaining card is strongest
export function botArena(left: CardStat[], offer: number): number {
  let best = -1;
  let score = -1;
  for (let a = 0; a < 6; a++) {
    if ((offer & (1 << a)) === 0) continue;
    const top = Math.max(...left.map((c) => c.stats[a]!));
    if (top > score) [best, score] = [a, top];
  }
  if (best < 0) throw new Error("empty offer");
  return best;
}

export const idsOf = (bits: bigint) => {
  const out: number[] = [];
  for (let i = 0; bits > 0n; i++, bits >>= 1n) if (bits & 1n) out.push(i);
  return out;
};

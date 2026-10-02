import type { Card } from "../chain";
import { ARENAS, typeOf } from "../rules";
import { LAB_COLORS, LAB_OF } from "./generated";

export type Rarity = "common" | "rare" | "legendary";
export type CardType = "reasoning" | "speed" | "cost";
export type Arena = (typeof ARENAS)[number];

export const TYPES: CardType[] = ["reasoning", "speed", "cost"];
export const BEATS: Record<CardType, CardType> = { reasoning: "speed", speed: "cost", cost: "reasoning" };

export const power = (c: Card) => c.stats.reduce((a, b) => a + b, 0);
export const rarityOf = (p: number): Rarity => (p >= 390 ? "legendary" : p >= 320 ? "rare" : "common");

export type CardInfo = {
  card: Card;
  display: string;
  lab: string;
  main: string;
  accent: string;
  type: CardType;
  rarity: Rarity;
  power: number;
  stats: Record<Arena, number>;
};

// short enough for the card header: "claude-opus-5.5" -> "claude opus 5.5"
export const displayName = (name: string) => name.replace(/-/g, " ");

export function infoOf(card: Card): CardInfo {
  const lab = LAB_OF[card.name] ?? "unknown";
  const colors = LAB_COLORS[lab] ?? { main: "#888888", accent: "#dddddd" };
  const p = power(card);
  return {
    card,
    display: displayName(card.name),
    lab,
    main: colors.main,
    accent: colors.accent,
    type: TYPES[typeOf(card.stats)]!,
    rarity: rarityOf(p),
    power: p,
    stats: Object.fromEntries(ARENAS.map((a, i) => [a, card.stats[i]!])) as Record<Arena, number>,
  };
}

// art tier follows rarity until evolution history is wired in
export const tierOf = (i: CardInfo) => (i.rarity === "legendary" ? 3 : i.rarity === "rare" ? 2 : 1);
export const artOf = (name: string, tier: number) => `/art/cards/${name}-t${tier}-plain@1x.png`;

// the round scoring from Duel._byStats, mirrored for previews and scripts
export type Stats = readonly [number, number, number, number, number, number];

export const ARENAS = ["code", "math", "reasoning", "speed", "cost", "honesty"] as const;

// 0 reasoning, 1 speed, 2 cost
export function typeOf(s: Stats): 0 | 1 | 2 {
  if (s[2] >= s[3] && s[2] >= s[4]) return 0;
  if (s[3] >= s[4]) return 1;
  return 2;
}

// 1 if a wins the arena, 2 if b wins, 0 on a tie
export function roundWinner(a: Stats, b: Stats, arena: number): 0 | 1 | 2 {
  let sa = a[arena]! * 10;
  let sb = b[arena]! * 10;
  const ta = typeOf(a);
  const tb = typeOf(b);
  if ((ta + 1) % 3 === tb) sa = Math.floor((sa * 11) / 10);
  else if ((tb + 1) % 3 === ta) sb = Math.floor((sb * 11) / 10);
  return sa > sb ? 1 : sb > sa ? 2 : 0;
}

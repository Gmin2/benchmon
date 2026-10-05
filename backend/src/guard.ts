// decides whether a live duel is worth the model calls. a skipped duel is left alone: once VERDICT_TIMEOUT
// (10 min) passes anyone can call Duel.settleLiveByStats and the round goes by stats instead.
export type LiveMatch = { stake: bigint; a: string; b: string };

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export function liveGuard(o: { minStake: bigint; perDay: number }) {
  let day = "";
  // only today is kept, so this never grows past one entry per player seen today
  let counts = new Map<string, number>();
  return {
    // returns why the duel is skipped, or null after counting it for both players
    check(m: LiveMatch, now = Date.now()): string | null {
      if (m.stake < o.minStake) return `stake ${m.stake} is under the live duel minimum ${o.minStake}`;
      const d = dayOf(now);
      if (d !== day) {
        day = d;
        counts = new Map();
      }
      const players = [...new Set([m.a.toLowerCase(), m.b.toLowerCase()])];
      const over = players.find((p) => (counts.get(p) ?? 0) >= o.perDay);
      if (over) return `${over} already had ${o.perDay} live duels today`;
      for (const p of players) counts.set(p, (counts.get(p) ?? 0) + 1);
      return null;
    },
  };
}

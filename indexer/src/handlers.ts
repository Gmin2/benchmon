import { indexer, type Card, type Player } from "envio";

const n = (v: bigint | number) => Number(v);

const newPlayer = (id: string): Player => ({ id, matches: 0, wins: 0, losses: 0, draws: 0, staked: 0n, won: 0n, roundsWon: 0 });

const newCard = (id: number): Card => ({
  id: String(id),
  name: "",
  stats: [],
  version: 0n,
  plays: 0,
  roundWins: 0,
  roundLosses: 0,
  roundDraws: 0,
  liveDuels: 0,
  liveDuelWins: 0,
});

indexer.onEvent({ contract: "Duel", event: "Created", fields: { block: ["timestamp"] } }, async ({ event, context }) => {
  const a = event.params.a.toLowerCase();
  context.Match.set({
    id: event.params.id.toString(),
    a,
    b: undefined,
    stake: event.params.stake,
    state: "open",
    arena: undefined,
    winsA: 0,
    winsB: 0,
    result: undefined,
    winner: undefined,
    payout: undefined,
    liveDuelHash: undefined,
    liveVerdictByJudge: undefined,
    backedA: 0n,
    backedB: 0n,
    marketTrades: 0,
    lastPriceA: undefined,
    createdAt: n(event.block.timestamp),
    finishedAt: undefined,
  });
  const p = (await context.Player.get(a)) ?? newPlayer(a);
  context.Player.set({ ...p, staked: p.staked + event.params.stake });
});

indexer.onEvent({ contract: "Duel", event: "Joined" }, async ({ event, context }) => {
  const m = await context.Match.get(event.params.id.toString());
  if (!m) return;
  const b = event.params.b.toLowerCase();
  context.Match.set({ ...m, b, state: "playing", arena: n(event.params.arena) });
  const p = (await context.Player.get(b)) ?? newPlayer(b);
  context.Player.set({ ...p, staked: p.staked + m.stake });
});

indexer.onEvent({ contract: "Duel", event: "Revealed" }, async ({ event, context }) => {
  const id = event.params.id.toString();
  const m = await context.Match.get(id);
  if (!m) return;
  const round = n(event.params.round);
  const rid = `${id}-${round}`;
  const r = (await context.Round.get(rid)) ?? { id: rid, match_id: id, round, arena: m.arena ?? 0, cardA: undefined, cardB: undefined, winner: undefined, live: false };
  const isA = event.params.player.toLowerCase() === m.a;
  const cardId = n(event.params.card);
  context.Round.set(isA ? { ...r, cardA: cardId } : { ...r, cardB: cardId });
  const c = (await context.Card.get(String(cardId))) ?? newCard(cardId);
  context.Card.set({ ...c, plays: c.plays + 1 });
});

indexer.onEvent({ contract: "Duel", event: "LiveDuel" }, async ({ event, context }) => {
  const id = event.params.id.toString();
  const rid = `${id}-2`;
  const r = await context.Round.get(rid);
  if (r) context.Round.set({ ...r, live: true });
  for (const cid of [n(event.params.cardA), n(event.params.cardB)]) {
    const c = (await context.Card.get(String(cid))) ?? newCard(cid);
    context.Card.set({ ...c, liveDuels: c.liveDuels + 1 });
  }
});

indexer.onEvent({ contract: "Duel", event: "Verdict" }, async ({ event, context }) => {
  const id = event.params.id.toString();
  const m = await context.Match.get(id);
  if (!m) return;
  context.Match.set({ ...m, liveDuelHash: event.params.duelHash, liveVerdictByJudge: event.params.byJudge });
  const r = await context.Round.get(`${id}-2`);
  const outcome = n(event.params.outcome);
  const winnerCard = outcome === 1 ? r?.cardA : outcome === 2 ? r?.cardB : undefined;
  if (winnerCard !== undefined) {
    const c = (await context.Card.get(String(winnerCard))) ?? newCard(winnerCard);
    context.Card.set({ ...c, liveDuelWins: c.liveDuelWins + 1 });
  }
});

indexer.onEvent({ contract: "Duel", event: "RoundWon" }, async ({ event, context }) => {
  const id = event.params.id.toString();
  const m = await context.Match.get(id);
  if (!m) return;
  const winner = event.params.winner.toLowerCase();
  const zero = "0x0000000000000000000000000000000000000000";
  const aWon = winner === m.a;
  const bWon = winner !== zero && !aWon;
  context.Match.set({ ...m, winsA: m.winsA + (aWon ? 1 : 0), winsB: m.winsB + (bWon ? 1 : 0), arena: n(event.params.nextArena) });
  const rid = `${id}-${n(event.params.round)}`;
  const r = await context.Round.get(rid);
  if (r) {
    context.Round.set({ ...r, winner: winner === zero ? undefined : winner });
    if (r.cardA !== undefined && r.cardB !== undefined) {
      const ca = (await context.Card.get(String(r.cardA))) ?? newCard(r.cardA);
      const cb = (await context.Card.get(String(r.cardB))) ?? newCard(r.cardB);
      if (winner === zero) {
        context.Card.set({ ...ca, roundDraws: ca.roundDraws + 1 });
        context.Card.set({ ...cb, roundDraws: cb.roundDraws + 1 });
      } else {
        context.Card.set({ ...ca, roundWins: ca.roundWins + (aWon ? 1 : 0), roundLosses: ca.roundLosses + (aWon ? 0 : 1) });
        context.Card.set({ ...cb, roundWins: cb.roundWins + (bWon ? 1 : 0), roundLosses: cb.roundLosses + (bWon ? 0 : 1) });
      }
    }
  }
  if (winner !== zero) {
    const p = (await context.Player.get(winner)) ?? newPlayer(winner);
    context.Player.set({ ...p, roundsWon: p.roundsWon + 1 });
  }
});

// the loser of a round picked the next arena, or it was drawn from the offer after the pick timed out
indexer.onEvent({ contract: "Duel", event: "ArenaPicked" }, async ({ event, context }) => {
  const m = await context.Match.get(event.params.id.toString());
  if (m) context.Match.set({ ...m, arena: n(event.params.arena) });
});

indexer.onEvent({ contract: "Duel", event: "Finished", fields: { block: ["timestamp"] } }, async ({ event, context }) => {
  const id = event.params.id.toString();
  const m = await context.Match.get(id);
  if (!m) return;
  const winner = event.params.winner.toLowerCase();
  const zero = "0x0000000000000000000000000000000000000000";
  const draw = winner === zero;
  context.Match.set({
    ...m,
    state: "done",
    result: draw ? "draw" : winner === m.a ? "a" : "b",
    winner: draw ? undefined : winner,
    payout: event.params.payout,
    finishedAt: n(event.block.timestamp),
  });
  for (const addr of [m.a, m.b]) {
    if (!addr) continue;
    const p = (await context.Player.get(addr)) ?? newPlayer(addr);
    const won = !draw && addr === winner;
    context.Player.set({
      ...p,
      matches: p.matches + 1,
      wins: p.wins + (won ? 1 : 0),
      losses: p.losses + (!draw && !won ? 1 : 0),
      draws: p.draws + (draw ? 1 : 0),
      won: p.won + (won ? event.params.payout : draw ? m.stake : 0n),
    });
  }
});

indexer.onEvent({ contract: "Duel", event: "Cancelled" }, async ({ event, context }) => {
  const m = await context.Match.get(event.params.id.toString());
  if (m) context.Match.set({ ...m, state: "cancelled", result: "cancelled" });
});

indexer.onEvent(
  { contract: "CardStats", event: "CardSet", fields: { block: ["timestamp"], transaction: ["hash"] } },
  async ({ event, context }) => {
    const id = n(event.params.id);
    const c = (await context.Card.get(String(id))) ?? newCard(id);
    const stats = event.params.stats.map(n);
    context.Card.set({ ...c, name: event.params.name || c.name, stats, version: event.params.version });
    context.CardUpdate.set({
      id: `${id}-${event.params.version}`,
      card_id: String(id),
      version: event.params.version,
      stats,
      timestamp: n(event.block.timestamp),
      txHash: event.transaction.hash,
    });
  },
);

indexer.onEvent({ contract: "Backing", event: "Backed" }, async ({ event, context }) => {
  const m = await context.Match.get(event.params.id.toString());
  if (!m) return;
  const side = n(event.params.side);
  context.Match.set(
    side === 1 ? { ...m, backedA: m.backedA + event.params.amount } : { ...m, backedB: m.backedB + event.params.amount },
  );
});

indexer.onEvent({ contract: "MatchMarket", event: "Traded", fields: { block: ["timestamp"], transaction: ["hash"] } }, async ({ event, context }) => {
  const id = event.params.id.toString();
  context.Trade.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    matchId: id,
    trader: event.params.who.toLowerCase(),
    side: n(event.params.side),
    shares: event.params.shares,
    cost: event.params.cost,
    priceA: event.params.priceA,
    timestamp: n(event.block.timestamp),
  });
  const m = await context.Match.get(id);
  if (m) context.Match.set({ ...m, marketTrades: m.marketTrades + 1, lastPriceA: event.params.priceA });
});

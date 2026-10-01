import { formatEther, type Address } from "viem";
import { backingAbi, duelAbi, matchMarketAbi } from "./abi";
import { CONTRACTS, pub, recentMatches, type Match } from "./chain";

export type MarketRow = {
  id: bigint;
  match: Match;
  b: number; // liquidity, in MON
  qA: number;
  qB: number;
  pool: number; // collateral in MON
  priceA: number; // 0..1, what one share of a costs right now
  open: boolean; // a market exists
  trading: boolean; // a market exists and it is still before the first reveal
  betting: boolean; // backing and trading stay open until the first card of the match is revealed
  poolA: number; // backing pool per side, in MON
  poolB: number;
};

const wad = (x: bigint) => Number(formatEther(x));

export async function loadMarkets(limit = 12): Promise<MarketRow[]> {
  const list = await recentMatches(limit);
  const reads = await Promise.all(
    list.map(async ({ id, m }) => {
      const [mk, p, betting, poolA, poolB] = await Promise.all([
        pub.readContract({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "markets", args: [id] }),
        pub.readContract({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "priceA", args: [id] }),
        pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "bettingOpen", args: [id] }).catch(() => false),
        pub.readContract({ address: CONTRACTS.backing, abi: backingAbi, functionName: "totals", args: [id, 1n] }),
        pub.readContract({ address: CONTRACTS.backing, abi: backingAbi, functionName: "totals", args: [id, 2n] }),
      ]);
      const [b, qA, qB, collateral] = mk as readonly [bigint, bigint, bigint, bigint, bigint, boolean];
      return {
        id,
        match: m,
        b: wad(b),
        qA: wad(qA),
        qB: wad(qB),
        pool: wad(collateral),
        priceA: wad(p as bigint),
        open: b > 0n,
        trading: b > 0n && Boolean(betting),
        betting: Boolean(betting),
        poolA: wad(poolA as bigint),
        poolB: wad(poolB as bigint),
      } satisfies MarketRow;
    }),
  );
  return reads;
}

// lmsr cost, same formula as MatchMarket.cost, in floats for quoting only
export function lmsrCost(b: number, qA: number, qB: number) {
  const hi = Math.max(qA, qB);
  return hi + b * Math.log(Math.exp((qA - hi) / b) + Math.exp((qB - hi) / b));
}

// what `amount` shares of a side cost to buy, or pay back when sold
export function quote(m: MarketRow, side: 1 | 2, amount: number, sell = false) {
  if (!m.open || amount <= 0) return 0;
  const before = lmsrCost(m.b, m.qA, m.qB);
  const d = sell ? -amount : amount;
  const after = side === 1 ? lmsrCost(m.b, m.qA + d, m.qB) : lmsrCost(m.b, m.qA, m.qB + d);
  return Math.abs(after - before);
}

// how many shares `mon` buys right now: the inverse of quote, by bisection since lmsr cost is monotonic
export function sharesFor(m: MarketRow, side: 1 | 2, mon: number) {
  if (!m.open || mon <= 0) return 0;
  let lo = 0;
  let hi = mon * 1000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (quote(m, side, mid) > mon) hi = mid;
    else lo = mid;
  }
  return lo;
}

export function priceAfter(m: MarketRow, side: 1 | 2, amount: number, sell = false) {
  const d = sell ? -amount : amount;
  const qA = side === 1 ? m.qA + d : m.qA;
  const qB = side === 2 ? m.qB + d : m.qB;
  return 1 / (1 + Math.exp((qB - qA) / m.b));
}

export async function sharesOf(id: bigint, who: Address) {
  const [a, b] = await Promise.all([1n, 2n].map((s) => pub.readContract({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "shares", args: [id, who, s] })));
  return { a: wad(a as bigint), b: wad(b as bigint) };
}

export async function redeemableOf(id: bigint, who: Address) {
  return wad((await pub.readContract({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "redeemable", args: [id, who] })) as bigint);
}

// what one address backed on each side and what it can claim once the match is over
export async function backedOf(id: bigint, who: Address) {
  const [a, b, claim] = await Promise.all([
    pub.readContract({ address: CONTRACTS.backing, abi: backingAbi, functionName: "backed", args: [id, who, 1n] }),
    pub.readContract({ address: CONTRACTS.backing, abi: backingAbi, functionName: "backed", args: [id, who, 2n] }),
    pub.readContract({ address: CONTRACTS.backing, abi: backingAbi, functionName: "claimable", args: [id, who] }),
  ]);
  return { a: wad(a as bigint), b: wad(b as bigint), claim: wad(claim as bigint) };
}

// a pool payout: the whole pool split pro rata among the winning side
export function poolPayout(stakeSide: number, otherSide: number, amount: number) {
  return amount <= 0 ? 0 : (amount * (stakeSide + otherSide + amount)) / (stakeSide + amount);
}

// price history kept in this browser: the opening price, then every change seen while a page is open
export type Sample = { t: number; v: number };
const hkey = (id: bigint) => `benchmon:price:${CONTRACTS.market}:${id}`;
export function loadHistory(id: bigint): Sample[] {
  try {
    return JSON.parse(localStorage.getItem(hkey(id)) ?? "[]");
  } catch {
    return [];
  }
}
export function pushSample(id: bigint, v: number): Sample[] {
  const h = loadHistory(id);
  const now = Date.now();
  if (h.length === 0) h.push({ t: now - 60_000, v: 0.5 });
  const last = h[h.length - 1]!;
  if (Math.abs(last.v - v) > 1e-6) h.push({ t: now, v });
  localStorage.setItem(hkey(id), JSON.stringify(h.slice(-500)));
  return h;
}

export const cents = (v: number) => `${(v * 100).toFixed(1)}¢`;
export const mon = (v: number, d = 3) => `${v.toFixed(d)} MON`;

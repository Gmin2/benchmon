import { createPublicClient, encodeAbiParameters, http, keccak256, type Address, type Hex } from "viem";
import { cardStatsAbi, duelAbi } from "./abi";
import { INDEXER, matchIds } from "./indexer";
import type { Stats } from "./rules";

// alchemy first: the public monad rpc caps a client at 15 requests a second
export const RPC = import.meta.env.VITE_ALCHEMY_API_KEY
  ? `https://monad-testnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`
  : "https://testnet-rpc.monad.xyz";
// batch calls into one json-rpc request
export const pub = createPublicClient({ transport: http(RPC, { batch: { wait: 30 } }) });

// current testnet set, see contracts/README.md
export const CONTRACTS = {
  cards: "0xD27730D0482746B1e0BD702429C2A9AB98d141Fb" as Address,
  duel: "0xC110B9Ee0845Ed76D722Ccec3111302D56d1cA61" as Address,
  backing: "0x966B8773B281589bFE3E83C7153a64B7E192a9F5" as Address,
  market: "0x52CE235DCF1Afa5d4AF427BE9Df039c7797Fa35B" as Address,
};

// monad charges the gas limit, not gas used, so limits sit just above what the tests measured
export const GAS = { create: 350_000n, join: 450_000n, commit: 100_000n, reveal: 350_000n, withdraw: 80_000n, cancel: 90_000n, timeout: 250_000n, pick: 80_000n };

export type Card = { id: number; name: string; stats: Stats };

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

// one multicall for the whole roster instead of two reads per card, the public rpc rate limits bursts
export async function loadCards(): Promise<Card[]> {
  const n = Number(await pub.readContract({ address: CONTRACTS.cards, abi: cardStatsAbi, functionName: "cardCount" }));
  const ids = Array.from({ length: n }, (_, i) => BigInt(i));
  const res = await pub.multicall({
    multicallAddress: MULTICALL3,
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { address: CONTRACTS.cards, abi: cardStatsAbi, functionName: "names", args: [id] } as const,
      { address: CONTRACTS.cards, abi: cardStatsAbi, functionName: "statsOf", args: [id] } as const,
    ]),
  });
  return ids.map((id, i) => ({ id: Number(id), name: res[2 * i] as string, stats: res[2 * i + 1] as unknown as Stats }));
}

export const readMatch = (id: bigint) => pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "getMatch", args: [id] });
export type Match = Awaited<ReturnType<typeof readMatch>>;

// the newest match ids straight from the contract, the fallback when there is no indexer
export async function newestIds(limit: number) {
  const count = await pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "matchCount" });
  const ids: bigint[] = [];
  for (let i = count - 1n; i >= 0n && ids.length < limit; i--) ids.push(i);
  return ids;
}

// ids from the indexer when it answers, else a scan of the newest ones. the caller reads and filters the
// matches themselves, so a lagging indexer never shows a stale state
export async function idsWhere(where: Record<string, unknown>, limit: number) {
  if (INDEXER) {
    try {
      return await matchIds(where, limit);
    } catch {
      // fall through to the chain
    }
  }
  return newestIds(limit);
}

export const readMatches = (ids: bigint[]) => Promise.all(ids.map(async (id) => ({ id, m: await readMatch(id) })));

export function commitHash(id: bigint, round: number, player: Address, card: number, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "uint16" }, { type: "bytes32" }],
      [id, round, player, card, salt],
    ),
  );
}

// the pick and its salt live in the browser until the reveal, so a refresh does not lose them
const key = (id: bigint, round: number, player: Address) => `benchmon:pick:${id}:${round}:${player.toLowerCase()}`;
export function savePick(id: bigint, round: number, player: Address, card: number, salt: Hex) {
  localStorage.setItem(key(id, round, player), JSON.stringify({ card, salt }));
}
export function loadPick(id: bigint, round: number, player: Address): { card: number; salt: Hex } | null {
  const v = localStorage.getItem(key(id, round, player));
  return v ? JSON.parse(v) : null;
}

// the backend: reveals, live duels, profiles. localhost only in the dev server, vite.config.ts fails a
// production build without VITE_BACKEND_URL
export const BACKEND = (import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? "http://localhost:8788" : "")).replace(/\/$/, "");

// hand the pick to the backend so it can reveal even if this tab is closed or in the background
export async function sendPick(id: bigint, round: number, player: Address, card: number, salt: Hex) {
  const res = await fetch(`${BACKEND}/pick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: id.toString(), round, player, card, salt }),
  });
  const j = (await res.json()) as { ok: boolean; error?: string };
  if (!j.ok) throw new Error(`relay: ${j.error}`);
}

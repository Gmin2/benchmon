import { createPublicClient, encodeAbiParameters, http, keccak256, type Address, type Hex } from "viem";
import { cardStatsAbi, duelAbi } from "./abi";
import type { Stats } from "./rules";

export const RPC = "https://testnet-rpc.monad.xyz";
// batch calls into one json-rpc request; the public rpc allows about 50 requests a second
export const pub = createPublicClient({ transport: http(RPC, { batch: { wait: 30 } }) });

// current testnet set, see contracts/README.md
export const CONTRACTS = {
  cards: "0xDa6f2436E78d4CD7490Df5F0D593055CfAa62345" as Address,
  duel: "0x2d212A3898139EdEE5b27A2FCA8063edf9d51805" as Address,
};

// monad charges the gas limit, not gas used, so limits sit just above what the tests measured
export const GAS = { create: 350_000n, join: 450_000n, commit: 100_000n, reveal: 350_000n, withdraw: 80_000n, cancel: 90_000n, timeout: 250_000n };

export type Card = { id: number; name: string; stats: Stats };

export async function loadCards(): Promise<Card[]> {
  const n = Number(await pub.readContract({ address: CONTRACTS.cards, abi: cardStatsAbi, functionName: "cardCount" }));
  return Promise.all(
    Array.from({ length: n }, async (_, id) => {
      const [name, stats] = await Promise.all([
        pub.readContract({ address: CONTRACTS.cards, abi: cardStatsAbi, functionName: "names", args: [BigInt(id)] }),
        pub.readContract({ address: CONTRACTS.cards, abi: cardStatsAbi, functionName: "statsOf", args: [BigInt(id)] }),
      ]);
      return { id, name, stats: stats as unknown as Stats };
    }),
  );
}

export const readMatch = (id: bigint) => pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "getMatch", args: [id] });
export type Match = Awaited<ReturnType<typeof readMatch>>;

export async function recentMatches(limit = 8) {
  const count = await pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "matchCount" });
  const ids = [];
  for (let i = count - 1n; i >= 0n && ids.length < limit; i--) ids.push(i);
  return Promise.all(ids.map(async (id) => ({ id, m: await readMatch(id) })));
}

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

// plays one match on testnet as two players and steers it to 1-1 so round 3 becomes the live duel.
// the backend (not this script) is expected to post the verdict. usage: bun --env-file=../.env scripts/play-to-live.ts
import { createWalletClient, encodeAbiParameters, http, keccak256, parseEther, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { duelAbi, cardStatsAbi } from "../src/abi";
import { monadTestnet, pub } from "../src/chain";
import { config } from "../src/config";
import { roundWinner, type Stats } from "../src/rules";

const A = privateKeyToAccount(process.env.DEPLOYER_KEY as Hex);
const B = privateKeyToAccount(process.env.PLAYER_B_KEY as Hex);
const wa = createWalletClient({ account: A, chain: monadTestnet, transport: http(config.rpcUrl) });
const wb = createWalletClient({ account: B, chain: monadTestnet, transport: http(config.rpcUrl) });
const duel = config.contracts.duel;
const deck = [0, 1, 2, 3, 4] as const;

async function send(w: typeof wa, fn: any, args: any[], value?: bigint) {
  const hash = await w.writeContract({ address: duel, abi: duelAbi, functionName: fn, args, value, gas: 400_000n } as any);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${fn} reverted ${hash}`);
  return hash;
}
const match = (id: bigint) => pub.readContract({ address: duel, abi: duelAbi, functionName: "getMatch", args: [id] });

const stats = new Map<number, Stats>();
for (const c of deck) {
  stats.set(c, (await pub.readContract({ address: config.contracts.cards, abi: cardStatsAbi, functionName: "statsOf", args: [BigInt(c)] })) as unknown as Stats);
}

await send(wa, "create", [deck], parseEther("0.01"));
const id = (await pub.readContract({ address: duel, abi: duelAbi, functionName: "matchCount" })) - 1n;
await send(wb, "join", [id, deck], parseEther("0.01"));
console.log(`match ${id} started`);

const usedA = new Set<number>();
const usedB = new Set<number>();
// pick an unused pair where the wanted side wins this arena
function pick(arena: number, want: 1 | 2): [number, number] {
  for (const a of deck) for (const b of deck) {
    if (usedA.has(a) || usedB.has(b)) continue;
    if (roundWinner(stats.get(a)!, stats.get(b)!, arena) === want) return [a, b];
  }
  throw new Error(`no pair makes side ${want} win arena ${arena}`);
}

for (const want of [1, 2, 1] as const) {
  const m = await match(id);
  if (m.state !== 1 || m.awaitingVerdict) break;
  const [ca, cb] = pick(m.arena, want);
  usedA.add(ca);
  usedB.add(cb);
  const sa = keccak256(toHex(`a${Math.random()}`));
  const sb = keccak256(toHex(`b${Math.random()}`));
  const commit = (who: `0x${string}`, card: number, salt: Hex) =>
    keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "uint16" }, { type: "bytes32" }], [id, m.round, who, card, salt]));
  await send(wa, "commit", [id, commit(A.address, ca, sa)]);
  await send(wb, "commit", [id, commit(B.address, cb, sb)]);
  await send(wa, "reveal", [id, ca, sa]);
  await send(wb, "reveal", [id, cb, sb]);
  const after = await match(id);
  console.log(`round ${m.round} arena ${m.arena}: a ${ca} vs b ${cb} -> ${after.winsA}-${after.winsB}, awaiting verdict ${after.awaitingVerdict}`);
}

const t0 = Date.now();
for (;;) {
  const m = await match(id);
  if (m.state === 2) {
    console.log(`settled by the backend after ${((Date.now() - t0) / 1000).toFixed(1)}s: result ${m.result} (1 a, 2 b, 3 draw)`);
    break;
  }
  if (Date.now() - t0 > 120_000) throw new Error("backend did not settle within 2 minutes");
  await Bun.sleep(1000);
}

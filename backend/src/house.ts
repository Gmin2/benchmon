import { formatEther } from "viem";
import { duelAbi, matchMarketAbi } from "./abi";
import { fitGas, pub, signer } from "./chain";
import { config, parseAmount } from "./config";
import { boundedSet, errMsg, loop } from "./util";

// the house opens a market on every new match so spectators can trade it, and takes back what is left
// once the match is over. the seed is the most the house can lose on one match (b * ln 2).
const LN2 = 693147180559945310n;

const done = boundedSet(5000);
const fails = new Map<string, number>();

type Seen = { mk: readonly [bigint, bigint, bigint, bigint, bigint, boolean, ...unknown[]]; open: boolean; result: number };

// the three reads tend needs, for every match in one multicall
async function readAll(ids: bigint[]): Promise<Map<string, Seen>> {
  if (!ids.length) return new Map();
  const res = await pub.multicall({
    contracts: ids.flatMap((id) => [
      { address: config.contracts.market, abi: matchMarketAbi, functionName: "markets", args: [id] } as const,
      { address: config.contracts.duel, abi: duelAbi, functionName: "bettingOpen", args: [id] } as const,
      { address: config.contracts.duel, abi: duelAbi, functionName: "resultOf", args: [id] } as const,
    ]),
    allowFailure: false,
  });
  return new Map(ids.map((id, i) => [id.toString(), { mk: res[i * 3] as unknown as Seen["mk"], open: res[i * 3 + 1] as boolean, result: Number(res[i * 3 + 2]) }]));
}

async function tend(id: bigint, seed: bigint, seen: Seen) {
  const key = id.toString();
  const house = signer("house");
  const { mk, open, result } = seen;
  const [mb, , , , , settled] = mk;
  if (mb === 0n) {
    if (!open) return done.add(key);
    const b = (seed * 10n ** 18n) / LN2;
    const call = { address: config.contracts.market, abi: matchMarketAbi, functionName: "open", args: [id, b], value: seed } as const;
    const gas = await fitGas(house.address, call);
    const r = await house.send((nonce) => house.wallet.writeContract({ ...call, gas, nonce }));
    console.log(`market opened for match ${id}, seed ${formatEther(seed)} MON: ${r.status} ${r.hash}`);
    return;
  }
  if (settled) return done.add(key);
  if (result === 0) return;
  const call = { address: config.contracts.market, abi: matchMarketAbi, functionName: "houseSettle", args: [id] } as const;
  const gas = await fitGas(house.address, call);
  const r = await house.send((nonce) => house.wallet.writeContract({ ...call, gas, nonce }));
  console.log(`house settled match ${id}: ${r.status} ${r.hash}`);
  done.add(key);
}

// walks the recent matches every few seconds; a match drops out once its market is settled, or it closed without one
export function houseLoop(scan = 30n) {
  const seed = parseAmount(config.houseSeed);
  return loop(
    "house",
    async () => {
      const count = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "matchCount" });
      let tried = 0;
      const failed: [string, string][] = [];
      const ids: bigint[] = [];
      for (let id = count > scan ? count - scan : 0n; id < count; id++) if (!done.has(id.toString())) ids.push(id);
      const seenAll = await readAll(ids);
      for (const id of ids) {
        const key = id.toString();
        tried++;
        try {
          await tend(id, seed, seenAll.get(key)!);
          fails.delete(key);
        } catch (e) {
          failed.push([key, errMsg(e)]);
        }
      }
      if (!failed.length) return;
      const last = `match ${failed.at(-1)![0]}: ${failed.at(-1)![1]}`;
      // everything failing is the rpc or the house wallet, not one match: back off without counting it against them
      if (failed.length === tried) throw new Error(`${failed.length} failed, last ${last}`);
      console.error(`house: ${failed.length} of ${tried} failed, last ${last}`);
      for (const [key, msg] of failed) {
        const n = (fails.get(key) ?? 0) + 1;
        fails.set(key, n);
        if (n < 5) continue;
        console.error(`house gave up on match ${key} after ${n} tries: ${msg}`);
        fails.delete(key);
        done.add(key);
      }
    },
    2000,
  );
}

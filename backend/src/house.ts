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

async function tend(id: bigint, seed: bigint) {
  const key = id.toString();
  const house = signer("house");
  const [mk, open, result] = await Promise.all([
    pub.readContract({ address: config.contracts.market, abi: matchMarketAbi, functionName: "markets", args: [id] }),
    pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "bettingOpen", args: [id] }),
    pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "resultOf", args: [id] }),
  ]);
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
      for (let id = count > scan ? count - scan : 0n; id < count; id++) {
        const key = id.toString();
        if (done.has(key)) continue;
        tried++;
        try {
          await tend(id, seed);
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

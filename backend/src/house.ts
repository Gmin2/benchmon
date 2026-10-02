import { formatEther, parseEther } from "viem";
import { duelAbi, matchMarketAbi } from "./abi";
import { pub, wallet } from "./chain";
import { config } from "./config";

// the house opens a market on every new match so spectators can trade it, and takes back what is left
// once the match is over. the seed is the most the house can lose on one match (b * ln 2).
const LN2 = 693147180559945310n;
const seed = parseEther(process.env.HOUSE_SEED ?? "0.01");
const b = (seed * 10n ** 18n) / LN2;

const done = new Set<string>();

async function tend(id: bigint) {
  const key = id.toString();
  const [mk, open, result] = await Promise.all([
    pub.readContract({ address: config.contracts.market, abi: matchMarketAbi, functionName: "markets", args: [id] }),
    pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "bettingOpen", args: [id] }),
    pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "resultOf", args: [id] }),
  ]);
  const [mb, , , , , settled] = mk;
  if (mb === 0n) {
    if (!open) return done.add(key);
    const hash = await wallet.writeContract({ address: config.contracts.market, abi: matchMarketAbi, functionName: "open", args: [id, b], value: seed, gas: 150_000n });
    const r = await pub.waitForTransactionReceipt({ hash });
    console.log(`market opened for match ${id}, seed ${formatEther(seed)} MON: ${r.status} ${hash}`);
    return;
  }
  if (settled) return done.add(key);
  if (result === 0) return;
  const hash = await wallet.writeContract({ address: config.contracts.market, abi: matchMarketAbi, functionName: "houseSettle", args: [id], gas: 120_000n });
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`house settled match ${id}: ${r.status} ${hash}`);
  done.add(key);
}

// walks the recent matches every few seconds; a match drops out once its market is settled, or it closed without one
export async function houseLoop(scan = 30n) {
  for (;;) {
    try {
      const count = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "matchCount" });
      for (let id = count > scan ? count - scan : 0n; id < count; id++) {
        if (done.has(id.toString())) continue;
        await tend(id).catch((e) => console.error(`house ${id}: ${(e as Error).message.split("\n")[0]}`));
      }
    } catch (e) {
      console.error(`house loop: ${(e as Error).message.split("\n")[0]}`);
    }
    await Bun.sleep(2000);
  }
}

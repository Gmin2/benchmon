import { parseEventLogs } from "viem";
import { duelAbi } from "./abi";
import { pub } from "./chain";
import { config } from "./config";

// alchemy's free tier caps eth_getLogs at 10 blocks (the public rpc at 100), so walk forward in steps
const STEP = 10n;

export type LiveDuel = { id: bigint; cardA: number; cardB: number; arena: number; block: bigint };

export async function watchLiveDuels(onDuel: (d: LiveDuel) => Promise<void>, from?: bigint) {
  let next = from ?? (await pub.getBlockNumber());
  const seen = new Set<string>();
  for (;;) {
    try {
      const head = await pub.getBlockNumber();
      while (next <= head) {
        const to = next + STEP - 1n > head ? head : next + STEP - 1n;
        const logs = await pub.getLogs({ address: config.contracts.duel, fromBlock: next, toBlock: to });
        for (const ev of parseEventLogs({ abi: duelAbi, logs, eventName: "LiveDuel" })) {
          const key = ev.args.id.toString();
          if (seen.has(key)) continue;
          seen.add(key);
          const d = { id: ev.args.id, cardA: ev.args.cardA, cardB: ev.args.cardB, arena: ev.args.arena, block: ev.blockNumber };
          onDuel(d).catch((e) => console.error(`duel ${key} failed: ${(e as Error).message.split("\n")[0]}`));
        }
        next = to + 1n;
      }
    } catch (e) {
      console.error("watch error", (e as Error).message.split("\n")[0]);
    }
    await Bun.sleep(1500);
  }
}

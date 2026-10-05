import { parseEventLogs } from "viem";
import { duelAbi } from "./abi";
import { pub } from "./chain";
import { config } from "./config";
import { boundedSet, errMsg, loop } from "./util";

// alchemy's free tier caps eth_getLogs at 10 blocks (the public rpc at 100), so walk forward in steps
const STEP = 10n;

export type LiveDuel = { id: bigint; cardA: number; cardB: number; arena: number; block: bigint };

export function watchLiveDuels(onDuel: (d: LiveDuel) => Promise<void>, from?: bigint) {
  let next = from;
  const seen = boundedSet(2000);
  return loop(
    "watch",
    async () => {
      const head = await pub.getBlockNumber();
      let at = next ?? head;
      while (at <= head) {
        const to: bigint = at + STEP - 1n > head ? head : at + STEP - 1n;
        const logs = await pub.getLogs({ address: config.contracts.duel, fromBlock: at, toBlock: to });
        for (const ev of parseEventLogs({ abi: duelAbi, logs, eventName: "LiveDuel" })) {
          const key = ev.args.id.toString();
          if (seen.has(key)) continue;
          seen.add(key);
          const d = { id: ev.args.id, cardA: ev.args.cardA, cardB: ev.args.cardB, arena: ev.args.arena, block: ev.blockNumber };
          onDuel(d).catch((e) => console.error(`duel ${key} failed: ${errMsg(e)}`));
        }
        at = to + 1n;
        next = at;
      }
    },
    1500,
  );
}

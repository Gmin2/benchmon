// prints every event of one match from the last few thousand blocks: bun scripts/match-log.ts <id> [blocks]
import { parseEventLogs } from "viem";
import { duelAbi } from "../src/abi";
import { pub } from "../src/chain";
import { config } from "../src/config";

const id = BigInt(Bun.argv[2] ?? 0);
const span = BigInt(Bun.argv[3] ?? 3000);
const head = await pub.getBlockNumber();
for (let from = head - span; from <= head; from += 100n) {
  const to = from + 99n > head ? head : from + 99n;
  const logs = await pub.getLogs({ address: config.contracts.duel, fromBlock: from, toBlock: to });
  for (const ev of parseEventLogs({ abi: duelAbi, logs })) {
    const a = ev.args as Record<string, unknown>;
    if (a.id !== id) continue;
    const rest = Object.entries(a).filter(([k]) => k !== "id").map(([k, v]) => `${k}=${String(v)}`).join(" ");
    console.log(`${ev.blockNumber} ${ev.eventName} ${rest} tx ${ev.transactionHash.slice(0, 12)}`);
  }
}

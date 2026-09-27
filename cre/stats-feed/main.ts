import {
  CronCapability,
  EVMClient,
  getNetwork,
  handler,
  prepareReportRequest,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters, toHex } from "viem";

export type Config = {
  schedule: string;
  chain: string;
  feed: `0x${string}`;
  gasLimit: string;
  // first slice: a fixed stats update, so the forwarder path is proven before real data is wired in
  cards: { id: number; stats: number[] }[];
};

const REPORT = parseAbiParameters("uint256[] ids, uint8[6][] stats");

export const onCron = (runtime: Runtime<Config>): string => {
  const cfg = runtime.config;
  const net = getNetwork({ chainFamily: "evm", chainSelectorName: cfg.chain });
  if (!net) throw new Error(`unknown chain ${cfg.chain}`);

  const ids = cfg.cards.map((c) => BigInt(c.id));
  const stats = cfg.cards.map((c) => c.stats as [number, number, number, number, number, number]);
  const payload = encodeAbiParameters(REPORT, [ids, stats]);

  const report = runtime.report(prepareReportRequest(payload)).result();
  const reply = new EVMClient(net.chainSelector.selector)
    .writeReport(runtime, { receiver: cfg.feed, report, gasConfig: { gasLimit: cfg.gasLimit } })
    .result();

  const hash = reply.txHash ? toHex(reply.txHash) : "none";
  runtime.log(`wrote ${ids.length} cards to ${cfg.feed}, status ${reply.txStatus}, tx ${hash}`);
  return hash;
};

export const initWorkflow = (config: Config) => [
  handler(new CronCapability().trigger({ schedule: config.schedule }), onCron),
];

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

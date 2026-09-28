import {
  consensusIdenticalAggregation,
  CronCapability,
  EVMClient,
  getNetwork,
  handler,
  HTTPClient,
  prepareReportRequest,
  Runner,
  text,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters, toHex, type Hex } from "viem";

export type Config = {
  schedule: string;
  chain: string;
  feed: `0x${string}`;
  gasLimit: string;
  statsUrl: string;
};

type StatsFile = { cards: { id: number; stats: number[] }[] };
const REPORT = parseAbiParameters("uint256[] ids, uint8[6][] stats");

// every node fetches the stats and encodes the report payload; the nodes must agree on the exact bytes
const fetchPayload = (sender: HTTPSendRequester, url: string): Hex => {
  const res = sender.sendRequest({ url, method: "GET" }).result();
  const file = JSON.parse(text(res)) as StatsFile;
  const ids = file.cards.map((c) => BigInt(c.id));
  const stats = file.cards.map((c) => c.stats as [number, number, number, number, number, number]);
  return encodeAbiParameters(REPORT, [ids, stats]);
};

export const onCron = (runtime: Runtime<Config>): string => {
  const cfg = runtime.config;
  const net = getNetwork({ chainFamily: "evm", chainSelectorName: cfg.chain });
  if (!net) throw new Error(`unknown chain ${cfg.chain}`);

  const payload = new HTTPClient().sendRequest(runtime, fetchPayload, consensusIdenticalAggregation<Hex>())(cfg.statsUrl).result();
  const report = runtime.report(prepareReportRequest(payload)).result();
  const reply = new EVMClient(net.chainSelector.selector)
    .writeReport(runtime, { receiver: cfg.feed, report, gasConfig: { gasLimit: cfg.gasLimit } })
    .result();

  const hash = reply.txHash ? toHex(reply.txHash) : "none";
  runtime.log(`wrote card stats from ${cfg.statsUrl} to ${cfg.feed}, status ${reply.txStatus}, tx ${hash}`);
  return hash;
};

export const initWorkflow = (config: Config) => [
  handler(new CronCapability().trigger({ schedule: config.schedule }), onCron),
];

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

// pushes data/stats.json into CardStats through StatsFeed.onReport, sent by the stats keeper (the feed's forwarder
// since the roles were split). same report the cre workflow builds. dry run by default: simulates the call and
// prints what would change onchain. usage: bun --env-file=../.env scripts/push-stats.ts [--send]
import { concat, createWalletClient, encodeAbiParameters, http, isAddress, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { cardStatsAbi, statsFeedAbi } from "../src/abi";
import { monadTestnet, pub } from "../src/chain";
import { config } from "../src/config";

const send = process.argv.includes("--send");
const key = process.env.STATS_KEEPER_KEY as Hex | undefined;
const keeper = (key ? privateKeyToAccount(key).address : process.env.STATS_KEEPER) as Address | undefined;
if (!keeper || !isAddress(keeper)) throw new Error("set STATS_KEEPER_KEY (or STATS_KEEPER for a dry run)");
if (send && !key) throw new Error("--send needs STATS_KEEPER_KEY");

type Six = readonly [number, number, number, number, number, number];
const data = (await Bun.file(new URL("../data/stats.json", import.meta.url).pathname).json()) as { builtAt: string; cards: { id: number; name: string; stats: number[] }[] };
for (const c of data.cards) {
  if (c.stats.length !== 6 || c.stats.some((s) => !Number.isInteger(s) || s < 1 || s > 99)) throw new Error(`card ${c.id} has bad stats ${c.stats}`);
}
const ids = data.cards.map((c) => BigInt(c.id));
const stats = data.cards.map((c) => c.stats as unknown as Six);

const feed = config.contracts.statsFeed;
const [forwarder, wfId, wfOwner, cards] = await Promise.all([
  pub.readContract({ address: feed, abi: statsFeedAbi, functionName: "forwarder" }),
  pub.readContract({ address: feed, abi: statsFeedAbi, functionName: "expectedWorkflowId" }),
  pub.readContract({ address: feed, abi: statsFeedAbi, functionName: "expectedWorkflowOwner" }),
  pub.readContract({ address: feed, abi: statsFeedAbi, functionName: "cards" }),
]);
if (forwarder.toLowerCase() !== keeper.toLowerCase()) throw new Error(`StatsFeed forwarder is ${forwarder}, not the keeper ${keeper}`);

// what the cre forwarder would hand over: workflow id (32) | workflow name (10, unused) | workflow owner (20) | report id (2)
const metadata = concat([wfId, toHex(0, { size: 10 }), wfOwner, toHex(0, { size: 2 })]);
const report = encodeAbiParameters([{ type: "uint256[]" }, { type: "uint8[6][]" }], [ids, stats]);

const onchain = await Promise.all(ids.map((id) => pub.readContract({ address: cards, abi: cardStatsAbi, functionName: "statsOf", args: [id] })));
let changed = 0;
for (const [i, c] of data.cards.entries()) {
  const now = onchain[i]!;
  if (now.every((v, j) => v === c.stats[j])) continue;
  changed++;
  console.log(`${String(c.id).padStart(2)} ${c.name.padEnd(20)} ${now.join(",").padEnd(18)} -> ${c.stats.join(",")}`);
}
console.log(`${changed} of ${data.cards.length} cards change (stats.json built ${data.builtAt})`);

const call = { account: keeper, address: feed, abi: statsFeedAbi, functionName: "onReport", args: [metadata, report] } as const;
await pub.simulateContract(call);
const gas = await pub.estimateContractGas(call);
console.log(`simulated onReport from ${keeper}: ok, gas ${gas}`);

if (!send) {
  console.log("dry run, nothing sent. add --send to push it");
  process.exit(0);
}
if (!changed) {
  console.log("nothing to change, not sending");
  process.exit(0);
}
const wallet = createWalletClient({ account: privateKeyToAccount(key!), chain: monadTestnet, transport: http(config.rpcUrl) });
const hash = await wallet.writeContract({ ...call, account: wallet.account, gas: (gas * 12n) / 10n });
const r = await pub.waitForTransactionReceipt({ hash });
console.log(`onReport ${r.status} ${hash}`);

// tops up a dev mode player (its smart account address, shown in the web app menu) with testnet MON from the deployer.
// usage: bun --env-file=../.env scripts/fund-dev.ts 0xSmartAccount [amount, default 0.05]
import { createWalletClient, formatEther, http, isAddress, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet, pub } from "../src/chain";
import { config } from "../src/config";

const [to, amount = "0.05"] = process.argv.slice(2);
if (!to || !isAddress(to)) throw new Error("usage: fund-dev.ts 0xSmartAccount [amount]");
if (Number(amount) > 1) throw new Error("dev top ups stay under 1 MON");

const from = privateKeyToAccount(process.env.DEPLOYER_KEY as Hex);
const w = createWalletClient({ account: from, chain: monadTestnet, transport: http(config.rpcUrl) });
const hash = await w.sendTransaction({ to, value: parseEther(amount) });
await pub.waitForTransactionReceipt({ hash });
console.log(`sent ${amount} MON to ${to} (${hash}), balance now ${formatEther(await pub.getBalance({ address: to }))}`);

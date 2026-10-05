// owner step: names every roster card onchain with neutral stats (all 50) and sets the deck power cap.
// the real stats then arrive through the chainlink workflow. usage: bun --env-file=../.env scripts/seed-roster.ts
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { cardStatsAbi, duelAbi } from "../src/abi";
import { monadTestnet, pub } from "../src/chain";
import { config } from "../src/config";
import roster from "../src/roster.json";

// owner only, so this runs from the deployer and never from a backend role key
const wallet = createWalletClient({ account: privateKeyToAccount(process.env.DEPLOYER_KEY as Hex), chain: monadTestnet, transport: http(config.rpcUrl) });
const DECK_CAP = 1600n;
for (const r of roster) {
  const hash = await wallet.writeContract({ address: config.contracts.cards, abi: cardStatsAbi, functionName: "setCard", args: [BigInt(r.id), r.name, [50, 50, 50, 50, 50, 50]], gas: 200_000n });
  const rc = await pub.waitForTransactionReceipt({ hash });
  console.log(`card ${r.id} ${r.name}: ${rc.status}`);
}
const h = await wallet.writeContract({ address: config.contracts.duel, abi: duelAbi, functionName: "setDeckCap", args: [DECK_CAP], gas: 80_000n });
console.log(`deck cap ${DECK_CAP}: ${(await pub.waitForTransactionReceipt({ hash: h })).status}`);

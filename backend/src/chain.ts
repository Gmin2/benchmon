import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

export const judge = privateKeyToAccount(config.judgeKey);
export const pub = createPublicClient({ chain: monadTestnet, transport: http(config.rpcUrl) });
export const wallet = createWalletClient({ account: judge, chain: monadTestnet, transport: http(config.rpcUrl) });

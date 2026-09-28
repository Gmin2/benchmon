import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { addZerodevExtension } from "@dynamic-labs-sdk/zerodev";

export const MONAD_TESTNET = {
  blockExplorerUrls: ["https://testnet.monadscan.com"],
  chain: "EVM" as const,
  displayName: "Monad Testnet",
  iconUrl: "",
  name: "monad-testnet",
  nativeCurrency: { decimals: 18, name: "MON", symbol: "MON" },
  networkId: "10143",
  rpcUrls: { http: ["https://testnet-rpc.monad.xyz"] },
  testnet: true,
};

export const dynamicClient = createDynamicClient({
  environmentId: import.meta.env.DYNAMIC_ENV_ID,
  metadata: { name: "benchmon", universalLink: window.location.origin },
  // the dashboard only lists ethereum for this project, so monad testnet is added here and made the only network
  transformers: { networksData: () => [MONAD_TESTNET] },
});

addEvmExtension();
// zerodev smart accounts with a paymaster, so players pay no gas (project set in the dynamic dashboard)
addZerodevExtension();

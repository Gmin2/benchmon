import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";
import { txQueue } from "./txq";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

export const pub = createPublicClient({ chain: monadTestnet, transport: http(config.rpcUrl) });

export type Role = "judge" | "relayer" | "house";

// one wallet and one tx queue per role, made on first use so read only scripts need no keys
function makeSigner(role: Role, key: Hex | undefined) {
  if (!key) throw new Error(`no key for ${role}`);
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(config.rpcUrl) });
  const q = txQueue({
    nonce: () => pub.getTransactionCount({ address: account.address, blockTag: "pending" }),
    wait: async (hash) => (await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })).status,
  });
  return { role, address: account.address, wallet, send: q.send, idle: q.idle };
}

export type Signer = ReturnType<typeof makeSigner>;

const signers = new Map<Role, Signer>();
const keys: Record<Role, () => Hex | undefined> = { judge: () => config.judgeKey, relayer: () => config.relayerKey, house: () => config.houseKey };

export function signer(role: Role): Signer {
  let s = signers.get(role);
  if (!s) signers.set(role, (s = makeSigner(role, keys[role]())));
  return s;
}

export const activeSigners = () => [...signers.values()];

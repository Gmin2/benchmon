import { createPublicClient, createWalletClient, defineChain, http, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";
import { txQueue } from "./txq";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  // the standard deployment, used by pub.multicall to read many cards in one call
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const pub = createPublicClient({ chain: monadTestnet, transport: http(config.rpcUrl) });

export type Role = "judge" | "relayer" | "house" | "bot";

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
const keys: Record<Role, () => Hex | undefined> = { judge: () => config.judgeKey, relayer: () => config.relayerKey, house: () => config.houseKey, bot: () => config.botKey };

export function signer(role: Role): Signer {
  let s = signers.get(role);
  if (!s) signers.set(role, (s = makeSigner(role, keys[role]())));
  return s;
}

export const activeSigners = () => [...signers.values()];

// monad charges the whole gas limit, not the gas used, so every send asks for what the call needs plus a
// small margin. a call that would revert fails here, before anything is paid
export async function fitGas(account: Address, c: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint }) {
  const g = await pub.estimateContractGas({ ...c, account } as never);
  return g + g / 5n + 5_000n;
}

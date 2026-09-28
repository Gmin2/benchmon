import { createPublicClient, defineChain, http, type Address, type Hex, type WalletClient } from "viem";
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk";
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { RPC } from "./chain";

// a zerodev kernel smart account on monad testnet, owned by the player's dynamic wallet.
// zerodev's paymaster pays the gas under the project's gas policy, so the player needs no MON for gas.
// this goes to zerodev directly because dynamic's dashboard has no monad network to attach zerodev to.
export const ZERODEV_RPC = `https://rpc.zerodev.app/api/v3/${import.meta.env.VITE_ZERODEV_PROJECT_ID}/chain/10143`;

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_1;
const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });

export async function kernelClientFor(signer: WalletClient) {
  const validator = await signerToEcdsaValidator(publicClient, { signer: signer as never, entryPoint, kernelVersion });
  const account = await createKernelAccount(publicClient, { plugins: { sudo: validator }, entryPoint, kernelVersion });
  const paymaster = createZeroDevPaymasterClient({ chain: monadTestnet, transport: http(ZERODEV_RPC) });
  return createKernelAccountClient({
    account,
    chain: monadTestnet,
    bundlerTransport: http(ZERODEV_RPC),
    client: publicClient,
    paymaster: { getPaymasterData: (userOperation) => paymaster.sponsorUserOperation({ userOperation }) },
  });
}

export type Kernel = Awaited<ReturnType<typeof kernelClientFor>>;

export async function sendSponsored(k: Kernel, call: { to: Address; data: Hex; value: bigint }): Promise<Hex> {
  const userOpHash = await k.sendUserOperation({ callData: await k.account.encodeCalls([call]) });
  const r = await k.waitForUserOperationReceipt({ hash: userOpHash });
  if (!r.success) throw new Error(`user operation failed (${r.receipt.transactionHash})`);
  return r.receipt.transactionHash;
}

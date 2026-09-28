import type { Address, Hex, WalletClient } from "viem";
import { monadTestnet } from "viem/chains";
import { alchemyWalletTransport, createSmartWalletClient } from "@alchemy/wallet-apis";

// alchemy smart wallet owned by the player's dynamic wallet; alchemy's gas manager pays the gas under the
// policy below. a plain (non 7702) smart account, since 7702 through alchemy on monad needs an allowlist.
const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
const policyId = import.meta.env.VITE_ALCHEMY_POLICY_ID;

export async function smartWalletFor(signer: WalletClient) {
  if (!apiKey || !policyId) throw new Error("set VITE_ALCHEMY_API_KEY and VITE_ALCHEMY_POLICY_ID in benchmon/.env");
  const base = createSmartWalletClient({
    signer: signer as never,
    transport: alchemyWalletTransport({ apiKey }),
    chain: monadTestnet,
    paymaster: { policyId },
  });
  const account = await base.requestAccount();
  const client = createSmartWalletClient({
    signer: signer as never,
    transport: alchemyWalletTransport({ apiKey }),
    chain: monadTestnet,
    account: account.address,
    paymaster: { policyId },
  });
  return { client, address: account.address as Address };
}

export type SmartWallet = Awaited<ReturnType<typeof smartWalletFor>>;

export async function sendSponsored(w: SmartWallet, call: { to: Address; data: Hex; value: bigint }): Promise<Hex> {
  const { id } = await w.client.sendCalls({ calls: [call] });
  const status = await w.client.waitForCallsStatus({ id });
  const hash = status.receipts?.[0]?.transactionHash;
  if (status.status !== "success" || !hash) throw new Error(`calls ${status.status} (${hash ?? id})`);
  return hash;
}

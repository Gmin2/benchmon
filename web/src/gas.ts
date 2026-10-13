import type { Address, Hex, WalletClient } from "viem";
import { monadTestnet } from "viem/chains";
import { alchemyWalletTransport, createSmartWalletClient } from "@alchemy/wallet-apis";

// alchemy smart wallet owned by the player's dynamic wallet; alchemy's gas manager pays the gas under the
// policy below. a plain (non 7702) smart account, since 7702 through alchemy on monad needs an allowlist.
const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
const policyId = import.meta.env.VITE_ALCHEMY_POLICY_ID;

// the smart account address never changes for a given owner, so it is asked from alchemy once per owner and
// remembered here. every alchemy call spends its monthly capacity, a returning player now costs none to load
const accountKey = (owner: string) => `benchmon:smart-account:${owner.toLowerCase()}`;
function rememberedAccount(owner?: string): Address | null {
  if (!owner) return null;
  try {
    const a = localStorage.getItem(accountKey(owner));
    return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as Address) : null;
  } catch {
    return null;
  }
}

export async function smartWalletFor(signer: WalletClient) {
  if (!apiKey || !policyId) throw new Error("set VITE_ALCHEMY_API_KEY and VITE_ALCHEMY_POLICY_ID in .env at the repo root");
  const owner = signer.account?.address;
  let address = rememberedAccount(owner);
  if (!address) {
    const base = createSmartWalletClient({
      signer: signer as never,
      transport: alchemyWalletTransport({ apiKey }),
      chain: monadTestnet,
      paymaster: { policyId },
    });
    address = (await base.requestAccount()).address as Address;
    try {
      if (owner) localStorage.setItem(accountKey(owner), address);
    } catch {
      // storage blocked: it is just asked again next time
    }
  }
  const account = { address };
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
  // a steady poll instead of the default, each status check is an alchemy call
  const status = await w.client.waitForCallsStatus({ id, pollingInterval: 1_500, timeout: 90_000 });
  const hash = status.receipts?.[0]?.transactionHash;
  if (status.status !== "success" || !hash) throw new Error(`calls ${status.status} (${hash ?? id})`);
  return hash;
}

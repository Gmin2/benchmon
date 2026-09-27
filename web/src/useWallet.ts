import { useCallback } from "react";
import type { Abi, Address, ContractFunctionName } from "viem";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { pub } from "./chain";

// the player's embedded wallet, plus a write helper that waits for the receipt and throws on revert
export function useWallet() {
  const { data: accounts = [], isFetched } = useGetWalletAccounts();
  const evm = accounts.find(isEvmWalletAccount);
  const address = evm?.address as Address | undefined;

  const write = useCallback(
    async <A extends Abi>(p: {
      address: Address;
      abi: A;
      functionName: ContractFunctionName<A, "payable" | "nonpayable">;
      args?: readonly unknown[];
      value?: bigint;
      gas: bigint;
    }) => {
      if (!evm) throw new Error("no wallet yet");
      const w = await createWalletClientForWalletAccount({ walletAccount: evm as never });
      const hash = await w.writeContract(p as never);
      const r = await pub.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error(`${String(p.functionName)} reverted (${hash})`);
      console.log(`bm: ${String(p.functionName)} ${hash}`);
      return hash;
    },
    [evm],
  );

  return { address, ready: isFetched, evm, write };
}

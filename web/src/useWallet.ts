import { useCallback } from "react";
import { encodeFunctionData, type Abi, type Address, type ContractFunctionName, type Hex } from "viem";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { sendUserOperation } from "@dynamic-labs-sdk/zerodev";
import { isSmartAccount } from "./smart";
import { useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { pub } from "./chain";

// the player plays from the zerodev smart account when there is one (gas sponsored), otherwise from the
// plain embedded wallet (player pays gas). write waits for the receipt and throws on a revert.
export function useWallet() {
  const { data: accounts = [], isFetched } = useGetWalletAccounts();
  const smart = accounts.find((a) => isSmartAccount(a));
  const evm = accounts.find((a) => isEvmWalletAccount(a) && !isSmartAccount(a));
  const account = smart ?? evm;
  const address = account?.address as Address | undefined;

  const write = useCallback(
    async <A extends Abi>(p: {
      address: Address;
      abi: A;
      functionName: ContractFunctionName<A, "payable" | "nonpayable">;
      args?: readonly unknown[];
      value?: bigint;
      gas: bigint;
    }) => {
      if (!account) throw new Error("no wallet yet");
      const t = performance.now();
      let hash: Hex;
      if (smart) {
        const data = encodeFunctionData({ abi: p.abi as Abi, functionName: p.functionName as string, args: p.args as unknown[] });
        const r = await sendUserOperation({ walletAccount: smart as never, calls: [{ to: p.address, data, value: p.value ?? 0n }] });
        if (!r.success) throw new Error(`${String(p.functionName)} failed in the user operation (${r.receipt.transactionHash})`);
        hash = r.receipt.transactionHash;
      } else {
        const w = await createWalletClientForWalletAccount({ walletAccount: evm as never });
        hash = await w.writeContract(p as never);
        const r = await pub.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error(`${String(p.functionName)} reverted (${hash})`);
      }
      console.log(`bm: ${String(p.functionName)} ${hash} ${(performance.now() - t).toFixed(0)}ms ${smart ? "sponsored" : "self paid"}`);
      return hash;
    },
    [account, smart, evm],
  );

  return { address, ready: isFetched, evm: account, smart: Boolean(smart), write };
}

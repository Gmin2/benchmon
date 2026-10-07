import { useCallback, useEffect, useRef, useState } from "react";
import { encodeFunctionData, type Abi, type Address, type ContractFunctionName, type Hex } from "viem";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { createWaasWalletAccounts, shouldAutoCreateWalletForChain } from "@dynamic-labs-sdk/client/waas";
import { useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { sendSponsored, smartWalletFor, type SmartWallet } from "./gas";
import { DEV, devSigner } from "./dev";

// the player plays from an alchemy smart account owned by their dynamic wallet; gas is sponsored.
// write sends one call as a user operation and waits for it to land, throwing if it fails.
export function useWallet() {
  const { data: accounts = [], isFetched } = useGetWalletAccounts();
  const evm = accounts.find(isEvmWalletAccount);
  const [kernel, setKernel] = useState<SmartWallet>();
  const [err, setErr] = useState("");
  const building = useRef<string>("");

  const dev = useRef(DEV ? devSigner() : null);
  const creating = useRef(false);

  // the headless sdk never makes the embedded wallet by itself, even with automatic creation on in the
  // dashboard: a brand new account has none until we ask for it here
  useEffect(() => {
    if (DEV || !isFetched || evm || creating.current) return;
    let ok = false;
    try {
      ok = shouldAutoCreateWalletForChain({ chain: "EVM" });
    } catch {
      ok = false;
    }
    if (!ok) return;
    creating.current = true;
    createWaasWalletAccounts({ chains: ["EVM"] }).catch((e: Error) => {
      creating.current = false;
      setErr(e.message || "could not create your wallet");
    });
  }, [isFetched, evm]);

  // never spin forever: if no wallet shows up, say so and offer a retry
  useEffect(() => {
    if (DEV || kernel || err) return;
    const t = setTimeout(() => setErr("making your wallet is taking longer than it should"), 45_000);
    return () => clearTimeout(t);
  }, [kernel, err]);

  useEffect(() => {
    const d = dev.current;
    if (!d || building.current === d.owner) return;
    building.current = d.owner;
    smartWalletFor(d.wallet as never)
      .then(setKernel)
      .catch((e: Error) => {
        building.current = "";
        setErr(e.message);
      });
  }, []);

  useEffect(() => {
    if (DEV || !evm || building.current === evm.address) return;
    building.current = evm.address;
    createWalletClientForWalletAccount({ walletAccount: evm as never })
      .then((w) => {
        // debug handle for signer checks from the console, dev only
        if (import.meta.env.DEV) (window as unknown as { __bmSigner: unknown }).__bmSigner = w;
        return smartWalletFor(w);
      })
      .then(setKernel)
      .catch((e: Error) => {
        building.current = "";
        setErr(e.message);
      });
  }, [evm]);

  const write = useCallback(
    async <A extends Abi>(p: {
      address: Address;
      abi: A;
      functionName: ContractFunctionName<A, "payable" | "nonpayable">;
      args?: readonly unknown[];
      value?: bigint;
      gas?: bigint;
    }) => {
      if (!kernel) throw new Error("smart account not ready");
      const t = performance.now();
      const data = encodeFunctionData({ abi: p.abi as Abi, functionName: p.functionName as string, args: p.args as unknown[] });
      const hash: Hex = await sendSponsored(kernel, { to: p.address, data, value: p.value ?? 0n });
      if (import.meta.env.DEV) console.log(`bm: ${String(p.functionName)} ${hash} ${(performance.now() - t).toFixed(0)}ms sponsored`);
      return hash;
    },
    [kernel],
  );

  const owner = dev.current?.owner ?? evm?.address;
  return { address: kernel?.address, owner, ready: (DEV || isFetched) && Boolean(kernel), err, write, kernel };
}

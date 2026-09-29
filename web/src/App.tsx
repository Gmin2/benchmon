import { useEffect, useRef, useState } from "react";
import { createPublicClient, formatEther, http } from "viem";
import { getNetworksData, logout } from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { useGetWalletAccounts, useInitStatus, useUser } from "@dynamic-labs-sdk/react-hooks";
import { Game } from "./Game";
import { Welcome } from "./screens/Welcome";
import { Shell } from "./screens/Shell";
import { Crest } from "./ui/brand";
import { useWallet } from "./useWallet";
import { sendSponsored } from "./gas";

function SmartAccountLine() {
  const { address, err, kernel } = useWallet();
  const [out, setOut] = useState("");
  const ping = () => {
    const t = performance.now();
    // a smart account calling itself with no data reverts in validation (AA23), so ping a burn address instead
    sendSponsored(kernel!, { to: "0x000000000000000000000000000000000000dEaD", data: "0x", value: 0n })
      .then((h) => setOut(`sponsored tx ${h} in ${(performance.now() - t).toFixed(0)}ms`))
      .catch((e: Error & { details?: string; url?: string; status?: number; body?: unknown; shortMessage?: string }) => {
        const info = { short: e.shortMessage, details: e.details, status: e.status, url: e.url?.replace(/v3\/[^/]+/, "v3/..."), body: JSON.stringify(e.body ?? "").slice(0, 400) };
        console.log(`bm: sponsor error ${JSON.stringify(info)}`);
        setOut(`sponsored tx failed: ${JSON.stringify(info)}`);
      });
  };
  return (
    <>
      <p className="font-mono text-sm">{address ? `smart account ${address} (gas sponsored)` : err ? `smart account error: ${err}` : "setting up smart account"}</p>
      {kernel && <button className="border rounded px-3 py-2 w-fit" onClick={ping}>sponsored 0 MON test transaction</button>}
      {out && <p className="font-mono text-xs break-all">{out}</p>}
    </>
  );
}

const monad = createPublicClient({ transport: http("https://testnet-rpc.monad.xyz") });
function Account() {
  const { data: accounts = [], isFetched } = useGetWalletAccounts();
  const [balance, setBalance] = useState<string>();
  const [err, setErr] = useState("");
  const creating = useRef(false);
  const evm = accounts.find(isEvmWalletAccount);

  // every player gets a wallet right after signup, no extra step
  useEffect(() => {
    if (!isFetched || evm || creating.current) return;
    creating.current = true;
    createWaasWalletAccounts({ chains: ["EVM"] }).catch((e: Error) => {
      creating.current = false;
      setErr(e.message);
    });
  }, [isFetched, evm]);

  const [out, setOut] = useState("");
  const client = async () => {
    const t = performance.now();
    console.log("bm: creating wallet client");
    const w = await createWalletClientForWalletAccount({ walletAccount: evm! as never });
    console.log(`bm: wallet client ready ${(performance.now() - t).toFixed(0)}ms, chain ${w.chain?.id}`);
    return w;
  };
  const sign = () =>
    client()
      .then((w) => {
        console.log("bm: signing");
        return w.signMessage({ message: "benchmon" });
      })
      .then((sig) => {
        console.log(`bm: signed ${sig}`);
        setOut(`signature ${sig}`);
      })
      .catch((e: Error) => {
        console.log(`bm: error ${e.message}`);
        setErr(e.message);
      });
  const sendSelf = () =>
    client()
      .then(async (w) => {
        const chainId = await w.getChainId();
        const hash = await w.sendTransaction({ to: evm!.address as `0x${string}`, value: 0n, gas: 21000n });
        setOut(`chain ${chainId}, tx ${hash}`);
      })
      .catch((e: Error) => setErr(e.message));

  const check = async () => {
    if (!evm) return;
    setBalance(formatEther(await monad.getBalance({ address: evm.address as `0x${string}` })));
    console.log("networks " + JSON.stringify(getNetworksData().map((n) => `${n.networkId} ${n.displayName}`)));
  };

  return (
    <div className="flex flex-col gap-3">
      {evm ? (
        <>
          <p className="font-mono text-sm">wallet {evm.address}</p>
          <SmartAccountLine />
          <button className="border rounded px-3 py-2 w-fit" onClick={check}>check MON balance</button>
          {balance !== undefined && <p>{balance} MON on monad testnet</p>}
          <button className="border rounded px-3 py-2 w-fit" onClick={sign}>sign a message</button>
          <button className="border rounded px-3 py-2 w-fit" onClick={sendSelf}>send 0 MON to myself</button>
          {out && <p className="font-mono text-xs break-all">{out}</p>}
        </>
      ) : (
        <p>setting up your wallet</p>
      )}
      <button className="text-sm underline w-fit" onClick={() => logout()}>log out</button>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {evm && <Game />}
    </div>
  );
}

export default function App() {
  const { data: init } = useInitStatus();
  const { data: user } = useUser();
  if (init !== "finished")
    return (
      <div className="grid h-full place-items-center">
        <Crest className="h-12 w-12 animate-pulse" />
      </div>
    );
  return user ? <Shell /> : <Welcome />;
}

// the old debug panel, kept for wallet checks from the console
export function DebugAccount() {
  return <Account />;
}

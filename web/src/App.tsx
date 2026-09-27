import { useEffect, useRef, useState } from "react";
import { createPublicClient, formatEther, http } from "viem";
import { getNetworksData, logout, sendEmailOTP, verifyOTP } from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { useGetWalletAccounts, useInitStatus, useUser } from "@dynamic-labs-sdk/react-hooks";
import { Game } from "./Game";

const monad = createPublicClient({ transport: http("https://testnet-rpc.monad.xyz") });
type Otp = Awaited<ReturnType<typeof sendEmailOTP>>;

function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState<Otp | null>(null);
  const [err, setErr] = useState("");
  const run = (f: () => Promise<unknown>) => f().catch((e: Error) => setErr(e.message));

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      {!otp ? (
        <>
          <input className="border rounded px-3 py-2" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="bg-black text-white rounded px-3 py-2" onClick={() => run(async () => setOtp(await sendEmailOTP({ email })))}>
            send code
          </button>
        </>
      ) : (
        <>
          <input className="border rounded px-3 py-2" placeholder="6 digit code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="bg-black text-white rounded px-3 py-2" onClick={() => run(() => verifyOTP({ otpVerification: otp, verificationToken: code }))}>
            log in
          </button>
        </>
      )}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  );
}

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
  return (
    <main className="p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">benchmon</h1>
      {init !== "finished" ? <p>loading</p> : user ? <Account /> : <Login />}
    </main>
  );
}

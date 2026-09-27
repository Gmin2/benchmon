import { useState } from "react";
import { createPublicClient, formatEther, http } from "viem";
import { getNetworksData, logout, sendEmailOTP, verifyOTP } from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { useGetWalletAccounts, useInitStatus, useUser } from "@dynamic-labs-sdk/react-hooks";

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
  const { data: accounts = [] } = useGetWalletAccounts();
  const [balance, setBalance] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const evm = accounts.find(isEvmWalletAccount);

  const create = async () => {
    setBusy(true);
    try {
      await createWaasWalletAccounts({ chains: ["EVM"] });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const check = async () => {
    if (!evm) return;
    setBalance(formatEther(await monad.getBalance({ address: evm.address as `0x${string}` })));
    console.log("networks", getNetworksData().map((n) => `${n.networkId} ${n.displayName}`));
  };

  return (
    <div className="flex flex-col gap-3">
      {evm ? (
        <>
          <p className="font-mono text-sm">wallet {evm.address}</p>
          <button className="border rounded px-3 py-2 w-fit" onClick={check}>check MON balance</button>
          {balance !== undefined && <p>{balance} MON on monad testnet</p>}
        </>
      ) : (
        <button className="bg-black text-white rounded px-3 py-2 w-fit" disabled={busy} onClick={create}>
          {busy ? "creating wallet" : "create wallet"}
        </button>
      )}
      <button className="text-sm underline w-fit" onClick={() => logout()}>log out</button>
      {err && <p className="text-red-600 text-sm">{err}</p>}
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

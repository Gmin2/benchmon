import { useEffect, useRef, useState } from "react";
import { short } from "../hooks";
import { CardBack } from "../ui/Card";
import { Btn } from "../ui/kit";
import { Mon } from "../ui/Mon";

// the first time an account signs in, wallet creation is shown instead of hidden behind a spinner:
// the mon builds it step by step and stamps the new address on a card back.
// returning players never see it, their wallet comes back in a blink.
const seen = (a: string) => `benchmon:forged:${a.toLowerCase()}`;

function Step({ done, active, title, detail }: { done: boolean; active: boolean; title: string; detail?: string }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${active ? "bg-panel-2" : ""}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold transition ${done ? "bg-neon text-bg" : "bg-panel-2 text-dim"}`}>
        {done ? "✓" : active ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-neon border-t-transparent" /> : ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${done || active ? "text-ink" : "text-dim"}`}>{title}</span>
        {detail && <span className="block truncate font-mono text-xs text-mute">{detail}</span>}
      </span>
    </li>
  );
}

export function WalletForge({ owner, address, err, onDone }: { owner?: string; address?: string; err: string; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    if (address) localStorage.setItem(seen(address), "1");
    onDone();
  };

  // only show up if the wallet is not back almost at once
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!address) return;
    if (localStorage.getItem(seen(address))) return close();
    setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!visible && !err) return null;
  const ready = Boolean(address);
  const step = !owner ? 1 : !address ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[60] grid animate-[fadein_.25s_ease] place-items-center overflow-y-auto bg-[#0b0b0d]/95 p-5 backdrop-blur">
      <div className="w-full max-w-[860px] rounded-[32px] border border-line bg-panel p-6 md:p-9">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">{err ? "Your wallet hit a snag" : ready ? "Your wallet is ready" : "Making your wallet"}</h2>
            <p className="mt-1 text-mute">{err ? "nothing was lost, try again in a moment" : ready ? "no seed phrase to write down, and every move in the game is free" : "one moment, this only happens the first time"}</p>
            <ol className="mt-6 flex flex-col gap-1">
              <Step done title="Signed in" active={false} />
              <Step done={step > 1} active={step === 1 && !err} title="Your wallet, made by Dynamic" detail={owner ? short(owner) : "creating a secure wallet for you"} />
              <Step done={step > 2} active={step === 2 && !err} title="Gas free game account" detail={address ? short(address) : "so you never pay for a move"} />
            </ol>
            {err ? (
              <div className="mt-5">
                <p className="text-sm break-all text-down">{err.split("\n")[0]}</p>
                <Btn className="mt-3" onClick={() => location.reload()}>
                  Try again
                </Btn>
              </div>
            ) : (
              ready && (
                <Btn size="lg" className="mt-6 animate-[fadein_.3s_ease]" onClick={close}>
                  Let's play
                </Btn>
              )
            )}
          </div>

          {/* the mon above a card back that gets the address stamped on it */}
          <div className="relative mx-auto flex flex-col items-center">
            <div className={err ? "mon-shake" : ready ? "mon-hop" : "mon-bob"}>
              <Mon mood={err ? "sad" : ready ? "happy" : "think"} px={6} paws="none" />
            </div>
            <div className={`-mt-3 ${ready ? "bm-card size-tile is-facedown is-locking" : "bm-card size-tile is-facedown"}`}>
              <div className="inner">
                <div className="side front" />
                <CardBack side="mine" label="your wallet" commit={address} note="wallet" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

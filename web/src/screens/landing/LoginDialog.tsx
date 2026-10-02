import { useCallback, useEffect, useRef, useState } from "react";
import { Mon, MonPaws, type MonMood } from "../../ui/Mon";
import { Login, type LoginState } from "./Login";

const PX = 7;

// what the mon says and how it looks for each moment of the sign in
function react(s: LoginState, poked: boolean): { mood: MonMood; say: string } {
  if (poked) return { mood: "happy", say: "hehe, that tickles" };
  if (s.error) return { mood: "sad", say: s.step === "code" ? "hmm, that code did not work. try again?" : "oops, that did not work" };
  switch (s.step) {
    case "google":
      return { mood: "happy", say: "off to google, see you in a sec" };
    case "sending":
      return { mood: "think", say: "sending your code…" };
    case "verifying":
      return { mood: "think", say: "checking…" };
    case "done":
      return { mood: "happy", say: "you are in! dealing your cards" };
    case "code":
      return s.focus === "code" ? { mood: "shy", say: "i wont peek at your code" } : { mood: "watch", say: "check your inbox for a 6 digit code" };
    default:
      if (s.focus === "email") return { mood: "watch", say: s.typed > 5 ? "go on, i am reading along" : "type your email" };
      return { mood: "idle", say: "hi, i am mon. sign in and i will deal you five AI cards" };
  }
}

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LoginState>({ step: "start", focus: null, typed: 0, error: "" });
  const [poked, setPoked] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const onState = useCallback((s: LoginState) => setState(s), []);
  const { mood, say } = react(state, poked);

  // a fresh error makes the mon shake its head once
  useEffect(() => {
    if (state.error) setShakeKey((k) => k + 1);
  }, [state.error]);

  useEffect(() => {
    if (!poked) return;
    const t = setTimeout(() => setPoked(false), 900);
    return () => clearTimeout(t);
  }, [poked]);

  // escape closes, focus starts inside the dialog
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && state.step !== "verifying" && onClose();
    addEventListener("keydown", on);
    dialog.current?.querySelector<HTMLElement>("input")?.focus();
    return () => removeEventListener("keydown", on);
  }, [onClose, state.step]);

  // while typing the email the mon reads along: eyes down, sliding right as the text grows
  const look = mood === "watch" && state.focus === "email" ? { x: state.typed < 8 ? -1 : state.typed < 18 ? 0 : 1, y: 1 } : mood === "watch" ? { x: 0, y: 1 } : undefined;
  const motion = mood === "happy" ? "mon-hop" : state.error ? "mon-shake" : "mon-bob";

  return (
    <div className="fixed inset-0 z-50 grid animate-[fadein_.2s_ease] place-items-center bg-black/70 px-5 backdrop-blur-sm" onClick={() => state.step !== "verifying" && onClose()}>
      <div className="relative w-full max-w-[460px] pt-[96px]" onClick={(e) => e.stopPropagation()}>
        {/* speech bubble, pixel style, next to the mon */}
        <div key={say} className="absolute top-0 right-0 left-[calc(50%+74px)] z-20 animate-[bubble-in_.22s_ease_both] sm:right-auto sm:w-[200px]">
          <div className="relative rounded-2xl border-2 border-[#101113] bg-white px-3 py-2 text-[13px] leading-snug font-semibold text-[#101113] shadow-[3px_3px_0_#101113]">
            {say}
            <span className="absolute top-5 -left-[9px] h-3 w-3 rotate-45 border-b-2 border-l-2 border-[#101113] bg-white" aria-hidden />
          </div>
        </div>

        {/* the head sits behind the dialog's top edge, so it peeks over it */}
        <div className="absolute top-[96px] left-1/2 z-0 -translate-x-1/2 -translate-y-[calc(100%-14px)] overflow-hidden" style={{ width: 22 * PX, height: 15 * PX }}>
          <button aria-label="poke the mon" onClick={() => setPoked(true)} className="block animate-[mon-peek_.45s_cubic-bezier(.2,.7,.2,1)_both]">
            <div key={`${motion}-${shakeKey}`} className={motion}>
              <Mon mood={mood} look={look} px={PX} paws="none" />
            </div>
          </button>
        </div>

        <div ref={dialog} role="dialog" aria-modal aria-label="sign in to benchmon" className="relative z-10 rounded-3xl border border-white/10 bg-[#111114] p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]">
          {/* paws grip the edge in front of it */}
          <MonPaws px={PX} className={`pointer-events-none absolute -top-[14px] left-1/2 -translate-x-1/2 transition-opacity duration-150 ${mood === "shy" ? "opacity-0" : "opacity-100"}`} />
          <button onClick={onClose} disabled={state.step === "verifying"} aria-label="close" className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30">
            ✕
          </button>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Start playing</h2>
          <p className="mt-1 mb-5 text-sm text-white/55">Sign in with Google or your email. No password, no seed phrase, every move is free.</p>
          <Login onState={onState} />
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-white/40">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-neon" />
            your wallet is made for you by Dynamic, gas is on us
          </p>
        </div>
      </div>
    </div>
  );
}

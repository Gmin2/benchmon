import { useEffect, useMemo, useRef, useState } from "react";
import { sendEmailOTP, verifyOTP } from "@dynamic-labs-sdk/client";
import { loadCards, type Card } from "../chain";
import { GameCard } from "../ui/Card";
import { Brand, Frame, PxButton, Ticker } from "../ui/layout";
import { infoOf } from "../ui/meta";
import { Icon, type IconName } from "../ui/pixel";

type Otp = Awaited<ReturnType<typeof sendEmailOTP>>;

const FAN = [-24, -15, -7, 0, 7, 15, 24];
const HAND = ["mimo-v2.6-pro", "kimi-k3", "claude-opus-5.5", "claude-fable-5", "deepseek-v4.1-flash", "gemini-3.8-flash", "glm-5.3"];

function Word({ children, lime, icon }: { children: string; lime?: boolean; icon?: IconName }) {
  return (
    <span className={`flex items-center gap-2 px-3 leading-none ${lime ? "bg-primary/85 text-bg" : ""}`}>
      {icon && <Icon name={icon} className="h-[0.7em] w-[0.7em]" />}
      {children}
    </span>
  );
}

function Fan({ cards }: { cards: Card[] }) {
  const hand = useMemo(() => {
    const byName = Object.fromEntries(cards.map((c) => [c.name, c]));
    return HAND.map((n) => byName[n]).filter((c): c is Card => Boolean(c));
  }, [cards]);
  return (
    <div className="relative mt-12 h-[330px] w-full max-w-[820px]">
      {hand.length === 0
        ? FAN.map((r, i) => (
            <div key={i} className="fan-card h-[250px] w-[170px] rounded-[6px] bg-subcolor" style={{ "--x": `${r * 12}px`, "--y": `${Math.abs(r) * 1.3}px`, "--r": `${r}deg`, "--n": i, zIndex: i } as React.CSSProperties} />
          ))
        : hand.map((c, i) => {
            const r = FAN[i]!;
            return (
              <div key={c.id} className="fan-card" style={{ "--x": `${r * 12}px`, "--y": `${Math.abs(r) * 1.3}px`, "--r": `${r}deg`, "--n": i, zIndex: i } as React.CSSProperties}>
                <GameCard info={infoOf(c)} size="tile" />
              </div>
            );
          })}
    </div>
  );
}

function CodeBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, ch: string) => {
    const digits = ch.replace(/\D/g, "");
    if (!digits) return;
    onChange((value.slice(0, i) + digits + value.slice(i + digits.length)).slice(0, 6));
    refs.current[Math.min(5, i + digits.length)]?.focus();
  };
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`digit ${i + 1}`}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => set(i, e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            set(0, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              onChange(value.slice(0, i - 1));
              refs.current[i - 1]?.focus();
            }
          }}
          className="px-corners h-14 w-12 bg-shade text-center font-display text-2xl text-main outline-none focus:bg-highlight"
        />
      ))}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState<Otp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const send = async () => {
    setBusy(true);
    setErr("");
    try {
      setOtp(await sendEmailOTP({ email }));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const verify = async () => {
    if (!otp) return;
    setBusy(true);
    setErr("");
    try {
      await verifyOTP({ otpVerification: otp, verificationToken: code });
    } catch {
      setErr("that code did not work, check it or send a new one");
      setBusy(false);
    }
  };
  useEffect(() => {
    if (code.length === 6 && otp && !busy) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div id="login" className="mt-10 flex w-full max-w-[460px] flex-col items-center gap-4 px-4">
      {!otp ? (
        <form
          className="flex w-full flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) send();
          }}
        >
          <label className="px-corners flex h-[47px] flex-1 items-center gap-2 bg-shade px-3 focus-within:bg-highlight">
            <Icon name="mail" className="h-4 w-4 text-subtext" />
            <input
              type="email"
              autoComplete="email"
              placeholder="your email"
              aria-label="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-main outline-none placeholder:text-subtext"
            />
          </label>
          <PxButton type="submit" disabled={!valid || busy}>
            {busy ? "Sending" : "Start playing"}
          </PxButton>
        </form>
      ) : (
        <>
          <p className="text-center font-mono text-sm text-subtext">
            code sent to <span className="text-main">{email}</span>
          </p>
          <CodeBoxes value={code} onChange={setCode} disabled={busy} />
          <div className="flex gap-3">
            <PxButton disabled={code.length !== 6 || busy} onClick={verify}>
              {busy ? "Checking" : "Enter the arena"}
            </PxButton>
            <PxButton
              dark
              disabled={busy}
              onClick={() => {
                setOtp(null);
                setCode("");
                setErr("");
              }}
            >
              Change email
            </PxButton>
          </div>
        </>
      )}
      <p className="text-center font-mono text-xs leading-5 text-subtext">no password and nothing to install. your account is ready the moment you log in, and every move is free.</p>
      {err && <p className="text-center font-mono text-sm text-error">{err}</p>}
    </div>
  );
}

export function Welcome() {
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      loadCards()
        .then((c) => alive && setCards(c))
        .catch(() => alive && setTimeout(load, 2000));
    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="relative min-h-svh bg-[radial-gradient(ellipse_at_50%_-10%,#1e2610_0%,#0d0d10_55%)]">
      <nav className="fixed top-0 left-0 z-50 w-full bg-bg/70 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1236px] items-center justify-between px-5">
          <Brand />
          <Ticker tag="LIVE" onClick={() => document.getElementById("login")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            15 real models on monad testnet
          </Ticker>
          <PxButton dark onClick={() => document.getElementById("login")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            Log in
          </PxButton>
        </div>
      </nav>

      <main className="relative flex min-h-svh flex-col items-center overflow-hidden pt-[110px] pb-24">
        <div className="pixel-field pointer-events-none absolute inset-x-0 bottom-0 h-1/2 [mask-image:linear-gradient(transparent,#000)]" />
        <h1 className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 font-display text-[clamp(34px,5.4vw,78px)]">
          <Word>PICK</Word>
          <Word lime icon="lock">LOCK</Word>
          <Word>REVEAL</Word>
          <Word lime icon="power">WIN</Word>
        </h1>

        <Fan cards={cards} />

        <Frame className="relative mt-16 text-center text-base leading-6 md:text-[17px]">
          every card is a real ai model with live benchmark stats.
          <br />
          build a deck of five, stake on it and let the numbers fight.
        </Frame>

        <Login />
      </main>

      <footer className="relative border-t border-line px-5 py-5">
        <div className="mx-auto flex max-w-[1236px] flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[11px] text-subtext">
          <span>benchmon · monad metropolis 2026</span>
          <span>
            stats: arena (cc-by), openrouter prices · art: lpc artists (cc-by-sa) ·{" "}
            <a className="underline hover:text-main" href="/art/CREDITS-characters.md" target="_blank" rel="noreferrer">
              credits
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

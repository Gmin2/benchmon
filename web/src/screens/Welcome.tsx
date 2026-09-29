import { useEffect, useMemo, useRef, useState } from "react";
import { sendEmailOTP, verifyOTP } from "@dynamic-labs-sdk/client";
import { loadCards, type Card } from "../chain";
import { GameCard } from "../ui/Card";
import { Crest, Wordmark, pillGhost, pillLime } from "../ui/brand";
import { infoOf } from "../ui/meta";
import { Icon, type IconName } from "../ui/pixel";

type Otp = Awaited<ReturnType<typeof sendEmailOTP>>;

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "power", title: "build a deck of five", body: "every card is a real model with six stats from live benchmarks. strong decks cost power, and a deck has to stay under 1600." },
  { icon: "lock", title: "lock in, then reveal", body: "each round picks an arena stat. you both lock a card face down, then flip. the higher stat wins, with a type edge for the counter pick." },
  { icon: "reasoning", title: "the models fight for real", body: "the last round is a live duel. both models answer the same prompt and a judge model picks the winner, posted onchain." },
];

function Hand({ cards }: { cards: Card[] }) {
  const picks = useMemo(() => {
    const byName = Object.fromEntries(cards.map((c) => [c.name, c]));
    return ["kimi-k3", "claude-fable-5", "deepseek-v4.1-flash"].map((n) => byName[n]).filter((c): c is Card => Boolean(c));
  }, [cards]);
  return (
    <div className="relative aspect-[1/1] max-h-[600px] w-full rounded-[28px] overflow-hidden border border-gray-15 bg-gray-10">
      <img src="/art/arenas/code@1x.png" alt="" className="pixel absolute inset-0 w-full h-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_55%,transparent,rgba(0,0,0,.7))]" />
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-gray-5/80 backdrop-blur px-4 py-2 font-mono text-xs uppercase tracking-widest text-gray-85">
        <Icon name="code" className="w-4 h-4 text-lime" />
        arena <b className="text-lime font-bold">code</b>
      </div>
      {picks.length === 3 ? (
        <div className="absolute inset-x-0 bottom-[11%] flex justify-center">
          {picks.map((c, i) => (
            <div
              key={c.id}
              className="hand-card"
              style={{ "--i": i - 1, zIndex: i === 1 ? 3 : 1 } as React.CSSProperties}
            >
              <GameCard info={infoOf(c)} size="tile" arena="code" />
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-[7%] flex justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-[198px] aspect-[5/7.4] rounded-xl bg-gray-15/80 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}

function CodeBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, ch: string) => {
    const digits = ch.replace(/\D/g, "");
    if (!digits) return;
    const next = (value.slice(0, i) + digits + value.slice(i + digits.length)).slice(0, 6);
    onChange(next);
    refs.current[Math.min(5, i + digits.length)]?.focus();
  };
  return (
    <div className="flex gap-2">
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
          className="w-12 h-14 rounded-xl bg-gray-10 border border-gray-20 text-center font-mono text-xl text-gray-95 outline-none focus:border-lime transition"
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
    <div className="w-full max-w-md">
      {!otp ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) send();
          }}
        >
          <label className="font-mono text-xs uppercase tracking-widest text-gray-50" htmlFor="email">
            start with your email
          </label>
          <div className="flex gap-2 rounded-full bg-gray-10 border border-gray-20 p-1.5 focus-within:border-lime transition">
            <span className="grid place-items-center pl-3 text-gray-50">
              <Icon name="mail" className="w-4 h-4" />
            </span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-gray-95 placeholder:text-gray-50 text-[15px]"
            />
            <button type="submit" className={pillLime} disabled={!valid || busy}>
              {busy ? "sending" : "send code"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-gray-50">
            we sent a 6 digit code to <span className="text-gray-85 normal-case tracking-normal font-sans text-sm">{email}</span>
          </p>
          <CodeBoxes value={code} onChange={setCode} disabled={busy} />
          <div className="flex gap-2 items-center mt-1">
            <button className={pillLime} disabled={code.length !== 6 || busy} onClick={verify}>
              {busy ? "checking" : "enter the arena"}
            </button>
            <button
              className={pillGhost}
              disabled={busy}
              onClick={() => {
                setOtp(null);
                setCode("");
                setErr("");
              }}
            >
              change email
            </button>
          </div>
        </div>
      )}
      <p className="mt-4 text-sm text-gray-50 leading-relaxed">no passwords and nothing to install. your account is ready the moment you log in, and moves cost you nothing.</p>
      {err && <p className="mt-3 text-sm text-loss">{err}</p>}
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
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <Wordmark />
        <span className="flex items-center gap-2 rounded-full border border-gray-20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-gray-70">
          <span className="w-1.5 h-1.5 rounded-full bg-lime" />
          live on monad testnet
        </span>
      </header>

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-6 md:px-10 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center py-8 lg:py-12">
        <section className="flex flex-col gap-7">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-lime">pvp card battles · real benchmarks</span>
          <h1 className="font-wide font-semibold text-[40px] leading-[1.02] md:text-[60px] tracking-[-0.01em]">
            every card is a<br />
            real ai model.
          </h1>
          <p className="text-gray-70 text-lg leading-relaxed max-w-[34ch]">
            pick five, stake on your deck and let the numbers fight. when a lab ships a new model, the cards change.
          </p>
          <Login />
        </section>
        <section>
          <Hand cards={cards} />
        </section>
      </main>

      <section className="w-full max-w-[1240px] mx-auto px-6 md:px-10 pb-14">
        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-gray-15 bg-gray-10 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-gray-15 text-lime">
                  <Icon name={s.icon} className="w-4 h-4" />
                </span>
                <span className="font-mono text-xs text-gray-50">0{i + 1}</span>
              </div>
              <h2 className="font-semibold text-lg">{s.title}</h2>
              <p className="text-sm text-gray-70 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-15 px-6 md:px-10 py-5 flex flex-wrap gap-x-6 gap-y-2 items-center justify-between font-mono text-[11px] uppercase tracking-widest text-gray-50">
        <span className="flex items-center gap-2">
          <Crest className="w-4 h-4" />
          benchmon · monad metropolis 2026
        </span>
        <span>
          stats: arena (cc-by), openrouter prices · art: lpc artists (cc-by-sa),{" "}
          <a className="underline hover:text-gray-85" href="/art/CREDITS-characters.md" target="_blank" rel="noreferrer">
            credits
          </a>
        </span>
      </footer>
    </div>
  );
}

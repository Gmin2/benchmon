import { useEffect, useRef, useState } from "react";
import { sendEmailOTP, verifyOTP } from "@dynamic-labs-sdk/client";

type Otp = Awaited<ReturnType<typeof sendEmailOTP>>;
type Tone = "dark" | "light";

const T = {
  dark: {
    form: "bg-panel border border-line focus-within:border-neon/60",
    input: "text-ink placeholder:text-dim",
    btn: "bg-neon text-bg hover:bg-neon-hi",
    box: "border-line bg-panel text-ink focus:border-neon",
    note: "text-mute",
    strong: "text-ink",
    link: "text-ink",
    err: "text-down",
  },
  light: {
    form: "bg-white shadow-sm",
    input: "text-[#0f1a08] placeholder:text-[#0f1a08]/40",
    btn: "bg-[#0f1a08] text-neon hover:bg-black",
    box: "border-[#0f1a08]/15 bg-white text-[#0f1a08] focus:border-[#0f1a08]",
    note: "text-[#0f1a08]/70",
    strong: "text-[#0f1a08]",
    link: "text-[#0f1a08]",
    err: "text-[#b3261e]",
  },
};

function CodeBoxes({ value, onChange, disabled, tone }: { value: string; onChange: (v: string) => void; disabled?: boolean; tone: Tone }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, ch: string) => {
    const digits = ch.replace(/\D/g, "");
    if (!digits) return;
    onChange((value.slice(0, i) + digits + value.slice(i + digits.length)).slice(0, 6));
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
          className={`h-14 w-12 rounded-2xl border-2 text-center text-2xl font-bold outline-none ${T[tone].box}`}
        />
      ))}
    </div>
  );
}

// email then a 6 digit code, the whole account flow
export function Login({ tone = "dark", cta = "Start playing", className = "" }: { tone?: Tone; cta?: string; className?: string }) {
  const t = T[tone];
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
    <div id="login" className={`flex w-full max-w-[460px] flex-col gap-3 ${className}`}>
      {!otp ? (
        <form
          className={`flex gap-2 rounded-full p-1.5 transition ${t.form}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) send();
          }}
        >
          <input type="email" autoComplete="email" placeholder="your email" aria-label="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`min-w-0 flex-1 bg-transparent pl-4 text-[15px] font-medium outline-none ${t.input}`} />
          <button type="submit" disabled={!valid || busy} className={`h-12 shrink-0 rounded-full px-6 text-[15px] font-bold transition disabled:opacity-40 ${t.btn}`}>
            {busy ? "Sending" : cta}
          </button>
        </form>
      ) : (
        <>
          <p className={`text-sm font-medium ${t.note}`}>
            code sent to <b className={t.strong}>{email}</b>
          </p>
          <CodeBoxes value={code} onChange={setCode} disabled={busy} tone={tone} />
          <button
            className={`w-fit text-sm font-semibold underline underline-offset-4 ${t.link}`}
            disabled={busy}
            onClick={() => {
              setOtp(null);
              setCode("");
              setErr("");
            }}
          >
            use another email
          </button>
        </>
      )}
      {err && <p className={`text-sm font-medium ${t.err}`}>{err}</p>}
    </div>
  );
}

export const scrollToLogin = () => document.getElementById("login")?.scrollIntoView({ behavior: "smooth", block: "center" });

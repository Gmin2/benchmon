import { useEffect, useRef, useState } from "react";
import { sendEmailOTP, signInWithSocialRedirect, verifyOTP } from "@dynamic-labs-sdk/client";

type Otp = Awaited<ReturnType<typeof sendEmailOTP>>;

// what the flow is doing right now, so a parent (the mon) can react to it
export type LoginState = {
  step: "start" | "sending" | "code" | "verifying" | "google" | "done";
  focus: "email" | "code" | null;
  typed: number; // characters in the email box, for the mon to follow the caret
  error: string;
};
type Tone = "dark" | "light";

const T = {
  dark: {
    form: "bg-panel border border-line focus-within:border-neon/60",
    input: "text-ink placeholder:text-dim",
    btn: "bg-neon text-bg hover:bg-neon-hi",
    social: "bg-ink text-bg hover:bg-white",
    or: "text-dim before:bg-line after:bg-line",
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
    social: "bg-white text-[#0f1a08] shadow-sm hover:bg-[#f4f4f4]",
    or: "text-[#0f1a08]/45 before:bg-[#0f1a08]/15 after:bg-[#0f1a08]/15",
    box: "border-[#0f1a08]/15 bg-white text-[#0f1a08] focus:border-[#0f1a08]",
    note: "text-[#0f1a08]/70",
    strong: "text-[#0f1a08]",
    link: "text-[#0f1a08]",
    err: "text-[#b3261e]",
  },
};

// the google mark from the nucleo social set, two tone in the text colour
const GoogleMark = () => (
  <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M29.44,16.318c0-.993-.089-1.947-.255-2.864h-13.185v5.422h7.535c-.331,1.744-1.324,3.22-2.813,4.213v3.525h4.544c2.647-2.444,4.175-6.033,4.175-10.296Z" opacity=".4" />
    <path d="M16,30c3.78,0,6.949-1.247,9.265-3.385l-4.544-3.525c-1.247,.84-2.838,1.349-4.722,1.349-3.64,0-6.733-2.456-7.84-5.765l-2.717,2.09-1.941,1.525c2.304,4.569,7.025,7.713,12.498,7.713Z" />
    <path d="M8.16,18.66c-.28-.84-.445-1.731-.445-2.66s.165-1.82,.445-2.66v-3.615H3.502c-.955,1.884-1.502,4.009-1.502,6.275s.547,4.391,1.502,6.275h3.332s1.327-3.615,1.327-3.615Z" opacity=".4" />
    <path d="M16,7.575c2.062,0,3.895,.713,5.358,2.087l4.009-4.009c-2.431-2.265-5.587-3.653-9.367-3.653-5.473,0-10.195,3.144-12.498,7.725l4.658,3.615c1.107-3.309,4.2-5.765,7.84-5.765Z" />
  </svg>
);

function CodeBoxes({ value, onChange, disabled, tone, onFocus, onBlur, shake }: { value: string; onChange: (v: string) => void; disabled?: boolean; tone: Tone; onFocus?: () => void; onBlur?: () => void; shake?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    refs.current[Math.min(value.length, 5)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);
  const set = (i: number, ch: string) => {
    const digits = ch.replace(/\D/g, "");
    if (!digits) return;
    onChange((value.slice(0, i) + digits + value.slice(i + digits.length)).slice(0, 6));
    refs.current[Math.min(5, i + digits.length)]?.focus();
  };
  return (
    <div className={`flex gap-2 ${shake ? "animate-[shake_.4s_ease]" : ""}`}>
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
          onFocus={onFocus}
          onBlur={onBlur}
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
export function Login({ tone = "dark", cta = "Start playing", className = "", onState }: { tone?: Tone; cta?: string; className?: string; onState?: (s: LoginState) => void }) {
  const t = T[tone];
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState<Otp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [focus, setFocus] = useState<LoginState["focus"]>(null);
  const [step, setStep] = useState<LoginState["step"]>("start");
  const [wait, setWait] = useState(0);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  useEffect(() => {
    onState?.({ step, focus, typed: email.length, error: err });
  }, [step, focus, email.length, err, onState]);

  // a new code can be asked for 30s after the last one
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const nice = (m: string) =>
    /rate|too many|429/i.test(m) ? "too many tries, wait a minute and try again" : /invalid.*email|email.*invalid/i.test(m) ? "that email does not look right" : /network|fetch/i.test(m) ? "cannot reach the login service, check your connection" : m.split("\n")[0]!;

  const send = async () => {
    setBusy(true);
    setErr("");
    setStep("sending");
    try {
      setOtp(await sendEmailOTP({ email }));
      setCode("");
      setWait(30);
      setStep("code");
    } catch (e) {
      setErr(nice((e as Error).message));
      setStep(otp ? "code" : "start");
    }
    setBusy(false);
  };
  // google sends the player back to /home, where App finishes the sign in
  const google = async () => {
    setBusy(true);
    setErr("");
    setStep("google");
    try {
      await signInWithSocialRedirect({ provider: "google", redirectUrl: `${window.location.origin}/home` });
    } catch (e) {
      const m = (e as Error).message;
      setErr(/not supported/i.test(m) ? "google sign in is not switched on yet, use your email for now" : nice(m));
      setStep("start");
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!otp) return;
    setBusy(true);
    setErr("");
    setStep("verifying");
    try {
      await verifyOTP({ otpVerification: otp, verificationToken: code });
      setStep("done");
    } catch {
      setErr("that code did not work, check it or send a new one");
      setCode("");
      setStep("code");
      setBusy(false);
    }
  };
  useEffect(() => {
    if (code.length === 6 && otp && !busy) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div id="login" className={`flex w-full max-w-[460px] flex-col gap-3 ${className}`}>
      {!otp && (
        <>
          <button type="button" onClick={google} disabled={busy} className={`flex h-14 items-center justify-center gap-3 rounded-full text-[15px] font-bold transition active:scale-[.98] disabled:opacity-50 ${t.social}`}>
            <GoogleMark />
            {step === "google" ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className={`flex items-center gap-3 text-xs font-semibold uppercase before:h-px before:flex-1 after:h-px after:flex-1 ${t.or}`}>or use email</div>
        </>
      )}
      {!otp ? (
        <form
          className={`flex gap-2 rounded-full p-1.5 transition ${t.form}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) send();
          }}
        >
          <input type="email" autoComplete="email" placeholder="your email" aria-label="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} onFocus={() => setFocus("email")} onBlur={() => setFocus(null)} className={`min-w-0 flex-1 bg-transparent pl-4 text-[15px] font-medium outline-none ${t.input}`} />
          <button type="submit" disabled={!valid || busy} className={`h-12 shrink-0 rounded-full px-6 text-[15px] font-bold transition disabled:opacity-40 ${t.btn}`}>
            {step === "sending" ? "Sending…" : cta}
          </button>
        </form>
      ) : (
        <>
          <p className={`text-sm font-medium ${t.note}`}>
            we sent a 6 digit code to <b className={t.strong}>{email}</b>
          </p>
          <CodeBoxes value={code} onChange={setCode} disabled={busy} tone={tone} onFocus={() => setFocus("code")} onBlur={() => setFocus(null)} shake={Boolean(err)} />
          <div className="flex items-center justify-between text-sm">
            <button
              className={`font-semibold underline underline-offset-4 disabled:opacity-50 ${t.link}`}
              disabled={busy}
              onClick={() => {
                setOtp(null);
                setCode("");
                setErr("");
                setStep("start");
              }}
            >
              use another email
            </button>
            <button className={`font-semibold disabled:opacity-50 ${t.note}`} disabled={busy || wait > 0} onClick={send}>
              {step === "verifying" ? "checking…" : wait > 0 ? `send again in ${wait}s` : "send a new code"}
            </button>
          </div>
        </>
      )}
      {err && (
        <p role="alert" className={`text-sm font-medium ${t.err}`}>
          {err}
        </p>
      )}
    </div>
  );
}


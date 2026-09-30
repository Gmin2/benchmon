import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SmartWallet } from "../gas";
import { STARTER_DECKS, byId, type ClassId } from "../mock";
import { checkUsername, claimProfile, profileUrl, siteHost, type Profile } from "../profile";
import { GameCard } from "../ui/Card";
import { CLASSES } from "../ui/generated";
import { Btn, Ico } from "../ui/kit";
import { infoOf } from "../ui/meta";

const STEPS = ["class", "name", "deck", "done"] as const;
type Step = (typeof STEPS)[number];
const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18);

function useNameCheck(name: string, address?: string) {
  const [res, setRes] = useState<{ name: string; free: boolean; reason: string | null } | null>(null);
  useEffect(() => {
    if (name.length < 3) return setRes({ name, free: false, reason: "at least 3 characters" });
    setRes(null);
    const t = setTimeout(() => {
      checkUsername(name, address)
        .then((r) => setRes({ name, ...r }))
        .catch(() => setRes({ name, free: false, reason: "cannot reach the server" }));
    }, 350);
    return () => clearTimeout(t);
  }, [name, address]);
  return res?.name === name ? res : null;
}

function Share({ p, onClose }: { p: Profile; onClose: () => void }) {
  const nav = useNavigate();
  const url = profileUrl(p.username);
  const [copied, setCopied] = useState(false);
  const cls = CLASSES.find((c) => c.cls === p.cls);
  const tweet = `i just joined benchmon as @${p.username}, the card game where the cards are real ai models. come fight me`;
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="mt-6 grid items-center gap-8 md:grid-cols-[300px_1fr]">
      <div className="relative overflow-hidden rounded-[28px] bg-panel-2">
        <img src="/art/arenas/reasoning@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel-2 via-panel-2/40 to-transparent" />
        <div className="relative flex flex-col items-center px-6 pt-6 pb-5 text-center">
          <img src={`/art/classes/${p.cls}-${p.body}-rookie@1x.png`} alt="" className="pixel h-44 w-44 animate-[hero-in_.5s_ease_both] object-contain" />
          <div className="mt-1 text-2xl font-extrabold">@{p.username}</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-mute capitalize">
            <span className="rounded-full bg-neon/15 px-2.5 py-0.5 text-xs font-bold text-neon">rookie</span>
            {cls?.title}
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-3xl font-extrabold">You are in</h2>
        <p className="mt-1 text-mute">This is your page. Share it and anyone can see your record and challenge you.</p>
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-panel-2 p-2 pl-4">
          <span className="min-w-0 flex-1 truncate font-mono text-[15px]">
            {siteHost}/<span className="text-neon">@{p.username}</span>
          </span>
          <button onClick={copy} className="h-10 shrink-0 rounded-xl bg-neon px-4 text-sm font-bold text-bg">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={`https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-bg hover:opacity-90">
            Share on X
          </a>
          <Btn
            kind="ghost"
            onClick={() => {
              onClose();
              nav(`/@${p.username}`);
            }}
          >
            View my page
          </Btn>
        </div>
        <div className="mt-8 flex justify-end">
          <Btn size="lg" onClick={onClose}>
            Enter the arena
          </Btn>
        </div>
      </div>
    </div>
  );
}

// first login: pick who you play as, claim a username and a page, then get a starter deck
export function Onboarding({ wallet, onClose }: { wallet?: SmartWallet; onClose: () => void }) {
  const [step, setStep] = useState<Step>("class");
  const [cls, setCls] = useState<ClassId>("researcher");
  const [body, setBody] = useState<"male" | "female">("male");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Profile | null>(null);
  const check = useNameCheck(name, wallet?.address);
  const deck = STARTER_DECKS[0]!;
  const i = STEPS.indexOf(step);
  const avatar = (c: string, rank = "rookie") => `/art/classes/${c}-${body}-${rank}@1x.png`;

  const finish = async () => {
    if (!wallet) return setErr("your account is still getting ready, try again in a moment");
    setBusy(true);
    setErr("");
    try {
      setDone(await claimProfile(wallet, { username: name, cls, body }));
      setStep("done");
    } catch (e) {
      setErr((e as Error).message.split("\n")[0]!.slice(0, 140));
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal aria-label="set up your player" className="w-full max-w-[920px] rounded-[32px] border border-line bg-panel p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {STEPS.map((s, k) => (
              <span key={s} className={`h-1.5 w-10 rounded-full ${k <= i ? "bg-neon" : "bg-panel-2"}`} />
            ))}
          </div>
          <span className="text-sm text-mute">
            step {i + 1} of {STEPS.length}
          </span>
        </div>

        {step === "class" && (
          <>
            <h2 className="mt-6 text-3xl font-extrabold">Pick your class</h2>
            <p className="mt-1 text-mute">It is how other players see you. Your look levels up as you win.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CLASSES.map((c) => {
                const on = c.cls === cls;
                return (
                  <button key={c.cls} onClick={() => setCls(c.cls as ClassId)} className={`flex flex-col items-center rounded-3xl border-2 p-3 text-center transition ${on ? "border-neon bg-neon/10" : "border-transparent bg-panel-2 hover:bg-raised"}`}>
                    <img src={avatar(c.cls)} alt="" className="pixel h-24 w-24 object-contain" />
                    <span className="mt-1 font-bold capitalize">{c.title}</span>
                    <span className="mt-0.5 text-xs leading-snug text-mute">{c.blurb}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {(["male", "female"] as const).map((b) => (
                  <button key={b} onClick={() => setBody(b)} className={`h-11 rounded-full px-5 text-sm font-semibold ${b === body ? "bg-neon text-bg" : "bg-panel-2 text-mute hover:text-ink"}`}>
                    {b === "male" ? "look a" : "look b"}
                  </button>
                ))}
              </div>
              <Btn onClick={() => setStep("name")}>Next</Btn>
            </div>
          </>
        )}

        {step === "name" && (
          <div className="mt-6 grid items-center gap-8 md:grid-cols-[auto_1fr]">
            <div className="flex gap-2">
              {(["rookie", "ace", "champion"] as const).map((r) => (
                <div key={r} className="flex flex-col items-center gap-1">
                  <img src={avatar(cls, r)} alt="" className={`pixel object-contain ${r === "rookie" ? "h-32 w-32" : "h-24 w-24 opacity-60"}`} />
                  <span className="text-xs text-mute capitalize">{r}</span>
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-3xl font-extrabold">Pick a username</h2>
              <p className="mt-1 text-mute">It is your name in matches, the market and the ranks, and your page link.</p>
              <label className={`mt-5 flex h-14 items-center rounded-2xl border bg-panel-2 px-4 text-lg font-semibold focus-within:border-neon/60 ${check && !check.free && name.length > 0 ? "border-down/50" : "border-line"}`}>
                <span className="text-dim">@</span>
                <input value={name} onChange={(e) => setName(clean(e.target.value))} autoFocus placeholder="yourname" aria-label="username" className="ml-0.5 min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim" />
                <span className="ml-2 shrink-0 text-sm">
                  {name.length === 0 ? null : !check ? (
                    <span className="text-mute">checking…</span>
                  ) : check.free ? (
                    <span className="flex items-center gap-1 text-neon">
                      <Ico name="check" className="h-4 w-4" />
                      free
                    </span>
                  ) : (
                    <span className="text-down">{check.reason}</span>
                  )}
                </span>
              </label>
              <div className="mt-3 truncate rounded-xl bg-panel-2/60 px-4 py-2.5 font-mono text-sm text-mute">
                {siteHost}/<span className={name ? "text-ink" : "text-dim"}>@{name || "yourname"}</span>
              </div>
              <div className="mt-5 flex justify-between">
                <Btn kind="ghost" onClick={() => setStep("class")}>
                  Back
                </Btn>
                <Btn onClick={() => setStep("deck")} disabled={!check?.free}>
                  Next
                </Btn>
              </div>
            </div>
          </div>
        )}

        {step === "deck" && (
          <>
            <h2 className="mt-6 text-3xl font-extrabold">Your starter deck</h2>
            <p className="mt-1 text-mute">Five cards under the 1600 cap, ready to play. Swap cards any time on the Decks page.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {deck.cards.map((id) => (
                <GameCard key={id} info={infoOf(byId(id))} size="mini" style={{ fontSize: 8 }} />
              ))}
            </div>
            {err && <p className="mt-4 text-center text-sm text-down">{err}</p>}
            <div className="mt-6 flex items-center justify-between">
              <Btn kind="ghost" onClick={() => setStep("name")} disabled={busy}>
                Back
              </Btn>
              <Btn size="lg" onClick={finish} disabled={busy}>
                {busy ? "Saving your player…" : `Claim @${name}`}
              </Btn>
            </div>
          </>
        )}

        {step === "done" && done && <Share p={done} onClose={onClose} />}
      </div>
    </div>
  );
}

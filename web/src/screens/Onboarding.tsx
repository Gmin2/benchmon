import { useState } from "react";
import { STARTER_DECKS, byId, type ClassId } from "../mock";
import { saveProfile } from "../profile";
import { GameCard } from "../ui/Card";
import { CLASSES } from "../ui/generated";
import { Btn } from "../ui/kit";
import { infoOf } from "../ui/meta";

const STEPS = ["class", "name", "deck"] as const;

// first login: pick who you play as, then hand over a starter deck so the first match is one tap away
export function Onboarding() {
  const [step, setStep] = useState<(typeof STEPS)[number]>("class");
  const [cls, setCls] = useState<ClassId>("researcher");
  const [body, setBody] = useState<"male" | "female">("male");
  const [handle, setHandle] = useState(() => `player${Math.floor(1000 + Math.random() * 9000)}`);
  const deck = STARTER_DECKS[0]!;
  const i = STEPS.indexOf(step);
  const avatar = (c: string, rank = "rookie") => `/art/classes/${c}-${body}-${rank}@1x.png`;

  const finish = () => saveProfile({ cls, body, handle: handle.trim() || "player" });

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
                  <button key={b} onClick={() => setBody(b)} className={`h-11 rounded-full px-5 text-sm font-semibold capitalize ${b === body ? "bg-neon text-bg" : "bg-panel-2 text-mute hover:text-ink"}`}>
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
              <h2 className="text-3xl font-extrabold">Name your player</h2>
              <p className="mt-1 text-mute">Shown on matches, the market and the ranks.</p>
              <input value={handle} onChange={(e) => setHandle(e.target.value.slice(0, 18))} aria-label="player name" className="mt-5 h-14 w-full rounded-2xl border border-line bg-panel-2 px-5 text-lg font-semibold outline-none focus:border-neon/60" />
              <div className="mt-5 flex justify-between">
                <Btn kind="ghost" onClick={() => setStep("class")}>
                  Back
                </Btn>
                <Btn onClick={() => setStep("deck")} disabled={!handle.trim()}>
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
            <div className="mt-6 flex justify-between">
              <Btn kind="ghost" onClick={() => setStep("name")}>
                Back
              </Btn>
              <Btn size="lg" onClick={finish}>
                Enter the arena
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

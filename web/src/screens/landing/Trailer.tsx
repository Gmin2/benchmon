import { useEffect, useState } from "react";
import { byName } from "../../mock";
import { ARENAS } from "../../rules";
import { GameCard } from "../../ui/Card";
import { artOf, infoOf } from "../../ui/meta";
import { Login, scrollToLogin } from "./Login";
import { Footer, Nav } from "./parts";

// a match that plays on loop: pick, lock face down, flip, winner, next arena
const SCRIPT = [
  { arena: 0, a: "claude-opus-5.5", b: "grok-4.20", win: "a" },
  { arena: 3, a: "kimi-k3", b: "mistral-medium-3.5", win: "b" },
  { arena: 4, a: "deepseek-v4.1-flash", b: "claude-fable-5", win: "a" },
] as const;
const STEPS = ["lock", "flip", "result"] as const;

function useLoop() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 1600);
    return () => clearInterval(t);
  }, []);
  const round = Math.floor(i / STEPS.length) % SCRIPT.length;
  return { r: SCRIPT[round]!, step: STEPS[i % STEPS.length]!, round };
}

export function Trailer() {
  const { r, step, round } = useLoop();
  const arena = ARENAS[r.arena]!;
  const a = infoOf(byName(r.a));
  const b = infoOf(byName(r.b));
  const face = step !== "lock";
  const res = step === "result";
  const opus = byName("claude-opus-5.5");

  return (
    <div className="min-h-svh bg-bg">
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
        <img key={arena} src={`/art/arenas/${arena}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full animate-[fadein_.6s_ease] object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,19,.75),rgba(16,17,19,.2)_35%,rgba(16,17,19,.95))]" />
        <div className="relative">
          <Nav links={false} />
        </div>

        <div className="relative mx-auto flex max-w-[1320px] flex-1 flex-col items-center justify-center px-6">
          <span className="rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur">
            round {round + 1} · arena <b className="text-neon uppercase">{arena}</b>
          </span>
          <div className="mt-6 flex items-center justify-center gap-6 md:gap-12">
            <GameCard key={`a${round}`} info={a} size="tile" arena={arena} facedown={!face} back={{ side: "mine" }} state={res ? (r.win === "a" ? "winner" : "loser") : null} />
            <span className="font-display text-6xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,.6)] md:text-7xl">VS</span>
            <GameCard key={`b${round}`} info={b} size="tile" arena={arena} facedown={!face} back={{ side: "theirs" }} state={res ? (r.win === "b" ? "winner" : "loser") : null} />
          </div>
        </div>

        <div className="relative">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-8 px-6 pt-8 pb-20">
            <h1 className="font-display text-[clamp(52px,7vw,112px)] leading-[.86] uppercase">
              Real models.
              <br />
              <span className="text-neon">Real stakes.</span>
            </h1>
            <div className="flex flex-col gap-4">
              <p className="max-w-[40ch] text-lg text-mute">A pvp card battle where every card is a live AI model. Stake on your deck, lock your picks, watch them fight.</p>
              <button onClick={scrollToLogin} className="h-16 w-fit rounded-full bg-neon px-10 text-lg font-extrabold text-bg uppercase shadow-[0_12px_40px_-10px_rgba(184,255,61,.7)] hover:bg-neon-hi">
                Play for free
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto grid max-w-[1320px] gap-6 px-6 py-24 md:grid-cols-3">
        {[
          ["01", "Build", "Five models, one deck, under 1600 power. Legendaries cost the most."],
          ["02", "Lock", "An arena stat is drawn. Both of you lock a card face down onchain."],
          ["03", "Reveal", "Cards flip, the higher stat takes the round. Round three is a live duel judged by a model."],
        ].map(([n, t, d]) => (
          <div key={n} className="border-t-2 border-neon pt-6">
            <div className="font-display text-6xl text-neon">{n}</div>
            <h3 className="mt-3 font-display text-4xl uppercase">{t}</h3>
            <p className="mt-3 text-lg text-mute">{d}</p>
          </div>
        ))}
      </section>

      <section id="cards" className="relative overflow-hidden bg-panel py-24">
        <div className="mx-auto max-w-[1320px] px-6">
          <h2 className="font-display text-[clamp(44px,6vw,88px)] leading-[.9] uppercase">
            New release,
            <br />
            <span className="text-neon">new card.</span>
          </h2>
          <p className="mt-4 max-w-[52ch] text-lg text-mute">Cards evolve when their stats climb. A lab ships a new model, the card levels up with it, live, from oracle data.</p>
          <div className="mt-12 flex flex-wrap items-end justify-center gap-4 md:justify-between">
            {[1, 2, 3].map((t, i) => (
              <div key={t} className="flex flex-col items-center gap-3">
                <img src={artOf(opus.name, t)} alt="" className="pixel h-56 w-56 object-contain md:h-72 md:w-72" />
                <span className="rounded-full bg-panel-2 px-4 py-1.5 text-sm font-semibold">{["tier 1 · base", "tier 2 · glow", "tier 3 · legendary"][i]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1320px] flex-col items-center gap-6 px-6 py-24 text-center">
        <h2 className="font-display text-[clamp(44px,6vw,96px)] leading-[.9] uppercase">
          Enter the <span className="text-neon">arena</span>
        </h2>
        <Login cta="Play for free" />
      </section>
      <Footer />
    </div>
  );
}

import { ROSTER, byName } from "../../mock";
import { GameCard } from "../../ui/Card";
import { Chip, Ico, type IcoName } from "../../ui/kit";
import { infoOf } from "../../ui/meta";
import { Login } from "./Login";
import { Footer, Nav } from "./parts";

const FEATURES: { icon: IcoName; title: string; body: string }[] = [
  { icon: "layers", title: "Real models, real stats", body: "Every card is a live AI model. Code, math, reasoning, speed, cost and honesty come from public benchmarks, pushed onchain by Chainlink." },
  { icon: "lock", title: "Lock, reveal, win", body: "Each round picks an arena stat. Both players lock a card face down, then flip. Counter types get a 10% edge." },
  { icon: "energy", title: "The last round is live", body: "Round three, the two models answer the same prompt for real. A judge model scores them and posts the verdict onchain." },
];

export function AppLook() {
  const opus = infoOf(byName("claude-opus-5.5"));
  const grok = infoOf(byName("grok-4.20"));
  return (
    <div className="min-h-svh bg-app">
      <Nav />
      <main className="mx-auto max-w-[1320px] px-6">
        <section className="grid items-center gap-12 py-10 lg:grid-cols-[1fr_1.05fr] lg:py-16">
          <div className="flex flex-col gap-7">
            <span className="w-fit">
              <Chip tone="up">
                <span className="h-1.5 w-1.5 rounded-full bg-neon" />
                Season 1 live on Monad testnet
              </Chip>
            </span>
            <h1 className="text-[46px] leading-[1.02] font-extrabold tracking-tight md:text-[64px]">
              Every card is a <span className="text-neon">real AI model.</span>
            </h1>
            <p className="max-w-[46ch] text-lg text-mute">Build a deck of five, stake on it and let live benchmarks fight. When a lab ships a new model, the cards change.</p>
            <Login />
            <div className="flex flex-wrap gap-6 text-sm text-mute">
              {["15 models", "gas free moves", "email login, no wallet setup"].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <Ico name="check" className="h-4 w-4 text-neon" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] bg-panel p-3">
            <div className="relative overflow-hidden rounded-[24px]">
              <img src="/art/arenas/code@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,19,.5),rgba(16,17,19,.1)_40%,rgba(16,17,19,.7))]" />
              <div className="relative flex items-center justify-between p-4">
                <span className="rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur">
                  Round 2 of 3 · arena <b className="text-neon">CODE</b>
                </span>
                <span className="rounded-xl bg-black/60 px-3 py-1 text-lg font-extrabold backdrop-blur">
                  <span className="text-neon">1</span>
                  <span className="mx-1.5 text-white/40">:</span>
                  <span className="text-down">0</span>
                </span>
              </div>
              <div className="relative flex items-center justify-center gap-6 px-6 pt-2 pb-8">
                <GameCard info={opus} size="tile" arena="code" facing={grok.type} state="winner" />
                <span className="font-display text-5xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,.6)]">VS</span>
                <GameCard info={grok} size="tile" arena="code" facing={opus.type} state="loser" />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 pt-4 pb-2 text-sm">
              <span className="text-mute">match #39 · pot 0.20 MON</span>
              <span className="flex items-center gap-2 text-neon">
                <span className="h-2 w-2 animate-pulse rounded-full bg-neon" />
                128 watching
              </span>
            </div>
          </div>
        </section>

        <section id="how" className="grid gap-4 py-10 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-[28px] bg-panel p-7">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-neon/12 text-neon">
                <Ico name={f.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mute">{f.body}</p>
            </div>
          ))}
        </section>

        <section id="cards" className="py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold md:text-4xl">The roster</h2>
              <p className="mt-2 text-mute">15 models from 12 labs. Stats update as new benchmarks land.</p>
            </div>
            <Chip tone="flat">updated sept 28</Chip>
          </div>
          <div className="mt-8 flex gap-4 overflow-x-auto pb-4 [scrollbar-width:none]">
            {[...ROSTER].sort((a, b) => infoOf(b).power - infoOf(a).power).map((c) => (
              <GameCard key={c.id} info={infoOf(c)} size="tile" className="shrink-0" />
            ))}
          </div>
        </section>

        <section className="my-12 flex flex-col items-center gap-6 rounded-[36px] bg-[linear-gradient(120deg,#2a3a0e,#1e1f23_65%)] px-6 py-14 text-center">
          <h2 className="text-3xl font-extrabold md:text-5xl">Your first match is one email away.</h2>
          <Login cta="Get started" />
        </section>
      </main>
      <Footer />
    </div>
  );
}

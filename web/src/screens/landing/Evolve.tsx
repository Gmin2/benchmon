import { devUrl } from "../../dev";
import { Login } from "./Login";
import { byName } from "../../mock";
import { CardBack, GameCard } from "../../ui/Card";
import { Ico, type IcoName } from "../../ui/kit";
import { artOf, infoOf } from "../../ui/meta";


type Offer = { title: string; body: string; line: string; art: React.ReactNode; icon: IcoName };

export function Evolve() {
  const fable = infoOf(byName("claude-fable-5"));
  const kimi = infoOf(byName("kimi-k3"));
  const opus = infoOf(byName("claude-opus-5.5"));
  const grok = infoOf(byName("grok-4.20"));

  const offers: Offer[] = [
    {
      title: "Build a deck",
      body: "Five real models, six live benchmark stats each. Stay under 1600 power.",
      line: "Strong cards cost more.",
      icon: "layers",
      art: (
        <div className="relative h-[150px] w-[190px]">
          {[kimi, opus, fable].map((c, i) => (
            <div key={c.card.id} className="absolute top-3 left-1/2 origin-bottom" style={{ translate: `calc(-50% + ${(i - 1) * 40}px) ${Math.abs(i - 1) * 8}px`, rotate: `${(i - 1) * 12}deg` }}>
              <GameCard info={c} size="mini" style={{ fontSize: 5.5 }} />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Lock & reveal",
      body: "Each round picks an arena stat. You both lock a card face down, then flip.",
      line: "Higher stat wins. Counter types get 10%.",
      icon: "lock",
      art: (
        <div className="bm-card size-mini is-facedown" style={{ fontSize: 6.5, rotate: "-6deg" }}>
          <div className="inner">
            <div className="side front" />
            <CardBack side="mine" commit="0x7557a0c3be12f9e4d8a1c2b3f4e5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c13918" />
          </div>
        </div>
      ),
    },
    {
      title: "Live duel",
      body: "Round three, the two models answer the same prompt. A judge model decides.",
      line: "Verdict posted onchain.",
      icon: "energy",
      art: (
        <div className="flex items-end gap-1">
          <img src={artOf(opus.card.name, 3)} alt="" className="pixel h-24 w-24 object-contain" />
          <span className="mb-8 font-display text-2xl text-[#0f1a08]">VS</span>
          <img src={artOf(grok.card.name, 1)} alt="" className="pixel h-24 w-24 -scale-x-100 object-contain" />
        </div>
      ),
    },
  ];

  const scrollToLogin = () => document.getElementById("login")?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="min-h-svh bg-[radial-gradient(120%_80%_at_0%_0%,#1f5a1e,#0b1f0e_45%,#07120a)] p-3 md:p-6">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[40px] bg-[#050806]">
        {/* nav */}
        <header className="relative z-20 flex items-center justify-between px-6 py-6 md:px-10">
          <span className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-neon/70 font-display text-2xl text-neon">B</span>
            <span className="font-display text-2xl tracking-[0.12em] text-white">BENCHMON</span>
          </span>
          <div className="flex items-center gap-4">
            {import.meta.env.DEV && (
              <a href={devUrl("a")} className="hidden text-sm font-semibold text-white/60 hover:text-white sm:block">
                dev mode
              </a>
            )}
            <button onClick={scrollToLogin} className="h-14 rounded-full border-2 border-neon px-8 text-sm font-extrabold tracking-wide text-neon uppercase transition hover:bg-neon hover:text-[#050806]">
              Log in
            </button>
          </div>
        </header>

        {/* hero */}
        <section className="relative -mt-4 h-[560px] md:h-[620px]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-6 bg-cover bg-center text-center font-display leading-[.82] text-transparent select-none"
            style={{ backgroundImage: "linear-gradient(rgba(10,40,16,.55),rgba(10,40,16,.75)), url(/art/arenas/code@1x.png)", backgroundClip: "text", WebkitBackgroundClip: "text", fontSize: "clamp(120px, 21vw, 330px)", imageRendering: "pixelated" }}
          >
            BENCHMON
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_50%_at_50%_55%,rgba(184,255,61,.18),transparent_70%)]" />

          <span className="absolute top-[18%] right-[10%] rotate-[-8deg] font-display text-[clamp(28px,4vw,56px)] leading-[.9] text-neon/90 drop-shadow-[0_4px_0_rgba(0,0,0,.6)]">
            REAL
            <br />
            MODELS
          </span>
          <span className="absolute bottom-[26%] left-[8%] rotate-[-6deg] font-display text-[clamp(24px,3.4vw,48px)] leading-[.9] text-neon/80">
            LIVE
            <br />
            STATS
          </span>
          <span className="absolute top-[46%] right-[6%] rotate-[-10deg] font-display text-[clamp(22px,3vw,42px)] leading-[.9] text-white/80">
            NO
            <br />
            BLUFF
          </span>

          <img src={artOf(fable.card.name, 3)} alt="claude fable 5, a legendary card" className="pixel absolute bottom-[96px] left-1/2 h-[82%] -translate-x-1/2 object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,.6)] lg:left-[40%]" />
        </section>

        {/* bottom band */}
        <section className="relative z-10 -mt-20 grid gap-6 rounded-t-[36px] bg-[#e4e9d6] px-6 pt-10 pb-8 text-[#0f1a08] md:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:pb-12">
          <div className="flex flex-col gap-5">
            <h1 className="font-display text-[clamp(48px,5.6vw,84px)] leading-[.92] uppercase">
              Pick. Lock.
              <br />
              Win.
            </h1>
            <p className="max-w-[40ch] text-lg leading-snug font-medium text-[#0f1a08]/75">A card battle where every card is a real AI model. Stake on your deck, and when a lab ships a new model, the cards change.</p>
            <Login tone="light" />
            <p className="text-xs font-medium text-[#0f1a08]/50">no password, nothing to install, every move is free.</p>
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-3 lg:-mt-40">
            {offers.map((o) => (
              <article key={o.title} className="relative flex flex-col items-center rounded-[28px] bg-neon px-5 pt-6 pb-16 text-center shadow-[0_20px_50px_-20px_rgba(0,0,0,.5)]">
                <div className="grid h-[160px] place-items-center">{o.art}</div>
                <h2 className="mt-3 font-display text-3xl tracking-wide uppercase">{o.title}</h2>
                <p className="mt-2 text-[13px] leading-snug font-medium text-[#0f1a08]/80">{o.body}</p>
                <p className="mt-2 text-[13px] leading-snug font-bold">{o.line}</p>
                <button onClick={scrollToLogin} className="absolute bottom-0 left-1/2 flex h-12 -translate-x-1/2 items-center gap-2 rounded-t-[22px] bg-[#e4e9d6] px-7 text-sm font-extrabold whitespace-nowrap tracking-wide uppercase">
                  <Ico name={o.icon} className="h-4 w-4" />
                  Play now
                </button>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 bg-[#e4e9d6] px-6 pb-6 text-xs font-medium text-[#0f1a08]/55 md:px-12">
          <span>benchmon · monad metropolis 2026 · live on monad testnet</span>
          <span>
            stats: arena (cc-by), openrouter prices · art: lpc artists (cc-by-sa) ·{" "}
            <a className="underline" href="/art/CREDITS-characters.md" target="_blank" rel="noreferrer">
              credits
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}

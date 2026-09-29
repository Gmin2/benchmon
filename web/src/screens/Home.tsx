import { useMemo } from "react";
import { DECK_CAP, LIVE_MATCHES, ME, OPEN_MATCHES, PLAYERS, avatarOf, byId, byName, type LiveMatch } from "../mock";
import { ARENAS } from "../rules";
import { GameCard } from "../ui/Card";
import { Ico, type IcoName } from "../ui/kit";
import { artOf, infoOf, tierOf } from "../ui/meta";
import { loadDecks } from "./Decks";

type Go = (tab: "play" | "trade" | "decks" | "ranks") => void;
const TITLES = ["server room", "chalk hall", "library", "night track", "market", "court"];

function Hero({ go }: { go: Go }) {
  const champ = infoOf(byName("claude-fable-5"));
  const rate = Math.round((ME.wins / (ME.wins + ME.losses)) * 100);
  return (
    <section className="relative overflow-hidden rounded-[36px] bg-[#050806]">
      {/* huge type filled with the arena, the evolve look */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-4 text-center font-display leading-[.82] text-transparent select-none"
        style={{ backgroundImage: "linear-gradient(rgba(10,40,16,.5),rgba(10,40,16,.8)), url(/art/arenas/reasoning@1x.png)", backgroundSize: "cover", backgroundPosition: "center", backgroundClip: "text", WebkitBackgroundClip: "text", fontSize: "clamp(110px, 17vw, 270px)", imageRendering: "pixelated" }}
      >
        SEASON 1
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(35%_55%_at_68%_60%,rgba(184,255,61,.2),transparent_70%)]" />

      <span className="absolute top-[14%] right-[5%] hidden rotate-[-8deg] font-display text-[clamp(26px,3vw,46px)] leading-[.9] text-neon drop-shadow-[0_4px_0_rgba(0,0,0,.6)] md:block">
        13 DAYS
        <br />
        LEFT
      </span>
      <span className="absolute right-[40%] bottom-[16%] hidden rotate-[-6deg] font-display text-[clamp(20px,2.4vw,36px)] leading-[.9] text-white/80 lg:block">
        25 MON
        <br />
        POOL
      </span>

      <div className="relative grid min-h-[480px] items-end gap-6 p-7 md:grid-cols-[1fr_auto] md:p-10">
        <div className="relative z-10 flex flex-col gap-6 self-end">
          <div className="flex items-center gap-3">
            <img src={avatarOf(ME)} alt="" className="pixel h-14 w-14 rounded-2xl bg-white/10 object-cover" />
            <div>
              <div className="text-sm text-white/60">welcome back</div>
              <div className="flex items-center gap-2 text-xl font-bold text-white">
                {ME.handle}
                <span className="rounded-lg bg-neon/15 px-2 py-0.5 text-xs font-semibold text-neon capitalize">{ME.rank}</span>
              </div>
            </div>
          </div>
          <h2 className="font-display text-[clamp(52px,6vw,92px)] leading-[.9] text-white uppercase">
            Ready to
            <br />
            <span className="text-neon">battle?</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => go("play")} className="flex h-16 items-center gap-3 rounded-full bg-neon px-9 text-lg font-extrabold text-bg uppercase shadow-[0_12px_40px_-10px_rgba(184,255,61,.7)] transition hover:bg-neon-hi active:scale-[.98]">
              <Ico name="gamepad" className="h-6 w-6" />
              Quick match
            </button>
            <button onClick={() => go("decks")} className="h-16 rounded-full border-2 border-neon/70 px-8 text-sm font-extrabold tracking-wide text-neon uppercase transition hover:bg-neon/10">
              Edit deck
            </button>
          </div>
          <div className="flex gap-6 text-white">
            {[
              [`${ME.wins}`, "wins"],
              [`${rate}%`, "win rate"],
              [`${ME.winnings.toFixed(2)}`, "MON won"],
              [`#9`, "season rank"],
            ].map(([v, k]) => (
              <div key={k}>
                <div className="text-2xl font-extrabold">{v}</div>
                <div className="text-xs text-white/50">{k}</div>
              </div>
            ))}
          </div>
        </div>
        <img src={artOf(champ.card.name, 3)} alt="" className="pixel pointer-events-none relative z-0 hidden h-[430px] w-[430px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,.6)] md:block" />
      </div>
    </section>
  );
}

type Mode = { title: string; body: string; cta: string; icon: IcoName; onClick: () => void; art: React.ReactNode };

function Modes({ go }: { go: Go }) {
  const opus = infoOf(byName("claude-opus-5.5"));
  const kimi = infoOf(byName("kimi-k3"));
  const grok = byName("grok-4.20");
  const gem = byName("gemini-3.8-flash");
  const modes: Mode[] = [
    {
      title: "Quick match",
      body: "We find you an opponent with a similar deck. Stake 0.05 MON, winner takes the pot.",
      cta: "Play now",
      icon: "gamepad",
      onClick: () => go("play"),
      art: (
        <div className="relative h-[140px] w-[170px]">
          {[kimi, opus].map((c, i) => (
            <div key={c.card.id} className="absolute top-2 left-1/2" style={{ translate: `calc(-50% + ${(i ? 1 : -1) * 26}px) ${i ? 0 : 6}px`, rotate: `${i ? 8 : -8}deg` }}>
              <GameCard info={c} size="mini" style={{ fontSize: 5.5 }} />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Join a match",
      body: `${OPEN_MATCHES.length} players are waiting for an opponent right now, stakes from 0.01 MON.`,
      cta: "See open seats",
      icon: "circle-plus",
      onClick: () => go("play"),
      art: (
        <div className="flex -space-x-5">
          {OPEN_MATCHES.slice(0, 3).map((m) => (
            <img key={m.id} src={avatarOf(m.host, false)} alt="" className="pixel h-28 w-24 object-contain" />
          ))}
        </div>
      ),
    },
    {
      title: "Watch live",
      body: `${LIVE_MATCHES.length} matches running. Back a side before the first reveal and win with them.`,
      cta: "Watch and back",
      icon: "eye-2",
      onClick: () => go("trade"),
      art: (
        <div className="flex items-end gap-1">
          <img src={artOf(grok.name, 1)} alt="" className="pixel h-24 w-24 object-contain" />
          <span className="mb-8 font-display text-2xl text-[#0f1a08]">VS</span>
          <img src={artOf(gem.name, 2)} alt="" className="pixel h-24 w-24 -scale-x-100 object-contain" />
        </div>
      ),
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {modes.map((m) => (
        <article key={m.title} className="relative flex min-h-[330px] flex-col items-center rounded-[28px] bg-neon px-5 pt-5 pb-16 text-center text-[#0f1a08]">
          <div className="grid h-[150px] place-items-center">{m.art}</div>
          <h3 className="mt-2 font-display text-3xl tracking-wide uppercase">{m.title}</h3>
          <p className="mt-2 text-[13px] leading-snug font-medium text-[#0f1a08]/75">{m.body}</p>
          <button onClick={m.onClick} className="absolute bottom-0 left-1/2 flex h-12 -translate-x-1/2 items-center gap-2 rounded-t-[22px] bg-[#e4e9d6] px-7 text-sm font-extrabold tracking-wide whitespace-nowrap uppercase transition hover:bg-white">
            <Ico name={m.icon} className="h-4 w-4" />
            {m.cta}
          </button>
        </article>
      ))}
    </div>
  );
}

function LiveCard({ m, onWatch }: { m: LiveMatch; onWatch: () => void }) {
  const a = infoOf(byName(m.cardA));
  const b = infoOf(byName(m.cardB));
  return (
    <button onClick={onWatch} className="group relative flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[28px] bg-panel text-left transition hover:-translate-y-1">
      <div className="relative h-[170px] overflow-hidden">
        <img src={`/art/arenas/${ARENAS[m.arena]}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-black/10 to-black/30" />
        <img src={artOf(a.card.name, tierOf(a))} alt="" className="pixel absolute bottom-0 left-2 h-32 w-32 object-contain" />
        <img src={artOf(b.card.name, tierOf(b))} alt="" className="pixel absolute right-2 bottom-0 h-32 w-32 -scale-x-100 object-contain" />
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#ff2d6f] px-3 py-1 text-xs font-bold text-white uppercase">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {m.duel ? "live duel" : "live"}
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{m.watchers} watching</span>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-3 py-1 text-xl font-extrabold backdrop-blur">
          <span className="text-neon">{m.winsA}</span>
          <span className="mx-1.5 text-white/40">:</span>
          <span className="text-down">{m.winsB}</span>
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <img src={avatarOf(m.a)} alt="" className="pixel h-8 w-8 rounded-lg bg-panel-2 object-cover" />
            <span className="max-w-[88px] truncate font-semibold">{m.a.handle}</span>
          </span>
          <span className="shrink-0 text-dim">vs</span>
          <span className="flex items-center gap-2">
            <span className="max-w-[88px] truncate font-semibold">{m.b.handle}</span>
            <img src={avatarOf(m.b)} alt="" className="pixel h-8 w-8 rounded-lg bg-panel-2 object-cover" />
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-mute">
          <span>
            round {m.round + 1} · <span className="text-ink uppercase">{ARENAS[m.arena]}</span> · {TITLES[m.arena]}
          </span>
          <span className="font-semibold text-neon">{m.pot} MON</span>
        </div>
        {/* who the market favours */}
        <div className="flex h-2 overflow-hidden rounded-full bg-down/40">
          <span className="h-full bg-neon" style={{ width: `${m.priceA * 100}%` }} />
        </div>
      </div>
    </button>
  );
}

export function Home({ go }: { go: Go }) {
  const deck = useMemo(() => loadDecks()[0]!, []);
  const deckCards = deck.cards.map((id) => infoOf(byId(id)));
  const power = deckCards.reduce((a, c) => a + c.power, 0);
  const top = PLAYERS.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <Hero go={go} />

      <section className="rounded-[36px] bg-[#e4e9d6] p-5 md:p-7">
        <div className="mb-5 flex items-end justify-between px-1 text-[#0f1a08]">
          <h2 className="font-display text-4xl uppercase">Pick your fight</h2>
          <span className="hidden text-sm font-semibold text-[#0f1a08]/60 sm:block">every move is gas free</span>
        </div>
        <Modes go={go} />
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-4xl uppercase">Live now</h2>
          <button onClick={() => go("trade")} className="text-sm font-semibold text-mute hover:text-ink">
            see all ›
          </button>
        </div>
        <div className="-mx-2 flex gap-5 overflow-x-auto px-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LIVE_MATCHES.map((m) => (
            <LiveCard key={m.id} m={m} onWatch={() => go("trade")} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[36px] bg-panel p-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl uppercase">Your deck</h2>
              <div className="text-sm text-mute">
                {deck.name} · {power} / {DECK_CAP} power
              </div>
            </div>
            <button onClick={() => go("decks")} className="h-11 rounded-full border-2 border-neon/70 px-5 text-sm font-bold text-neon hover:bg-neon/10">
              Edit
            </button>
          </div>
          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {deckCards.map((c) => (
              <GameCard key={c.card.id} info={c} size="mini" style={{ fontSize: 9 }} />
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(160deg,#2a3a0e,#1e1f23_60%)] p-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl uppercase">Top players</h2>
            <button onClick={() => go("ranks")} className="text-sm font-semibold text-mute hover:text-ink">
              ranks ›
            </button>
          </div>
          <div className="mt-4 flex items-end justify-center gap-3">
            {[top[1]!, top[0]!, top[2]!].map((p, i) => (
              <div key={p.handle} className="flex flex-col items-center">
                <img src={avatarOf(p, false)} alt="" className={`pixel object-contain ${i === 1 ? "h-32 w-32" : "h-24 w-24"}`} />
                <div className={`mt-1 grid w-24 place-items-center rounded-t-2xl ${i === 1 ? "h-20 bg-neon text-bg" : "h-14 bg-panel-2"}`}>
                  <span className="font-display text-3xl">{[2, 1, 3][i]}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{p.handle}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

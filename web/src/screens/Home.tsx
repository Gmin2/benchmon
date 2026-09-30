import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DECK_CAP, LIVE_MATCHES, PLAYERS, avatarOf, byId, byName, type LiveMatch } from "../mock";
import { ARENAS } from "../rules";
import { GameCard } from "../ui/Card";
import { Ico, type IcoName } from "../ui/kit";
import { artOf, infoOf, tierOf } from "../ui/meta";
import { loadDecks } from "./Decks";
import { short, useBalance } from "../hooks";
import { useWallet } from "../useWallet";
import { useMe } from "../profile";
import { formatEther } from "viem";
import { isMine, openSeats, useOwed, withdraw, type AnyWrite } from "../duel";
import { loadMarkets } from "../market";
import { usePoll } from "../hooks";
import { faceOf } from "./play/parts";

type Go = (tab: "play" | "trade" | "decks" | "ranks") => void;
const TITLES = ["server room", "chalk hall", "library", "night track", "market", "court"];

// winnings wait in the contract until claimed, so they get a banner until they are
function Claim() {
  const { address, write } = useWallet();
  const [owed, setOwed] = useOwed(address);
  const [state, setState] = useState<"" | "busy" | "done">("");
  const [err, setErr] = useState("");
  if (owed === 0n && state !== "done") return null;
  const amount = Number(formatEther(owed)).toFixed(3);
  const claim = async () => {
    setState("busy");
    setErr("");
    try {
      await withdraw(write as unknown as AnyWrite);
      setOwed(0n);
      setState("done");
      setTimeout(() => setState(""), 4000);
    } catch (e) {
      setErr((e as Error).message.split("\n")[0]!.slice(0, 120));
      setState("");
    }
  };
  const done = state === "done";
  return (
    <section className={`flex flex-wrap items-center justify-between gap-4 rounded-[28px] p-5 ${done ? "bg-panel" : "bg-[linear-gradient(110deg,#b8ff3d,#8fe04a)] text-bg"}`}>
      <div className="flex items-center gap-4">
        <span className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl font-extrabold ${done ? "bg-neon/15 text-neon" : "bg-bg/10"}`}>✓</span>
        <div>
          <div className="text-lg font-extrabold">{done ? "Claimed, it is in your balance" : `${amount} MON waiting for you`}</div>
          <div className={`text-sm ${done ? "text-mute" : "text-bg/70"}`}>{done ? "gas was on us" : err || "winnings and refunds from your matches, one tap and it lands in your balance"}</div>
        </div>
      </div>
      {!done && (
        <button onClick={claim} disabled={state === "busy"} className="h-12 rounded-full bg-bg px-7 font-bold text-neon transition hover:bg-panel disabled:opacity-60">
          {state === "busy" ? "Claiming…" : `Claim ${amount} MON`}
        </button>
      )}
    </section>
  );
}

function Account() {
  const { me: ME } = useMe();
  const { address } = useWallet();
  const balance = useBalance(address);
  const rate = Math.round((ME.wins / (ME.wins + ME.losses)) * 100);
  const next = { rookie: 10, trainer: 25, ace: 50, champion: 50 }[ME.rank];
  const nextName = { rookie: "trainer", trainer: "ace", ace: "champion", champion: "champion" }[ME.rank];
  const stats: [string, string][] = [
    [`${ME.wins}`, "wins"],
    [`${rate}%`, "win rate"],
    [ME.winnings.toFixed(2), "MON won"],
    ["#9", "season rank"],
    [`${ME.streak}`, "win streak"],
  ];
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex items-center gap-4 rounded-[28px] bg-panel p-5">
        <img src={avatarOf(ME, false)} alt="" className="pixel h-24 w-24 shrink-0 rounded-2xl bg-panel-2 object-contain" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-xl font-bold">{ME.handle}</span>
            <span className="rounded-lg bg-neon/15 px-2 py-0.5 text-xs font-semibold text-neon capitalize">{ME.rank}</span>
          </div>
          <div className="mt-0.5 text-sm text-mute capitalize">{ME.cls}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-panel-2 px-3 py-1 font-mono text-xs text-mute">{address ? short(address) : "setting up"}</span>
            <span className="rounded-full bg-panel-2 px-3 py-1 font-semibold">{balance.toFixed(3)} MON</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-[28px] bg-panel p-5 sm:grid-cols-5">
        {stats.map(([v, k]) => (
          <div key={k} className="flex flex-col justify-center rounded-2xl bg-panel-2 px-3 py-4 text-center">
            <div className="text-2xl font-extrabold">{v}</div>
            <div className="mt-1 text-xs text-mute">{k}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col justify-center gap-4 rounded-[28px] bg-[linear-gradient(150deg,#2a3a0e,#1e1f23_65%)] p-5">
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-mute">next rank · <span className="text-ink capitalize">{nextName}</span></span>
            <span className="font-semibold">
              {ME.wins}/{next}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-neon" style={{ width: `${Math.min(100, (ME.wins / next) * 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-mute">season 1 · 25 MON pool</span>
            <span className="font-semibold">13 days left</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/30">
            <div className="h-full w-[57%] rounded-full bg-white/70" />
          </div>
        </div>
      </div>
    </section>
  );
}

type Mode = { title: string; body: string; cta: string; icon: IcoName; onClick: () => void; art: React.ReactNode };

function Modes({ go }: { go: Go }) {
  const nav = useNavigate();
  const { data: seats = [] } = usePoll(() => openSeats(), 8000, []);
  const opus = infoOf(byName("claude-opus-5.5"));
  const kimi = infoOf(byName("kimi-k3"));
  const grok = byName("grok-4.20");
  const gem = byName("gemini-3.8-flash");
  const modes: Mode[] = [
    {
      title: "Quick match",
      body: "One tap, your last deck and stake. We find an opponent with a similar deck, winner takes the pot.",
      cta: "Play now",
      icon: "gamepad",
      onClick: () => nav("/play", { state: { quick: true } }),
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
      body: seats.length ? `${seats.length} ${seats.length === 1 ? "player is" : "players are"} waiting for an opponent right now.` : "No one is waiting right now. Open a seat and the next player joins you.",
      cta: "See open seats",
      icon: "circle-plus",
      onClick: () => go("play"),
      art: (
        <div className="flex -space-x-5">
          {(seats.length ? seats.slice(0, 3).map((x) => faceOf(x.m.a)) : PLAYERS.slice(3, 6)).map((p, i) => (
            <img key={i} src={avatarOf(p, false)} alt="" className="pixel h-28 w-24 object-contain" />
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

// matches still before their first reveal, so spectators can back a side or trade them right now
function BetsOpen() {
  const nav = useNavigate();
  const { address } = useWallet();
  const { data: rows = [] } = usePoll(() => loadMarkets(12), 4000, []);
  const open = rows.filter((r) => r.betting && !isMine(r.match, address));
  if (!open.length) return null;
  return (
    <section className="rounded-[28px] border border-neon/30 bg-neon/5 p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-neon" />
        </span>
        <h2 className="text-xl font-extrabold">Bets open now</h2>
        <span className="text-sm text-mute">closes at the first card reveal, be quick</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {open.map((r) => (
          <button key={r.id.toString()} onClick={() => nav(`/trade?m=${r.id}`)} className="flex items-center gap-4 rounded-2xl bg-panel px-4 py-3 text-left transition hover:bg-panel-2">
            <div>
              <div className="font-semibold">Match #{r.id.toString()}</div>
              <div className="text-xs text-mute">
                {r.match.state === 0 ? "waiting for a player" : "picking cards"} · pot {(Number(formatEther(r.match.stake)) * 2).toFixed(2)} MON
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-bold text-neon">{r.open ? `A ${Math.round(r.priceA * 100)}¢` : "pool"}</div>
              <div className="text-xs text-dim">{(r.poolA + r.poolB).toFixed(3)} MON backed</div>
            </div>
            <span className="rounded-full bg-neon px-3 py-1.5 text-xs font-bold text-bg">Bet</span>
          </button>
        ))}
      </div>
    </section>
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

export function Home() {
  const nav = useNavigate();
  const go: Go = (t) => nav(`/${t}`);
  const deck = useMemo(() => loadDecks()[0]!, []);
  const deckCards = deck.cards.map((id) => infoOf(byId(id)));
  const power = deckCards.reduce((a, c) => a + c.power, 0);
  const top = PLAYERS.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <Claim />
      <Account />
      <BetsOpen />

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

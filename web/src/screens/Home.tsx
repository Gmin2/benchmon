import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { type Card } from "../chain";
import { deckOf, short, useCards, usePoll } from "../hooks";
import { cents, loadHistory, loadMarkets, type MarketRow } from "../market";
import { ARENAS } from "../rules";
import { useWallet } from "../useWallet";
import { GameCard } from "../ui/Card";
import { AreaChart } from "../ui/chart";
import { MARKS } from "../ui/generated";
import { Btn, Chip, Ico, Panel, SearchBar } from "../ui/kit";
import { artOf, infoOf, tierOf } from "../ui/meta";
import { LabMark } from "../ui/pixel";

type Filter = "Explore" | "Live" | "Open seats" | "My matches";
const FILTERS: Filter[] = ["Explore", "Live", "Open seats", "My matches"];

function lead(deck: Card[]) {
  return [...deck].sort((a, b) => infoOf(b).power - infoOf(a).power)[0];
}

function statusOf(m: MarketRow) {
  const s = m.match;
  if (s.state === 0) return { label: "Open seat", tone: "up" as const, live: false };
  if (s.state === 2) return { label: s.result === 1 ? "A won" : s.result === 2 ? "B won" : "Draw", tone: "flat" as const, live: false };
  if (s.awaitingVerdict) return { label: "Live duel", tone: "violet" as const, live: true };
  return { label: `Round ${s.round + 1}`, tone: "gold" as const, live: true };
}

function Banner({ cards, onPlay }: { cards: Card[]; onPlay: () => void }) {
  const fan = useMemo(() => ["kimi-k3", "claude-fable-5", "deepseek-v4.1-flash"].map((n) => cards.find((c) => c.name === n)).filter((c): c is Card => Boolean(c)), [cards]);
  return (
    <section className="relative flex min-h-[300px] overflow-hidden rounded-[var(--radius-panel)] bg-[linear-gradient(115deg,#b8ff3d_0%,#9be64a_45%,#5fbf6a_100%)] text-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_40%,rgba(255,255,255,.35),transparent_45%)]" />
      <div className="relative z-10 flex max-w-[520px] flex-col justify-center gap-5 p-8 md:p-10">
        <span className="w-fit rounded-full bg-bg/10 px-3 py-1 text-sm font-semibold">Season 1 · Monad testnet</span>
        <h2 className="text-[38px] leading-[1.05] font-extrabold tracking-tight md:text-[46px]">Every card is a real AI model.</h2>
        <p className="max-w-[40ch] text-[15px] font-medium text-bg/70">Build a deck of five from live benchmarks, stake on it, and let the numbers fight. New releases change the cards.</p>
        <button onClick={onPlay} className="h-14 w-fit rounded-2xl bg-bg px-8 text-[15px] font-semibold text-ink transition hover:bg-panel active:scale-[.98]">
          Play a match
        </button>
      </div>
      <div className="relative hidden w-[44%] shrink-0 items-end justify-center overflow-hidden pb-4 pl-6 lg:flex">
        {fan.map((c, i) => (
          <div key={c.id} className="-mx-12" style={{ rotate: `${(i - 1) * 8}deg`, translate: `0 ${Math.abs(i - 1) * 16}px`, zIndex: i === 1 ? 2 : 1 }}>
            <GameCard info={infoOf(c)} size="tile" />
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchTile({ m, cards, onBack, onWatch }: { m: MarketRow; cards: Card[]; onBack: () => void; onWatch: () => void }) {
  // the card in play when there is one, the strongest card of the deck otherwise
  const played = (mask: bigint, used: bigint, id: number, shown: boolean) => (shown || (m.match.state === 2 && (used >> BigInt(id)) & 1n) ? cards.find((c) => c.id === id) : lead(deckOf(mask, cards)));
  const a = played(m.match.deckA, m.match.usedA, m.match.cardA, m.match.revealedA);
  const b = m.match.b.startsWith("0x0000") ? undefined : played(m.match.deckB, m.match.usedB, m.match.cardB, m.match.revealedB);
  const st = statusOf(m);
  const arena = ARENAS[m.match.arena] ?? "code";
  const pot = Number(formatEther(m.match.stake)) * (m.match.state === 0 ? 1 : 2);
  return (
    <div className="flex flex-col rounded-[var(--radius-panel)] bg-panel p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
        <img src={`/art/arenas/${arena}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="absolute inset-x-0 bottom-10 flex items-end justify-center gap-2">
          {a && <img src={artOf(a.name, tierOf(infoOf(a)))} alt={infoOf(a).display} className="pixel h-36 w-36 object-contain drop-shadow-[0_6px_0_rgba(0,0,0,.35)]" />}
          <span className="mb-10 font-display text-3xl text-white drop-shadow">VS</span>
          {b ? (
            <img src={artOf(b.name, tierOf(infoOf(b)))} alt={infoOf(b).display} className="pixel h-36 w-36 -scale-x-100 object-contain drop-shadow-[0_6px_0_rgba(0,0,0,.35)]" />
          ) : (
            <span className="grid h-36 w-36 place-items-center text-sm font-semibold text-white/70">open seat</span>
          )}
        </div>
        <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-bg">
          <Ico name="eye-2" className="h-4 w-4" />
          {pot.toFixed(2)} MON
        </span>
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-black/55 px-3 py-2 backdrop-blur">
          <span className="text-[17px] font-semibold text-white">Match #{m.id.toString()}</span>
          {st.live ? (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff2d6f] text-white" title="live">
              <Ico name="energy" className="h-4 w-4" />
            </span>
          ) : (
            <Chip tone={st.tone}>{st.label}</Chip>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[15px]">
        <span className="text-mute">{m.open ? "Side A price" : "Stake each"}</span>
        <span className="font-semibold text-neon">{m.open ? cents(m.priceA) : `${formatEther(m.match.stake)} MON`}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-dim">
        <span>{short(m.match.a)}</span>
        <span>{m.match.b.startsWith("0x0000") ? "waiting" : short(m.match.b)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Btn size="sm" className="h-11" onClick={onBack} disabled={!m.trading && m.match.state !== 0}>
          {m.match.state === 0 ? "Join" : m.trading ? "Back a side" : m.open ? "Closed" : "No market"}
        </Btn>
        <Btn size="sm" kind="ghost" className="h-11 border border-line" onClick={onWatch}>
          Watch
        </Btn>
      </div>
    </div>
  );
}

function Featured({ card, onPlay }: { card: Card; onPlay: () => void }) {
  const i = infoOf(card);
  const mark = MARKS[i.lab];
  return (
    <div className="rounded-3xl bg-panel p-4">
      <div className="relative aspect-[5/4] overflow-hidden rounded-2xl" style={{ background: `radial-gradient(90% 80% at 50% 100%, ${i.main === "#1a1a1a" ? "#555" : i.main}, #16171a)` }}>
        <img src={artOf(card.name, tierOf(i))} alt={i.display} className="pixel absolute inset-x-0 bottom-0 mx-auto h-[115%] object-contain" />
        <span className="absolute right-3 bottom-3 flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[13px] font-semibold text-bg">
          By {i.lab}
          {mark && <LabMark mark={mark} className="h-4 w-4" />}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-panel-2 px-4 py-3">
        <span className="text-lg font-semibold">{i.display}</span>
        <Chip tone={i.rarity === "legendary" ? "gold" : i.rarity === "rare" ? "violet" : "flat"}>{i.rarity}</Chip>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-[15px]">
        {[
          ["Power", `${i.power}`],
          ["Type", i.type],
          ["Best stat", Object.entries(i.stats).sort((a, b) => b[1] - a[1])[0]!.join(" ")],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-mute">{k}</span>
            <span className="font-semibold text-neon">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Btn size="sm" className="h-11" onClick={onPlay}>
          Play it
        </Btn>
        <Btn size="sm" kind="outline" className="h-11">
          Card details
        </Btn>
      </div>
    </div>
  );
}

export function Home({ go }: { go: (tab: "play" | "trade" | "decks") => void }) {
  const cards = useCards();
  const { address } = useWallet();
  const { data: markets = [] } = usePoll(() => loadMarkets(12), 6000, []);
  const [filter, setFilter] = useState<Filter>("Explore");

  const shown = markets.filter((m) => {
    if (filter === "Live") return m.match.state === 1;
    if (filter === "Open seats") return m.match.state === 0;
    if (filter === "My matches") return address && [m.match.a, m.match.b].some((p) => p.toLowerCase() === address.toLowerCase());
    return true;
  });
  const featured = useMemo(() => [...cards].sort((a, b) => infoOf(b).power - infoOf(a).power)[0], [cards]);
  const hot = markets.find((m) => m.open);
  const history = hot ? loadHistory(hot.id) : [];

  const players = useMemo(() => {
    const tally = new Map<string, number>();
    for (const m of markets) {
      if (m.match.state !== 2) continue;
      const w = m.match.result === 1 ? m.match.a : m.match.result === 2 ? m.match.b : null;
      if (w) tally.set(w, (tally.get(w) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [markets]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <SearchBar placeholder='Try "claude opus" or a match number' />
        <nav className="mt-8 flex gap-8 border-b border-line">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`relative pb-4 text-[16px] font-medium transition ${f === filter ? "text-ink" : "text-mute hover:text-ink"}`}>
              {f}
              {f === filter && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-neon" />}
            </button>
          ))}
        </nav>

        <div className="mt-8">
          <Banner cards={cards} onPlay={() => go("play")} />
        </div>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{filter === "Explore" ? "Trending matches" : filter}</h2>
          <Btn size="sm" className="h-11 gap-2" onClick={() => go("play")}>
            <Ico name="circle-plus" className="h-4 w-4" />
            New match
          </Btn>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
          {shown.map((m) => (
            <MatchTile key={m.id.toString()} m={m} cards={cards} onBack={() => go(m.match.state === 0 ? "play" : "trade")} onWatch={() => go("trade")} />
          ))}
          {shown.length === 0 && (
            <Panel className="grid min-h-[280px] place-items-center p-8 text-center text-mute sm:col-span-2 2xl:col-span-3">
              <span>
                {markets.length ? "nothing here yet." : "loading matches…"}
                <br />
                <Btn size="sm" className="mt-4 h-11" onClick={() => go("play")}>
                  Start one
                </Btn>
              </span>
            </Panel>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-8 rounded-[var(--radius-panel)] bg-[linear-gradient(180deg,#1b2210,#16171a_40%)] p-5 xl:-mt-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Featured card</h3>
            <button onClick={() => go("decks")} className="text-sm text-mute underline underline-offset-4 hover:text-ink">
              View all
            </button>
          </div>
          {featured ? <Featured card={featured} onPlay={() => go("play")} /> : <div className="h-[420px] animate-pulse rounded-3xl bg-panel" />}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xl font-bold">Price history</h3>
            <span className="text-sm text-mute">{hot ? `Match #${hot.id} · side A` : "no market yet"}</span>
          </div>
          {hot && (
            <div className="mb-2 flex items-center justify-between text-[15px]">
              <span className="text-mute">Now</span>
              <span className="font-semibold text-neon">{cents(hot.priceA)}</span>
            </div>
          )}
          {history.length > 1 ? (
            <AreaChart data={[...history, { t: Date.now(), v: hot!.priceA }]} format={cents} height={200} />
          ) : (
            <div className="grid h-[160px] place-items-center rounded-2xl border border-dashed border-line text-sm text-mute">opens when a market does</div>
          )}
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold">Top players</h3>
          <div className="flex flex-col gap-2">
            {players.length === 0 && <div className="rounded-2xl bg-panel p-4 text-sm text-mute">wins show up here as matches finish.</div>}
            {players.map(([p, w], i) => (
              <div key={p} className="flex items-center justify-between rounded-2xl bg-panel px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-neon/15 text-sm font-bold text-neon">{i + 1}</span>
                  {short(p)}
                </span>
                <span className="font-semibold">
                  {w} win{w === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

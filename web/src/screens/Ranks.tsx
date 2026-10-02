import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../profile";
import { CARD_RECORDS, PLAYERS, avatarOf, byName, type Player } from "../mock";
import { MARKS } from "../ui/generated";
import { Btn, Chip, Ico, Panel, Seg } from "../ui/kit";
import { artOf, infoOf, tierOf } from "../ui/meta";
import { LabMark } from "../ui/pixel";

const VIEWS = ["Players", "Cards"] as const;
const PERIODS = ["season", "week", "today"] as const;

const rate = (p: Player) => p.wins / Math.max(1, p.wins + p.losses);
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Podium({ players }: { players: Player[] }) {
  const order = [players[1], players[0], players[2]].filter((p): p is Player => Boolean(p));
  const height = ["h-[150px]", "h-[200px]", "h-[120px]"];
  const place = [2, 1, 3];
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-panel px-6 pt-8">
      <img src="/art/arenas/honesty@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-panel/40 to-panel" />
      <div className="relative flex items-end justify-center gap-4 md:gap-8">
        {order.map((p, i) => (
          <div key={p.handle} className="flex w-[180px] flex-col items-center">
            <div className="relative">
              <img src={avatarOf(p, false)} alt="" className={`pixel object-contain ${place[i] === 1 ? "h-44 w-44" : "h-36 w-36"}`} />
              {place[i] === 1 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neon px-3 py-1 text-xs font-bold text-bg">season leader</span>}
            </div>
            <div className="mt-2 text-lg font-bold">{p.handle}</div>
            <div className="text-sm text-mute capitalize">
              {p.cls} · {p.wins} wins
            </div>
            <div className={`mt-3 flex w-full flex-col items-center justify-start rounded-t-3xl pt-4 ${height[i]} ${place[i] === 1 ? "bg-neon text-bg" : "bg-panel-2"}`}>
              <span className="font-display text-5xl">{place[i]}</span>
              <span className={`mt-1 text-sm font-semibold ${place[i] === 1 ? "text-bg/70" : "text-neon"}`}>{p.winnings.toFixed(2)} MON</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayersTable() {
  return (
    <Panel className="p-6">
      <div className="grid grid-cols-[48px_minmax(200px,2fr)_repeat(4,minmax(0,1fr))] gap-y-1 text-[15px]">
        {["#", "Player", "Wins", "Win rate", "Streak", "Winnings"].map((h) => (
          <div key={h} className="pb-3 text-mute">
            {h}
          </div>
        ))}
        {PLAYERS.map((p, i) => (
          <div key={p.handle} className="col-span-6 grid grid-cols-subgrid items-center rounded-2xl py-2.5 transition hover:bg-panel-2">
            <span className={`pl-3 font-bold ${i < 3 ? "text-neon" : "text-mute"}`}>{i + 1}</span>
            <span className="flex items-center gap-3">
              <img src={avatarOf(p)} alt="" className="pixel h-11 w-11 rounded-xl bg-panel-2 object-cover" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.handle}</span>
                <span className="block text-xs text-mute capitalize">
                  {p.cls} · {p.rank}
                </span>
              </span>
            </span>
            <span>
              {p.wins}
              <span className="text-dim"> / {p.losses}</span>
            </span>
            <span>{pct(rate(p))}</span>
            <span>{p.streak > 0 ? <Chip tone="up">{p.streak} in a row</Chip> : <span className="text-dim">—</span>}</span>
            <span className="font-semibold text-neon">{p.winnings.toFixed(2)} MON</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CardsTable() {
  return (
    <Panel className="p-6">
      <div className="grid grid-cols-[48px_minmax(220px,2fr)_repeat(4,minmax(0,1fr))] gap-y-1 text-[15px]">
        {["#", "Card", "Win rate", "Plays", "Duel wins", "This week"].map((h) => (
          <div key={h} className="pb-3 text-mute">
            {h}
          </div>
        ))}
        {CARD_RECORDS.map((r, i) => {
          const info = infoOf(byName(r.name));
          const mark = MARKS[info.lab];
          return (
            <div key={r.name} className="col-span-6 grid grid-cols-subgrid items-center rounded-2xl py-2.5 transition hover:bg-panel-2">
              <span className={`pl-3 font-bold ${i < 3 ? "text-neon" : "text-mute"}`}>{i + 1}</span>
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 50% 90%, ${info.main === "#1a1a1a" || info.main === "#0f0f0f" ? "#666" : info.main}, #26272c 75%)` }}>
                  <img src={artOf(info.card.name, tierOf(info))} alt="" className="pixel h-full w-full scale-125 object-contain" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{info.display}</span>
                    {mark && <LabMark mark={mark} className="h-3.5 w-3.5 shrink-0" />}
                  </span>
                  <span className="block text-xs text-mute capitalize">
                    {info.rarity} · {info.type} · {info.power}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-16 overflow-hidden rounded-full bg-panel-2">
                  <span className="block h-full rounded-full bg-neon" style={{ width: pct(r.winRate) }} />
                </span>
                {pct(r.winRate)}
              </span>
              <span>{r.plays}</span>
              <span>{r.duelWins}</span>
              <span>
                <Chip tone={r.trend > 0 ? "up" : r.trend < 0 ? "down" : "flat"}>
                  {r.trend > 0 ? "+" : ""}
                  {r.trend}%
                </Chip>
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function Ranks() {
  const { me: ME } = useMe();
  const nav = useNavigate();
  const onPlay = () => nav("/play");
  const [view, setView] = useState<(typeof VIEWS)[number]>("Players");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("season");
  const myPlace = PLAYERS.filter((p) => p.wins > ME.wins).length + 1;
  const next = PLAYERS[myPlace - 2];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav className="flex gap-8 border-b border-line">
            {VIEWS.map((v) => (
              <button key={v} onClick={() => setView(v)} className={`relative pb-4 text-[16px] font-medium ${v === view ? "text-ink" : "text-mute hover:text-ink"}`}>
                {v}
                {v === view && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-neon" />}
              </button>
            ))}
          </nav>
          <Seg value={period} options={PERIODS} onChange={setPeriod} />
        </div>
        {view === "Players" ? (
          <>
            <Podium players={PLAYERS} />
            <PlayersTable />
          </>
        ) : (
          <CardsTable />
        )}
      </div>

      <aside className="flex flex-col gap-5">
        <div className="rounded-[var(--radius-panel)] bg-[linear-gradient(160deg,#2a3a0e,#1e1f23_55%)] p-5">
          <div className="text-sm text-mute">Your rank</div>
          <div className="mt-4 flex items-center gap-4">
            <img src={avatarOf(ME, false)} alt="" className="pixel h-24 w-24 object-contain" />
            <div>
              <div className="font-display text-5xl">#{myPlace}</div>
              <div className="text-sm text-mute capitalize">
                {ME.cls} · {ME.rank}
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ["Wins", `${ME.wins}`],
              ["Win rate", pct(rate(ME))],
              ["Winnings", `${ME.winnings.toFixed(2)}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-black/25 py-3">
                <div className="text-lg font-bold">{v}</div>
                <div className="text-xs text-mute">{k}</div>
              </div>
            ))}
          </div>
          {next && (
            <p className="mt-4 text-sm text-mute">
              {next.wins - ME.wins + 1} more wins to pass <span className="text-ink">{next.handle}</span>
            </p>
          )}
          <Btn className="mt-4 w-full" onClick={onPlay}>
            Play to climb
          </Btn>
        </div>

        <Panel className="p-5">
          <div className="flex items-center gap-2 text-sm text-mute">
            <Ico name="star-2" className="h-4 w-4 text-neon" />
            Rank ladder
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {(["rookie", "trainer", "ace", "champion"] as const).map((r, i) => (
              <div key={r} className={`flex items-center gap-3 rounded-2xl p-2 ${ME.rank === r ? "bg-neon/10" : ""}`}>
                <img src={avatarOf({ ...ME, rank: r })} alt="" className="pixel h-12 w-12 rounded-xl bg-panel-2 object-cover" />
                <div className="flex-1">
                  <div className="font-semibold capitalize">{r}</div>
                  <div className="text-xs text-mute">{["start here", "10 wins, scarf", "25 wins, epaulets", "50 wins, gold and a crown"][i]}</div>
                </div>
                {ME.rank === r && <Chip tone="up">you</Chip>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="text-sm text-mute">Season 1</div>
          <div className="mt-1 text-2xl font-bold">ends in 13 days</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full w-[57%] rounded-full bg-neon" />
          </div>
          <p className="mt-3 text-sm text-mute">top 3 split the season pool of 25 MON.</p>
        </Panel>
      </aside>
    </div>
  );
}

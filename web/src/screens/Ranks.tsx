import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RANKS, rankOf } from "../duel";
import { byId, useCards } from "../hooks";
import { ixEmpty, ixNote, mon, useCardRecords, usePlayer, useTopPlayers, type IxCard, type IxPlayer } from "../indexer";
import { avatarOf } from "../mock";
import { useMe, useProfiles } from "../profile";
import { useWallet } from "../useWallet";
import { MARKS } from "../ui/generated";
import { Btn, Chip, Empty, Ico, Panel } from "../ui/kit";
import { artOf, infoOf, tierOf } from "../ui/meta";
import { LabMark } from "../ui/pixel";
import { faceOf, type Face } from "./play/parts";

const VIEWS = ["Players", "Cards"] as const;

const rate = (p: Pick<IxPlayer, "wins" | "losses">) => p.wins / Math.max(1, p.wins + p.losses);
const pct = (v: number) => `${Math.round(v * 100)}%`;

type Row = { p: IxPlayer; face: Face; username?: string };

function useRows(players: IxPlayer[]): Row[] {
  const profileOf = useProfiles(players.map((p) => p.id));
  return players.map((p) => {
    const pr = profileOf(p.id);
    return { p, face: { ...faceOf(p.id, pr), rank: rankOf(p.wins) }, username: pr?.username };
  });
}

function Podium({ rows }: { rows: Row[] }) {
  const order = [rows[1], rows[0], rows[2]].filter((r): r is Row => Boolean(r));
  const height = ["h-[150px]", "h-[200px]", "h-[120px]"];
  const place = rows.length === 1 ? [1] : rows.length === 2 ? [2, 1] : [2, 1, 3];
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-panel px-6 pt-8">
      <img src="/art/arenas/honesty@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-panel/40 to-panel" />
      <div className="relative flex items-end justify-center gap-4 md:gap-8">
        {order.map(({ p, face }, i) => (
          <div key={p.id} className="flex w-[180px] flex-col items-center">
            <div className="relative">
              <img src={avatarOf(face, false)} alt="" className={`pixel object-contain ${place[i] === 1 ? "h-44 w-44" : "h-36 w-36"}`} />
              {place[i] === 1 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neon px-3 py-1 text-xs font-bold text-bg">leader</span>}
            </div>
            <div className="mt-2 max-w-full truncate text-lg font-bold">{face.handle}</div>
            <div className="text-sm text-mute capitalize">
              {face.cls} · {p.wins} wins
            </div>
            <div className={`mt-3 flex w-full flex-col items-center justify-start rounded-t-3xl pt-4 ${height[[2, 1, 3].indexOf(place[i]!)]} ${place[i] === 1 ? "bg-neon text-bg" : "bg-panel-2"}`}>
              <span className="font-display text-5xl">{place[i]}</span>
              <span className={`mt-1 text-sm font-semibold ${place[i] === 1 ? "text-bg/70" : "text-neon"}`}>{mon(p.won).toFixed(2)} MON</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayersTable({ rows }: { rows: Row[] }) {
  const nav = useNavigate();
  return (
    <Panel className="overflow-x-auto p-6">
      <div className="grid min-w-[640px] grid-cols-[48px_minmax(200px,2fr)_repeat(4,minmax(0,1fr))] gap-y-1 text-[15px]">
        {["#", "Player", "Wins", "Win rate", "Matches", "Winnings"].map((h) => (
          <div key={h} className="pb-3 text-mute">
            {h}
          </div>
        ))}
        {rows.map(({ p, face, username }, i) => (
          <div
            key={p.id}
            onClick={username ? () => nav(`/@${username}`) : undefined}
            className={`col-span-6 grid grid-cols-subgrid items-center rounded-2xl py-2.5 transition hover:bg-panel-2 ${username ? "cursor-pointer" : ""}`}
          >
            <span className={`pl-3 font-bold ${i < 3 ? "text-neon" : "text-mute"}`}>{i + 1}</span>
            <span className="flex min-w-0 items-center gap-3">
              <img src={avatarOf(face)} alt="" className="pixel h-11 w-11 rounded-xl bg-panel-2 object-cover" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{face.handle}</span>
                <span className="block text-xs text-mute capitalize">
                  {face.cls} · {face.rank}
                </span>
              </span>
            </span>
            <span>
              {p.wins}
              <span className="text-dim"> / {p.losses}</span>
            </span>
            <span>{pct(rate(p))}</span>
            <span>{p.matches}</span>
            <span className="font-semibold text-neon">{mon(p.won).toFixed(2)} MON</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CardsTable({ records }: { records: IxCard[] }) {
  useCards();
  // win rate is rounds won over plays, cards nobody played yet sit at the bottom
  const rows = records
    .map((r) => ({ r, info: infoOf(byId(Number(r.id))), wr: r.plays ? r.roundWins / Math.max(r.plays, 1) : -1 }))
    .sort((a, b) => b.wr - a.wr || b.r.plays - a.r.plays);
  return (
    <Panel className="overflow-x-auto p-6">
      <div className="grid min-w-[640px] grid-cols-[48px_minmax(220px,2fr)_repeat(4,minmax(0,1fr))] gap-y-1 text-[15px]">
        {["#", "Card", "Win rate", "Plays", "Duel wins", "Rounds"].map((h) => (
          <div key={h} className="pb-3 text-mute">
            {h}
          </div>
        ))}
        {rows.map(({ r, info, wr }, i) => {
          const mark = MARKS[info.lab];
          return (
            <div key={r.id} className="col-span-6 grid grid-cols-subgrid items-center rounded-2xl py-2.5 transition hover:bg-panel-2">
              <span className={`pl-3 font-bold ${i < 3 && wr >= 0 ? "text-neon" : "text-mute"}`}>{i + 1}</span>
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 50% 90%, ${info.main === "#1a1a1a" || info.main === "#0f0f0f" ? "#666" : info.main}, #26272c 75%)` }}>
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
                  <span className="block h-full rounded-full bg-neon" style={{ width: pct(Math.max(0, wr)) }} />
                </span>
                {wr >= 0 ? pct(wr) : "—"}
              </span>
              <span>{r.plays}</span>
              <span>
                {r.liveDuelWins}
                <span className="text-dim"> / {r.liveDuels}</span>
              </span>
              <span>
                <Chip tone="flat">
                  {r.roundWins}-{r.roundLosses}-{r.roundDraws}
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
  const { me } = useMe();
  const { address } = useWallet();
  const nav = useNavigate();
  const onPlay = () => nav("/play");
  const [view, setView] = useState<(typeof VIEWS)[number]>("Players");
  const top = useTopPlayers(100);
  const cards = useCardRecords();
  const mine = usePlayer(address);
  const rows = useRows(top.data ?? []);

  const who = address?.toLowerCase();
  const idx = rows.findIndex((r) => r.p.id === who);
  const myPlace = idx >= 0 ? idx + 1 : null;
  const next = myPlace && myPlace > 1 ? rows[myPlace - 2] : rows.length && !myPlace ? rows[rows.length - 1] : undefined;
  const p = mine.data ?? null;
  const rank = rankOf(p?.wins ?? 0);
  const known = mine.status === "ok";

  const playersBody =
    top.status !== "ok" ? (
      <Empty {...ixEmpty(top.status, "Leaderboard")} />
    ) : rows.length === 0 ? (
      <Empty title="No ranked players yet" body="finish a match and you are on the board." />
    ) : (
      <>
        <Podium rows={rows.slice(0, 3)} />
        <PlayersTable rows={rows} />
      </>
    );
  const cardsBody =
    cards.status !== "ok" ? <Empty {...ixEmpty(cards.status, "Card records")} /> : cards.data!.length === 0 ? <Empty title="No cards played yet" body="card records start with the first reveal." /> : <CardsTable records={cards.data!} />;

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
        </div>
        {view === "Players" ? playersBody : cardsBody}
      </div>

      <aside className="flex flex-col gap-5">
        <div className="rounded-[var(--radius-panel)] bg-[linear-gradient(160deg,#2a3a0e,#1e1f23_55%)] p-5">
          <div className="text-sm text-mute">Your rank</div>
          <div className="mt-4 flex items-center gap-4">
            <img src={avatarOf({ ...me, rank }, false)} alt="" className="pixel h-24 w-24 object-contain" />
            <div>
              <div className="font-display text-5xl">{myPlace ? `#${myPlace}` : "—"}</div>
              <div className="text-sm text-mute capitalize">
                {me.cls} · {rank}
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ["Wins", known ? `${p?.wins ?? 0}` : "—"],
              ["Win rate", known && p && p.wins + p.losses > 0 ? pct(rate(p)) : "—"],
              ["Winnings", known ? mon(p?.won).toFixed(2) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-black/25 py-3">
                <div className="text-lg font-bold">{v}</div>
                <div className="text-xs text-mute">{k}</div>
              </div>
            ))}
          </div>
          {!known ? (
            <p className="mt-4 text-sm text-mute">{ixNote[mine.status]}</p>
          ) : next ? (
            <p className="mt-4 text-sm text-mute">
              {Math.max(0.01, mon(next.p.won) - mon(p?.won)).toFixed(2)} MON more winnings to pass <span className="text-ink">{next.face.handle}</span>
            </p>
          ) : (
            !myPlace && <p className="mt-4 text-sm text-mute">win a match to get on the board.</p>
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
            {RANKS.map((r, i) => (
              <div key={r.name} className={`flex items-center gap-3 rounded-2xl p-2 ${rank === r.name ? "bg-neon/10" : ""}`}>
                <img src={avatarOf({ ...me, rank: r.name })} alt="" className="pixel h-12 w-12 rounded-xl bg-panel-2 object-cover" />
                <div className="flex-1">
                  <div className="font-semibold capitalize">{r.name}</div>
                  <div className="text-xs text-mute">{["start here", "10 wins, scarf", "25 wins, epaulets", "50 wins, gold and a crown"][i]}</div>
                </div>
                {rank === r.name && <Chip tone="up">you</Chip>}
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

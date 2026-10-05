import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatEther, parseEther, type Address } from "viem";
import type { Deck } from "../mock";
import { ZERO, isMine, joinMatch, myActive, openSeats, quickMatch, type AnyWrite, type OpenSeat } from "../duel";
import { byId, deckCap, useBalance, useCards, usePoll } from "../hooks";
import { useWallet } from "../useWallet";
import { useProfiles } from "../profile";
import { GameCard } from "../ui/Card";
import { Btn, Chip, Ico, Panel } from "../ui/kit";
import { infoOf } from "../ui/meta";
import { loadDecks } from "./Decks";
import { Live } from "./play/Live";
import { Practice } from "./play/Practice";
import { Avatar, faceOf } from "./play/parts";

const STAKES = ["0.01", "0.02", "0.05", "0.1"];
const power = (cards: number[]) => cards.reduce((a, id) => a + infoOf(byId(id)).power, 0);
const deckPower = (mask: bigint) => power(Array.from({ length: 64 }, (_, i) => i).filter((i) => (mask >> BigInt(i)) & 1n));

// last deck and stake, so quick match is one tap
const LAST = "benchmon:last-match";
function loadLast(): { deckId: string; stake: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST) ?? "null");
    return v && STAKES.includes(String(v.stake)) ? { ...v, stake: String(v.stake) } : null;
  } catch {
    return null;
  }
}

function DeckFan({ cards }: { cards: number[] }) {
  return (
    <div className="relative h-[150px] w-[300px]">
      {cards.map((id, i) => (
        <div key={id} className="absolute top-2 left-1/2 origin-bottom" style={{ translate: `calc(-50% + ${(i - 2) * 46}px) ${Math.abs(i - 2) * 6}px`, rotate: `${(i - 2) * 7}deg`, zIndex: i }}>
          <GameCard info={infoOf(byId(id))} size="mini" style={{ fontSize: 6 }} />
        </div>
      ))}
    </div>
  );
}

function SeatRow({ s, me, action }: { s: OpenSeat; me?: string; action: React.ReactNode }) {
  const profileOf = useProfiles([s.m.a, s.m.b]);
  const mineOpen = s.m.state === 0 && isMine(s.m, me);
  // the other player: the host of an open seat, or whoever sits across from me
  const other = s.m.state === 0 || s.m.b === ZERO ? s.m.a : s.m.a.toLowerCase() === me?.toLowerCase() ? s.m.b : s.m.a;
  const face = faceOf(other, profileOf(other));
  return (
    <Panel className="flex items-center gap-4 p-4">
      <Avatar p={face} size="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{mineOpen ? "your open seat" : face.handle}</div>
        <div className="text-xs text-mute">{s.m.state === 0 ? `deck ${deckPower(s.m.deckA)} power` : `round ${Math.min(s.m.round, 2) + 1} · ${s.m.winsA} : ${s.m.winsB}`}</div>
        <div className="mt-1 text-xs text-dim">match #{s.id.toString()}</div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-neon">{formatEther(s.m.stake)} MON</div>
        {action}
      </div>
    </Panel>
  );
}

function Lobby({ preset, autostart, onPractice }: { preset?: Deck; autostart: boolean; onPractice: (deck: Deck) => void }) {
  const nav = useNavigate();
  const { address, write, ready, err: walletErr } = useWallet();
  const balance = useBalance(address);
  useCards();
  const decks = useMemo(loadDecks, []);
  const last = loadLast();
  const [deckId, setDeckId] = useState(preset?.id ?? (decks.some((d) => d.id === last?.deckId) ? last!.deckId : decks[0]!.id));
  const [stake, setStake] = useState(last?.stake ?? "0.01");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const deck = decks.find((d) => d.id === deckId) ?? preset ?? decks[0]!;
  const p = power(deck.cards);
  const valid = deck.cards.length === 5 && p <= deckCap();
  const broke = ready && balance < Number(stake);

  const { data: seats = [] } = usePoll(() => openSeats(), 5000, []);
  const { data: active = [] } = usePoll(async () => (address ? myActive(address as Address) : []), 5000, [address]);
  const others = seats.filter((s) => !isMine(s.m, address));

  const w = write as unknown as AnyWrite;
  const play = async (f: () => Promise<bigint>, label: string) => {
    localStorage.setItem(LAST, JSON.stringify({ deckId, stake }));
    setBusy(label);
    setErr("");
    try {
      nav(`/play/${await f()}`);
    } catch (e) {
      setErr((e as Error).message.split("\n")[0]!.slice(0, 160));
    }
    setBusy("");
  };
  const find = () => address && play(() => quickMatch(w, address as Address, deck.cards, parseEther(stake)), "Finding a match…");
  const join = (s: OpenSeat) => play(() => joinMatch(w, s.id, deck.cards, s.m.stake), "Joining…");

  // Play now on Home lands here and starts right away, once the wallet is up
  const started = useRef(false);
  useEffect(() => {
    if (!autostart || started.current || !ready || !valid || broke) return;
    started.current = true;
    find();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart, ready, valid, broke]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-panel">
          <img src="/art/arenas/speed@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/40" />
          <div className="relative grid items-center gap-6 p-7 md:grid-cols-[1fr_auto] md:p-9">
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-[34px] leading-tight font-extrabold">Quick match</h2>
                <p className="mt-1 text-mute">Joins an open seat at your stake, or opens one and waits. Winner takes the pot.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-panel-2 px-4 py-2 font-semibold">
                  {deck.name} · {p} power
                </span>
                <span className="rounded-full bg-panel-2 px-4 py-2 font-semibold">{stake} MON stake</span>
                <button onClick={() => setEditing((e) => !e)} className="rounded-full px-3 py-2 font-semibold text-neon hover:bg-neon/10">
                  {editing ? "done" : "change"}
                </button>
              </div>
              {editing && (
                <div className="flex flex-col gap-4 rounded-3xl bg-panel-2/80 p-4">
                  <div className="flex flex-wrap gap-2">
                    {decks.map((d) => (
                      <button key={d.id} onClick={() => setDeckId(d.id)} className={`h-11 rounded-full px-4 text-sm font-semibold ${d.id === deckId ? "bg-neon text-bg" : "bg-panel text-mute hover:text-ink"}`}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STAKES.map((s) => (
                      <button key={s} onClick={() => setStake(s)} className={`h-11 rounded-full px-4 text-sm font-semibold ${s === stake ? "bg-neon text-bg" : "bg-panel text-mute hover:text-ink"}`}>
                        {s} MON
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Btn size="lg" disabled={!valid || !ready || broke || Boolean(busy)} onClick={find}>
                  <Ico name="gamepad" className="h-5 w-5" />
                  {busy || (ready ? "Find a match" : "Setting up your wallet…")}
                </Btn>
                <Btn size="lg" kind="ghost" disabled={!valid} onClick={() => onPractice(deck)}>
                  Practice vs bot
                </Btn>
              </div>
              <span className="text-sm text-mute">
                pot {(Number(stake) * 2).toFixed(2)} MON · gas is on us · balance {balance.toFixed(3)} MON
              </span>
              {!valid && <p className="text-sm text-down">this deck is not ready, finish it on the Decks page.</p>}
              {broke && <p className="text-sm text-down">you need at least {stake} MON to stake. practice is free.</p>}
              {(err || walletErr) && <p className="text-sm break-all text-down">{err || walletErr}</p>}
            </div>
            <div className="hidden md:block">
              <DeckFan cards={deck.cards} />
            </div>
          </div>
        </section>

        {active.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-bold">Your matches</h3>
            {active.map((s) => (
              <SeatRow
                key={s.id.toString()}
                s={s}
                me={address}
                action={
                  <Btn size="sm" className="mt-1 h-9" onClick={() => nav(`/play/${s.id}`)}>
                    {s.m.state === 0 ? "Open" : "Resume"}
                  </Btn>
                }
              />
            ))}
          </div>
        )}

        <Panel className="p-6">
          <h3 className="text-xl font-bold">How a match plays</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["1", "Round 1's arena is shown first", "you see which stat counts before anyone picks."],
              ["2", "Tap a card, lock it in", "both flip on their own, higher stat wins, counter types get 10%."],
              ["3", "Lose a round, pick the arena", "the loser chooses the next arena from three. a comeback lever."],
              ["4", "Round 3 is a live duel", "the two models answer the same prompt, a judge decides."],
            ].map(([n, t, d]) => (
              <div key={n} className="flex gap-3 rounded-2xl bg-panel-2 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon/15 font-bold text-neon">{n}</span>
                <div>
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-mute">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Open matches</h3>
          <Chip tone={others.length ? "up" : "flat"}>{others.length} waiting</Chip>
        </div>
        {others.length === 0 && <Panel className="p-5 text-sm text-mute">No open seats right now. Quick match opens one for you and someone can join it.</Panel>}
        {others.map((s) => (
          <SeatRow
            key={s.id.toString()}
            s={s}
            me={address}
            action={
              <Btn size="sm" className="mt-1 h-9" disabled={!valid || !ready || Boolean(busy) || balance < Number(formatEther(s.m.stake))} onClick={() => join(s)}>
                Join
              </Btn>
            }
          />
        ))}
      </aside>
    </div>
  );
}

export function Play() {
  const { id } = useParams();
  const { state, pathname } = useLocation();
  const nav = useNavigate();
  const [practice, setPractice] = useState<Deck | null>(null);
  // a deck from the Decks page preselects it, Play now on Home starts a quick match
  const [intent] = useState(() => (state ?? {}) as { deck?: Deck; quick?: boolean });
  useEffect(() => {
    if (state) nav(pathname, { replace: true, state: null });
  }, [state, pathname, nav]);

  if (id !== undefined && /^\d+$/.test(id)) return <Live key={id} id={BigInt(id)} />;
  if (practice) return <Practice deck={practice} onExit={() => setPractice(null)} />;
  return <Lobby preset={intent.deck} autostart={Boolean(intent.quick)} onPractice={setPractice} />;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DECK_CAP, OPEN_MATCHES, PLAYERS, ROSTER, avatarOf, byId, mockDuel, type Deck, type Player, type Transcript } from "../mock";
import { addClaimable, useMe } from "../profile";
import { ARENAS, roundWinner } from "../rules";
import { GameCard } from "../ui/Card";
import { Btn, Chip, Ico, Panel } from "../ui/kit";
import { infoOf, type Arena } from "../ui/meta";
import { loadDecks } from "./Decks";

const STAKES = [0.01, 0.05, 0.1, 0.25];
const TITLES: Record<Arena, string> = { code: "server room", math: "chalk hall", reasoning: "library", speed: "night track", cost: "market", honesty: "court" };
const PICK_SECONDS = 30;
const fakeHash = () => "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
const power = (cards: number[]) => cards.reduce((a, id) => a + infoOf(byId(id)).power, 0);

// last deck and stake, so quick match is one tap
const LAST = "benchmon:last-match";
function loadLast(): { deckId: string; stake: number } | null {
  try {
    return JSON.parse(localStorage.getItem(LAST) ?? "null");
  } catch {
    return null;
  }
}

// a legal random deck for the bot: five cards under the cap
function botDeck(): number[] {
  for (let tries = 0; tries < 200; tries++) {
    const pick = [...ROSTER].sort(() => Math.random() - 0.5).slice(0, 5);
    if (pick.reduce((a, c) => a + infoOf(c).power, 0) <= DECK_CAP) return pick.map((c) => c.id);
  }
  return [3, 4, 9, 13, 14];
}

// the bot plays its best stat for the arena most of the time, sometimes a random card
function botCard(deck: number[], used: number[], arena: number) {
  const left = deck.filter((id) => !used.includes(id));
  if (Math.random() < 0.3) return left[Math.floor(Math.random() * left.length)]!;
  return left.sort((a, b) => byId(b).stats[arena]! - byId(a).stats[arena]!)[0]!;
}

const best = (cards: number[], arena: number) => cards.reduce((b, id) => (byId(id).stats[arena]! > byId(b).stats[arena]! ? id : b), cards[0]!);

// three different arenas, like the contract's offer
function offer(): number[] {
  return [...Array(6).keys()].sort(() => Math.random() - 0.5).slice(0, 3);
}

function Avatar({ p, size = "h-12 w-12" }: { p: Pick<Player, "cls" | "body" | "rank">; size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-panel-2 ${size}`}>
      <img src={avatarOf(p)} alt="" className="pixel h-full w-full object-cover" />
    </span>
  );
}

// ---------- lobby ----------

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

function Lobby({ onStart }: { onStart: (deck: Deck, stake: number, opp?: Player) => void }) {
  const decks = useMemo(loadDecks, []);
  const last = loadLast();
  const [deckId, setDeckId] = useState(decks.some((d) => d.id === last?.deckId) ? last!.deckId : decks[0]!.id);
  const [stake, setStake] = useState(last?.stake ?? 0.05);
  const [editing, setEditing] = useState(false);
  const deck = decks.find((d) => d.id === deckId)!;
  const p = power(deck.cards);
  const valid = deck.cards.length === 5 && p <= DECK_CAP;
  const go = (opp?: Player) => {
    localStorage.setItem(LAST, JSON.stringify({ deckId, stake }));
    onStart(deck, stake, opp);
  };

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
                <p className="mt-1 text-mute">We match you with a player on a similar deck. Winner takes the pot.</p>
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
              <div className="flex flex-wrap items-center gap-4">
                <Btn size="lg" disabled={!valid} onClick={() => go()}>
                  <Ico name="gamepad" className="h-5 w-5" />
                  Find a match
                </Btn>
                <span className="text-sm text-mute">
                  pot {(stake * 2).toFixed(2)} MON · you get {(stake * 2 * 0.98).toFixed(3)} if you win
                </span>
              </div>
              {!valid && <p className="text-sm text-down">this deck is not ready, finish it on the Decks page.</p>}
            </div>
            <div className="hidden md:block">
              <DeckFan cards={deck.cards} />
            </div>
          </div>
        </section>

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
          <Chip tone="up">{OPEN_MATCHES.length} waiting</Chip>
        </div>
        {OPEN_MATCHES.map((m) => (
          <Panel key={m.id} className="flex items-center gap-4 p-4">
            <Avatar p={m.host} size="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{m.host.handle}</div>
              <div className="text-xs text-mute capitalize">
                {m.host.cls} · {m.host.rank} · deck {m.power}
              </div>
              <div className="mt-1 text-xs text-dim">
                match #{m.id} · {m.ago}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-neon">{m.stake} MON</div>
              <Btn size="sm" className="mt-1 h-9" disabled={!valid} onClick={() => go(m.host)}>
                Join
              </Btn>
            </div>
          </Panel>
        ))}
      </aside>
    </div>
  );
}

// ---------- matchmaking ----------

function Matching({ opp, onDone }: { opp: Player; onDone: () => void }) {
  const { me } = useMe();
  const [found, setFound] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setFound(true), 1500);
    const b = setTimeout(onDone, 2900);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [onDone]);
  return (
    <section className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-[var(--radius-panel)] bg-panel">
      <img src="/art/arenas/code@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="relative flex flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <img src={avatarOf(me, false)} alt="" className="pixel h-36 w-36 object-contain" />
            <span className="font-bold">{me.handle}</span>
          </div>
          <span className="font-display text-6xl text-neon">VS</span>
          <div className="flex flex-col items-center gap-2">
            {found ? (
              <img src={avatarOf(opp, false)} alt="" className="pixel h-36 w-36 animate-[hero-in_.4s_ease_both] object-contain" />
            ) : (
              <span className="grid h-36 w-36 place-items-center">
                <span className="h-24 w-24 animate-ping rounded-full border-4 border-neon/60" />
              </span>
            )}
            <span className="font-bold">{found ? opp.handle : "searching"}</span>
          </div>
        </div>
        <div className="text-mute">{found ? `matched · ${opp.cls} · ${opp.rank}` : "finding a player on a similar deck…"}</div>
      </div>
    </section>
  );
}

// ---------- match ----------

type Phase = "intro" | "pick" | "waiting" | "reveal" | "duel" | "result" | "choose" | "theyChoose" | "over";
type By = "seed" | "you" | "them" | "draw" | "timeout";
type Round = { arena: number; pickedBy: By; mine: number; theirs: number; winner: 0 | 1 | 2; duel?: Transcript };

function ArenaTile({ arena, hint, onClick, dim, chosen }: { arena: number; hint?: string; onClick?: () => void; dim?: boolean; chosen?: boolean }) {
  const name = ARENAS[arena]!;
  return (
    <button onClick={onClick} disabled={!onClick} className={`group relative h-44 overflow-hidden rounded-3xl border-2 text-left transition ${chosen ? "border-neon" : "border-transparent"} ${dim ? "opacity-40" : ""} ${onClick ? "hover:-translate-y-1 hover:border-neon" : ""}`}>
      <img src={`/art/arenas/${name}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute inset-x-4 bottom-3">
        <div className="font-display text-3xl text-white uppercase">{name}</div>
        <div className="text-xs text-white/70">{TITLES[name]}</div>
        {hint && <div className="mt-1 text-xs font-semibold text-neon">{hint}</div>}
      </div>
    </button>
  );
}

function Match({ deck, stake, opp, onExit, onAgain }: { deck: Deck; stake: number; opp: Player; onExit: () => void; onAgain: () => void }) {
  const { me } = useMe();
  const nav = useNavigate();
  const theirDeck = useMemo(botDeck, []);
  const [round, setRound] = useState(0);
  const [arena, setArena] = useState(() => Math.floor(Math.random() * 6));
  const [pickedBy, setPickedBy] = useState<By>("seed");
  const [phase, setPhase] = useState<Phase>("intro");
  const [sel, setSel] = useState<number | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [theirs, setTheirs] = useState<number | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [choices, setChoices] = useState<number[]>([]);
  const [theirChoice, setTheirChoice] = useState<number | null>(null);
  const [left, setLeft] = useState(PICK_SECONDS);
  const [commits] = useState(() => [fakeHash(), fakeHash()]);
  const [paid, setPaid] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  const arenaName = ARENAS[arena]!;
  const usedMine = rounds.map((r) => r.mine);
  const usedTheirs = rounds.map((r) => r.theirs);
  const winsMe = rounds.filter((r) => r.winner === 1).length;
  const winsThem = rounds.filter((r) => r.winner === 2).length;
  const last = rounds[rounds.length - 1];
  const isDuel = round === 2;
  const myLeft = deck.cards.filter((id) => !usedMine.includes(id) && id !== mine);
  const final = phase === "over" ? (winsMe > winsThem ? "win" : winsThem > winsMe ? "loss" : "draw") : null;

  // every round opens with its arena, then cards
  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("pick"), 1700);
    return () => clearTimeout(t);
  }, [phase]);

  // the arena pick clock, a stalled pick gets a random arena from the offer
  useEffect(() => {
    if (phase !== "choose") return;
    setLeft(PICK_SECONDS);
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === "choose" && left <= 0) startRound(choices[Math.floor(Math.random() * choices.length)]!, "timeout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  // pay the win into the claim banner once
  useEffect(() => {
    if (final === "win" && !paid) {
      addClaimable(stake * 2 * 0.98);
      setPaid(true);
    }
  }, [final, paid, stake]);

  function startRound(next: number, by: By) {
    setRound((r) => r + 1);
    setArena(next);
    setPickedBy(by);
    setSel(null);
    setMine(null);
    setTheirs(null);
    setTheirChoice(null);
    setPhase("intro");
  }

  // what happens after a round: done, a random arena after a draw, or the loser picks
  function afterRound(r: Round, me2: number, them2: number) {
    if (me2 >= 2 || them2 >= 2 || round === 2) return later(1800, () => setPhase("over"));
    const opts = offer();
    setChoices(opts);
    if (r.winner === 0) return later(1800, () => startRound(Math.floor(Math.random() * 6), "draw"));
    if (r.winner === 2) return later(1800, () => setPhase("choose"));
    // the bot lost, it takes the arena where its best card beats ours by the most
    later(1800, () => {
      setPhase("theyChoose");
      const theirLeft = theirDeck.filter((id) => !usedTheirs.includes(id) && id !== r.theirs);
      const edge = (a: number) => byId(best(theirLeft, a)).stats[a]! - byId(best(myLeft, a)).stats[a]!;
      const pick = [...opts].sort((a, b) => edge(b) - edge(a))[0]!;
      later(1600, () => setTheirChoice(pick));
      later(2800, () => startRound(pick, "them"));
    });
  }

  const lock = () => {
    if (sel === null) return;
    setMine(sel);
    setPhase("waiting");
    const t = botCard(theirDeck, usedTheirs, arena);
    later(1100, () => {
      setTheirs(t);
      later(700, () => {
        setPhase(isDuel ? "duel" : "reveal");
        const w = roundWinner(byId(sel).stats, byId(t).stats, arena);
        const r: Round = { arena, pickedBy, mine: sel, theirs: t, winner: w, duel: isDuel ? mockDuel(arena, byId(sel), byId(t), w) : undefined };
        later(isDuel ? 2600 : 600, () => {
          setRounds((rs) => [...rs, r]);
          setPhase("result");
          afterRound(r, winsMe + (w === 1 ? 1 : 0), winsThem + (w === 2 ? 1 : 0));
        });
      });
    });
  };

  const faceUp = ["reveal", "duel", "result", "choose", "theyChoose", "over"].includes(phase);
  const settled = ["result", "choose", "theyChoose", "over"].includes(phase) && last && last.mine === mine;
  const myResult = settled ? (last!.winner === 1 ? "winner" : last!.winner === 2 ? "loser" : null) : null;
  const theirResult = settled ? (last!.winner === 2 ? "winner" : last!.winner === 1 ? "loser" : null) : null;
  const byText = { seed: "drawn at random for round 1", you: "you picked it", them: `${opp.handle} picked it`, draw: "random after a drawn round", timeout: "random, the pick timed out" }[pickedBy];
  const status =
    phase === "pick"
      ? sel === null
        ? "Tap a card to play it"
        : `Lock in ${infoOf(byId(sel)).display}?`
      : phase === "waiting"
        ? theirs === null
          ? `Locked in. ${opp.handle} is choosing`
          : "Both locked, flipping"
        : phase === "duel"
          ? "Live duel, the models are answering"
          : phase === "result" || phase === "reveal"
            ? last?.winner === 1
              ? "You take the round"
              : last?.winner === 2
                ? `${opp.handle} takes the round`
                : "Round drawn"
            : phase === "choose"
              ? "You lost the round, pick the next arena"
              : phase === "theyChoose"
                ? `${opp.handle} is picking the next arena`
                : phase === "over"
                  ? "Match over"
                  : "";

  return (
    <div className="flex flex-col gap-6">
      {/* scoreboard */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] bg-panel p-4">
        <div className="flex items-center gap-3">
          <Avatar p={me} />
          <div>
            <div className="font-semibold">{me.handle}</div>
            <div className="flex gap-1.5 pt-1">{[0, 1].map((i) => <span key={i} className={`h-2 w-7 rounded-full ${i < winsMe ? "bg-neon" : "bg-panel-2"}`} />)}</div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-mute">
            Round {round + 1} of 3 · <span className="font-semibold text-neon uppercase">{arenaName}</span>
            {isDuel && <span className="ml-2 rounded-md bg-[#8b5cf6]/20 px-2 py-0.5 text-xs text-[#b69cff]">live duel</span>}
          </div>
          <div className="mt-1 text-3xl font-extrabold">
            <span className="text-neon">{winsMe}</span>
            <span className="mx-3 text-dim">:</span>
            <span className="text-down">{winsThem}</span>
          </div>
          <div className="text-xs text-dim">pot {(stake * 2).toFixed(2)} MON</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-semibold">{opp.handle}</div>
            <div className="flex justify-end gap-1.5 pt-1">{[0, 1].map((i) => <span key={i} className={`h-2 w-7 rounded-full ${i < winsThem ? "bg-down" : "bg-panel-2"}`} />)}</div>
          </div>
          <Avatar p={opp} />
        </div>
      </div>

      {/* table */}
      <section className="relative overflow-hidden rounded-[var(--radius-panel)]">
        <img key={arenaName} src={`/art/arenas/${arenaName}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full animate-[fadein_.5s_ease] object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,19,.45),rgba(16,17,19,.1)_40%,rgba(16,17,19,.65))]" />
        {phase !== "intro" && (
          <div className="relative flex justify-center pt-5">
            <Chip tone={phase === "duel" ? "violet" : phase === "choose" ? "down" : last?.winner === 1 && settled ? "up" : last?.winner === 2 && settled ? "down" : "gold"}>{status}</Chip>
          </div>
        )}
        <div className="relative grid min-h-[380px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-8">
          <div className="flex justify-center">
            {mine === null ? (
              <div className="grid aspect-[5/7.4] w-[198px] place-items-center rounded-2xl border-2 border-dashed border-white/25 bg-black/30 text-sm text-white/70">{sel === null ? "your card goes here" : "ready to lock"}</div>
            ) : (
              <GameCard key={`m${round}`} info={infoOf(byId(mine))} size="tile" arena={arenaName} facing={theirs !== null && faceUp ? infoOf(byId(theirs)).type : null} facedown={!faceUp} back={{ side: "mine", commit: commits[0], label: "you" }} state={myResult} className={!faceUp ? "is-locking" : ""} />
            )}
          </div>
          <span className="font-display text-6xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,.6)]">VS</span>
          <div className="flex justify-center">
            {theirs === null ? (
              <div className="grid aspect-[5/7.4] w-[198px] place-items-center rounded-2xl border-2 border-dashed border-white/25 bg-black/30 text-center text-sm text-white/70">
                <span>
                  <Ico name="clock-2" className="mx-auto mb-2 h-6 w-6" />
                  {opp.handle} is choosing
                </span>
              </div>
            ) : (
              <GameCard key={`t${round}`} info={infoOf(byId(theirs))} size="tile" arena={arenaName} facing={mine !== null && faceUp ? infoOf(byId(mine)).type : null} facedown={!faceUp} back={{ side: "theirs", commit: commits[1], label: opp.handle }} state={theirResult} />
            )}
          </div>
        </div>

        {/* the arena announcement that opens every round */}
        {phase === "intro" && (
          <div className="absolute inset-0 z-10 grid animate-[fadein_.3s_ease] place-items-center bg-black/55 backdrop-blur-[2px]">
            <div className="flex animate-[hero-in_.5s_cubic-bezier(.2,.7,.2,1)_both] flex-col items-center text-center">
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white/80">
                Round {round + 1} of 3{isDuel ? " · live duel" : ""}
              </span>
              <span className="mt-3 font-display text-[88px] leading-none text-neon uppercase drop-shadow-[0_6px_0_rgba(0,0,0,.6)]">{arenaName}</span>
              <span className="mt-2 text-lg text-white/80">{TITLES[arenaName]} · the {arenaName} stat decides this round</span>
              <span className="mt-1 text-sm text-white/55">{byText}</span>
            </div>
          </div>
        )}
      </section>

      {/* the loser picks the next arena */}
      {(phase === "choose" || phase === "theyChoose") && (
        <Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">{phase === "choose" ? "Pick the next arena" : `${opp.handle} is picking the next arena`}</h3>
              <p className="text-sm text-mute">{phase === "choose" ? "you lost the round, so you choose where the next one is fought." : "they lost the round, so they choose. you will see it before you play."}</p>
            </div>
            {phase === "choose" && (
              <div className="w-40">
                <div className="flex justify-between text-xs text-mute">
                  <span>time</span>
                  <span className={left <= 10 ? "text-down" : ""}>{left}s</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-neon transition-[width] duration-1000 ease-linear" style={{ width: `${(left / PICK_SECONDS) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {choices.map((a) => {
              const b = myLeft.length ? best(myLeft, a) : null;
              return (
                <ArenaTile
                  key={a}
                  arena={a}
                  hint={b !== null ? `your best: ${infoOf(byId(b)).display} ${byId(b).stats[a]}` : undefined}
                  onClick={phase === "choose" ? () => startRound(a, "you") : undefined}
                  dim={phase === "theyChoose" && theirChoice !== null && theirChoice !== a}
                  chosen={theirChoice === a}
                />
              );
            })}
          </div>
        </Panel>
      )}

      {/* live duel */}
      {isDuel && (phase === "duel" || (phase === "over" && last?.duel)) && (
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm text-mute">
            <Ico name="energy" className="h-4 w-4 text-neon" />
            Live duel · judged by kimi
          </div>
          {phase === "duel" ? (
            <div className="flex items-center gap-3 rounded-2xl bg-panel-2 p-4 text-mute">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neon" />
              both models got the same {arenaName} prompt and are answering…
            </div>
          ) : (
            last?.duel && (
              <div className="rounded-2xl bg-panel-2 p-4">
                <p className="text-[15px]">{last.duel.prompt}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["a", "b"] as const).map((k) => {
                    const r = last.duel![k];
                    const won = last.duel!.outcome === (k === "a" ? 1 : 2);
                    return (
                      <div key={k} className={`rounded-xl border p-3 ${won ? "border-neon/60 bg-neon/5" : "border-line"}`}>
                        <div className="flex items-center justify-between text-xs text-mute">
                          <span>
                            {k === "a" ? "you" : opp.handle} · {r.model}
                          </span>
                          <Chip tone={r.correct ? "up" : "down"}>{r.correct ? "correct" : "wrong"}</Chip>
                        </div>
                        <p className="mt-2 font-mono text-sm">{r.text}</p>
                        <div className="mt-2 text-xs text-dim">
                          {(r.ms / 1000).toFixed(1)}s · ${r.costUsd.toFixed(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-mute">
                  verdict: <span className="text-ink">{last.duel.reason}</span>
                </p>
              </div>
            )
          )}
        </Panel>
      )}

      {/* result */}
      {final && (
        <Panel className={`flex flex-wrap items-center justify-between gap-4 p-6 ${final === "win" ? "bg-[linear-gradient(110deg,#2a3a0e,#1e1f23_60%)]" : ""}`}>
          <div>
            <div className="font-display text-5xl tracking-wide uppercase">{final === "win" ? "You win" : final === "loss" ? "You lose" : "Draw"}</div>
            <div className="mt-1 text-mute">
              {final === "win" ? `+${(stake * 2 * 0.98).toFixed(3)} MON added to your winnings, claim it on Home` : final === "draw" ? `your ${stake} MON stake comes back` : `${opp.handle} takes the pot. the loser picks, so it is always close`}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Btn onClick={onAgain}>Play again</Btn>
            {final === "win" && (
              <Btn kind="outline" onClick={() => nav("/home")}>
                Claim on Home
              </Btn>
            )}
            <Btn kind="ghost" onClick={onExit}>
              Lobby
            </Btn>
          </div>
        </Panel>
      )}

      {/* hand */}
      {phase !== "over" && (
        <Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold">
              Your hand <span className="text-sm font-medium text-mute">· {arenaName} counts this round</span>
            </h3>
            {phase === "pick" && (
              <Btn size="lg" disabled={sel === null} onClick={lock}>
                <Ico name="lock" className="h-5 w-5" />
                {sel === null ? "Pick a card" : `Lock in ${infoOf(byId(sel)).display}`}
              </Btn>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
            {deck.cards.map((id) => {
              const used = usedMine.includes(id) || id === mine;
              const top = !used && id === best(myLeft.length ? myLeft : deck.cards, arena);
              return (
                <div key={id} className="relative">
                  {top && phase === "pick" && <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-neon px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-bg">best {arenaName}</span>}
                  <GameCard info={infoOf(byId(id))} size="tile" arena={arenaName} state={used ? "used" : sel === id ? "selected" : null} onClick={phase === "pick" && !used ? () => setSel(sel === id ? null : id) : undefined} />
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {rounds.length > 0 && (
        <Panel className="p-5">
          <h3 className="mb-3 text-xl font-bold">Rounds</h3>
          <div className="flex flex-col gap-2">
            {rounds.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel-2 px-4 py-3">
                <span className="text-mute">
                  R{i + 1} · <span className="text-ink uppercase">{ARENAS[r.arena]}</span>
                  <span className="ml-2 text-xs">{{ seed: "drawn", you: "your pick", them: "their pick", draw: "random", timeout: "timed out" }[r.pickedBy]}</span>
                </span>
                <span>
                  {infoOf(byId(r.mine)).display} <b className="text-neon">{byId(r.mine).stats[r.arena]}</b>
                  <span className="mx-2 text-dim">vs</span>
                  <b className="text-down">{byId(r.theirs).stats[r.arena]}</b> {infoOf(byId(r.theirs)).display}
                </span>
                <Chip tone={r.winner === 1 ? "up" : r.winner === 2 ? "down" : "flat"}>{r.winner === 1 ? "you" : r.winner === 2 ? opp.handle : "draw"}</Chip>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------- page ----------

type Game = { deck: Deck; stake: number; opp: Player; key: number; matched: boolean };

export function Play() {
  // a deck sent from the Decks page or Quick match on Home starts matchmaking right away
  const { state: raw, pathname } = useLocation();
  const state = raw as { deck?: Deck; quick?: boolean } | null;
  const nav = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const start = (deck: Deck, stake: number, opp?: Player) => setGame({ deck, stake, opp: opp ?? PLAYERS[Math.floor(Math.random() * PLAYERS.length)]!, key: Date.now(), matched: Boolean(opp) });

  useEffect(() => {
    if (state?.deck) start(state.deck, loadLast()?.stake ?? 0.05);
    else if (state?.quick) {
      const decks = loadDecks();
      const last = loadLast();
      start(decks.find((d) => d.id === last?.deckId) ?? decks[0]!, last?.stake ?? 0.05);
    }
    // drop the state so a reload lands on the lobby, not a new match
    if (state) nav(pathname, { replace: true, state: null });
  }, [state]);

  if (!game) return <Lobby onStart={start} />;
  if (!game.matched) return <Matching key={game.key} opp={game.opp} onDone={() => setGame((g) => g && { ...g, matched: true })} />;
  return <Match key={game.key} deck={game.deck} stake={game.stake} opp={game.opp} onExit={() => setGame(null)} onAgain={() => start(game.deck, game.stake)} />;
}

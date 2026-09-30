import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Card } from "../chain";
import { DECK_CAP, ME, OPEN_MATCHES, PLAYERS, ROSTER, avatarOf, byId, mockDuel, type Deck, type Player, type Transcript } from "../mock";
import { ARENAS, roundWinner } from "../rules";
import { GameCard } from "../ui/Card";
import { Btn, Chip, Ico, Panel } from "../ui/kit";
import { infoOf, type Arena } from "../ui/meta";
import { loadDecks } from "./Decks";

const STAKES = [0.01, 0.05, 0.1, 0.25];
const TITLES: Record<Arena, string> = { code: "server room", math: "chalk hall", reasoning: "library", speed: "night track", cost: "market", honesty: "court" };
const fakeHash = () => "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

// a legal random deck for the bot: five cards under the cap
function botDeck(): number[] {
  for (let tries = 0; tries < 200; tries++) {
    const pick = [...ROSTER].sort(() => Math.random() - 0.5).slice(0, 5);
    if (pick.reduce((a, c) => a + infoOf(c).power, 0) <= DECK_CAP) return pick.map((c) => c.id);
  }
  return [3, 4, 9, 13, 14];
}

// the bot plays its best stat for the arena most of the time, sometimes a random card
function botPick(deck: number[], used: number[], arena: number) {
  const left = deck.filter((id) => !used.includes(id));
  if (Math.random() < 0.3) return left[Math.floor(Math.random() * left.length)]!;
  return left.sort((a, b) => byId(b).stats[arena]! - byId(a).stats[arena]!)[0]!;
}

function Avatar({ p, size = "h-12 w-12" }: { p: Player; size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-panel-2 ${size}`}>
      <img src={avatarOf(p)} alt="" className="pixel h-full w-full object-cover" />
    </span>
  );
}

// ---------- lobby ----------

function Lobby({ onStart }: { onStart: (deck: Deck, stake: number, opp: Player) => void }) {
  const decks = useMemo(loadDecks, []);
  const [deckId, setDeckId] = useState(decks[0]!.id);
  const [stake, setStake] = useState(0.05);
  const deck = decks.find((d) => d.id === deckId)!;
  const power = deck.cards.reduce((a, id) => a + infoOf(byId(id)).power, 0);
  const valid = deck.cards.length === 5 && power <= DECK_CAP;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-panel">
          <img src="/art/arenas/speed@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/85 to-transparent" />
          <div className="relative flex flex-col gap-6 p-8">
            <div>
              <h2 className="text-[34px] leading-tight font-extrabold">Start a match</h2>
              <p className="mt-1 text-mute">pick a deck and a stake. both players stake the same, winner takes the pot.</p>
            </div>
            <div>
              <div className="mb-3 text-sm text-mute">Deck</div>
              <div className="flex flex-wrap gap-2">
                {decks.map((d) => {
                  const p = d.cards.reduce((a, id) => a + infoOf(byId(id)).power, 0);
                  return (
                    <button key={d.id} onClick={() => setDeckId(d.id)} className={`flex h-14 items-center gap-3 rounded-2xl border px-4 transition ${d.id === deckId ? "border-neon bg-neon/10" : "border-line bg-panel hover:bg-panel-2"}`}>
                      <span className="flex -space-x-3">
                        {d.cards.slice(0, 3).map((id) => (
                          <span key={id} className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-panel bg-panel-2">
                            <img src={`/art/cards/${byId(id).name}-t1-plain@1x.png`} alt="" className="pixel h-full w-full scale-150 object-contain" />
                          </span>
                        ))}
                      </span>
                      <span className="text-left">
                        <span className="block text-sm font-semibold">{d.name}</span>
                        <span className={`block text-xs ${p > DECK_CAP ? "text-down" : "text-mute"}`}>
                          {d.cards.length}/5 · {p} power
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm text-mute">Stake</div>
              <div className="flex flex-wrap gap-2">
                {STAKES.map((s) => (
                  <button key={s} onClick={() => setStake(s)} className={`h-12 rounded-2xl px-5 font-semibold transition ${s === stake ? "bg-neon text-bg" : "bg-panel-2 text-ink hover:bg-raised"}`}>
                    {s} MON
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Btn size="lg" disabled={!valid} onClick={() => onStart(deck, stake, PLAYERS[Math.floor(Math.random() * PLAYERS.length)]!)}>
                <Ico name="gamepad" className="h-5 w-5" />
                Find an opponent
              </Btn>
              <span className="text-sm text-mute">pot {(stake * 2).toFixed(2)} MON · winner gets {(stake * 2 * 0.98).toFixed(3)} after the 2% fee</span>
            </div>
            {!valid && <p className="text-sm text-down">this deck is not ready, finish it on the Decks page.</p>}
          </div>
        </section>

        <Panel className="p-6">
          <h3 className="text-xl font-bold">Your hand for this match</h3>
          <div className="mt-5 flex flex-wrap justify-center gap-4 xl:justify-start">
            {deck.cards.map((id) => (
              <GameCard key={id} info={infoOf(byId(id))} size="tile" />
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
              <div className="mt-1 text-xs text-dim">match #{m.id} · {m.ago}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-neon">{m.stake} MON</div>
              <Btn size="sm" className="mt-1 h-9" disabled={!valid} onClick={() => onStart(deck, m.stake, m.host)}>
                Join
              </Btn>
            </div>
          </Panel>
        ))}
        <Panel className="p-5">
          <div className="text-sm text-mute">How a match works</div>
          <ol className="mt-3 flex flex-col gap-3 text-[15px]">
            {["Each round picks an arena stat.", "You both lock a card face down, then flip.", "Higher stat wins, type edge adds 10%.", "Round 3 is a live duel, the models answer for real."].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neon/15 text-sm font-bold text-neon">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </Panel>
      </aside>
    </div>
  );
}

// ---------- match ----------

type Phase = "pick" | "waiting" | "reveal" | "duel" | "result" | "over";
type Round = { arena: number; mine: number; theirs: number; winner: 0 | 1 | 2; duel?: Transcript };

function Match({ deck, stake, opp, onExit }: { deck: Deck; stake: number; opp: Player; onExit: () => void }) {
  const theirDeck = useMemo(botDeck, []);
  const arenas = useMemo(() => [0, 1, 2].map(() => Math.floor(Math.random() * 6)), []);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("pick");
  const [sel, setSel] = useState<number | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [theirs, setTheirs] = useState<number | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [commits] = useState(() => [fakeHash(), fakeHash()]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  const arena = arenas[round]!;
  const arenaName = ARENAS[arena]!;
  const usedMine = rounds.map((r) => r.mine);
  const usedTheirs = rounds.map((r) => r.theirs);
  const winsMe = rounds.filter((r) => r.winner === 1).length;
  const winsThem = rounds.filter((r) => r.winner === 2).length;
  const last = rounds[rounds.length - 1];
  const isDuel = round === 2;

  const lock = () => {
    if (sel === null) return;
    setMine(sel);
    setPhase("waiting");
    const t = botPick(theirDeck, usedTheirs, arena);
    later(1300, () => {
      setTheirs(t);
      later(900, () => {
        setPhase(isDuel ? "duel" : "reveal");
        const w = roundWinner(byId(sel).stats, byId(t).stats, arena);
        const r: Round = { arena, mine: sel, theirs: t, winner: w, duel: isDuel ? mockDuel(arena, byId(sel), byId(t), w) : undefined };
        later(isDuel ? 2600 : 700, () => {
          setRounds((rs) => [...rs, r]);
          const me = winsMe + (w === 1 ? 1 : 0), them = winsThem + (w === 2 ? 1 : 0);
          setPhase(me >= 2 || them >= 2 || round === 2 ? "over" : "result");
        });
      });
    });
  };
  const next = () => {
    setRound((r) => r + 1);
    setSel(null);
    setMine(null);
    setTheirs(null);
    setPhase("pick");
  };

  const showFaces = phase === "result" || phase === "over" || phase === "reveal" || phase === "duel";
  const myResult = last && (phase === "result" || phase === "over") && last.mine === mine ? (last.winner === 1 ? "winner" : last.winner === 2 ? "loser" : null) : null;
  const theirResult = last && (phase === "result" || phase === "over") && last.theirs === theirs ? (last.winner === 2 ? "winner" : last.winner === 1 ? "loser" : null) : null;
  const final = phase === "over" ? (winsMe > winsThem ? "win" : winsThem > winsMe ? "loss" : "draw") : null;
  const status =
    phase === "pick" ? "Pick a card and lock it in" : phase === "waiting" ? (theirs === null ? `Locked. waiting for ${opp.handle}` : "Both locked, revealing") : phase === "duel" ? "Live duel, the models are answering" : phase === "reveal" ? "Revealed" : phase === "result" ? (last?.winner === 1 ? "You take the round" : last?.winner === 2 ? `${opp.handle} takes the round` : "Round drawn") : "Match over";

  return (
    <div className="flex flex-col gap-6">
      {/* scoreboard */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] bg-panel p-4">
        <div className="flex items-center gap-3">
          <img src={avatarOf(ME)} alt="" className="pixel h-12 w-12 rounded-2xl bg-panel-2 object-cover" />
          <div>
            <div className="font-semibold">You</div>
            <div className="flex gap-1.5 pt-1">{[0, 1].map((i) => <span key={i} className={`h-2 w-7 rounded-full ${i < winsMe ? "bg-neon" : "bg-panel-2"}`} />)}</div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-mute">
            Round {round + 1} of 3 · <span className="font-semibold text-neon uppercase">{arenaName}</span> · {TITLES[arenaName]}
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
        <img src={`/art/arenas/${arenaName}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,19,.45),rgba(16,17,19,.1)_40%,rgba(16,17,19,.65))]" />
        <div className="relative flex justify-center pt-5">
          <Chip tone={phase === "duel" ? "violet" : phase === "result" && last?.winner === 1 ? "up" : phase === "result" && last?.winner === 2 ? "down" : "gold"}>{status}</Chip>
        </div>
        <div className="relative grid min-h-[420px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-8">
          <div className="flex justify-center">
            {mine === null ? (
              <div className="grid aspect-[5/7.4] w-[198px] place-items-center rounded-2xl border-2 border-dashed border-white/25 bg-black/30 text-sm text-white/70">your card goes here</div>
            ) : (
              <GameCard key={`m${round}`} info={infoOf(byId(mine))} size="tile" arena={arenaName} facing={theirs !== null && showFaces ? infoOf(byId(theirs)).type : null} facedown={!showFaces} back={{ side: "mine", commit: commits[0], label: "you" }} state={myResult} className={!showFaces ? "is-locking" : ""} />
            )}
          </div>
          <span className="font-display text-6xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,.6)]">VS</span>
          <div className="flex justify-center">
            {theirs === null ? (
              <div className="grid aspect-[5/7.4] w-[198px] place-items-center rounded-2xl border-2 border-dashed border-white/25 bg-black/30 text-center text-sm text-white/70">
                <span>
                  <Ico name="clock-2" className="mx-auto mb-2 h-6 w-6" />
                  {opp.handle} is picking
                </span>
              </div>
            ) : (
              <GameCard key={`t${round}`} info={infoOf(byId(theirs))} size="tile" arena={arenaName} facing={mine !== null && showFaces ? infoOf(byId(mine)).type : null} facedown={!showFaces} back={{ side: "theirs", commit: commits[1], label: opp.handle }} state={theirResult} />
            )}
          </div>
        </div>
      </section>

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
              both models got the same prompt and are answering…
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
                          <span>{k === "a" ? "you" : opp.handle} · {r.model}</span>
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
              {final === "win" ? `+${(stake * 2 * 0.98).toFixed(3)} MON is ready to withdraw` : final === "draw" ? `your ${stake} MON stake comes back` : `${opp.handle} takes the pot`}
            </div>
          </div>
          <div className="flex gap-3">
            {final !== "loss" && <Btn>Withdraw</Btn>}
            <Btn kind="ghost" onClick={onExit}>
              Back to lobby
            </Btn>
          </div>
        </Panel>
      )}

      {/* hand */}
      <Panel className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold">Your hand</h3>
          <div className="flex gap-3">
            {phase === "pick" && (
              <Btn disabled={sel === null} onClick={lock}>
                <Ico name="lock" className="h-4 w-4" />
                Lock in {sel !== null ? infoOf(byId(sel)).display : "a card"}
              </Btn>
            )}
            {phase === "result" && <Btn onClick={next}>Next round</Btn>}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
          {deck.cards.map((id) => {
            const used = usedMine.includes(id) || id === mine;
            const card: Card = byId(id);
            return (
              <GameCard
                key={id}
                info={infoOf(card)}
                size="tile"
                arena={arenaName}
                state={used ? "used" : sel === id ? "selected" : null}
                onClick={phase === "pick" && !used ? () => setSel(id) : undefined}
              />
            );
          })}
        </div>
      </Panel>

      {rounds.length > 0 && (
        <Panel className="p-5">
          <h3 className="mb-3 text-xl font-bold">Rounds</h3>
          <div className="flex flex-col gap-2">
            {rounds.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel-2 px-4 py-3">
                <span className="text-mute">
                  R{i + 1} · <span className="uppercase">{ARENAS[r.arena]}</span>
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

export function Play() {
  // a deck sent from the Decks page starts a match right away
  const preset = (useLocation().state as { deck?: Deck } | null)?.deck ?? null;
  const [game, setGame] = useState<{ deck: Deck; stake: number; opp: Player; key: number } | null>(null);
  useEffect(() => {
    if (preset) setGame({ deck: preset, stake: 0.05, opp: PLAYERS[1]!, key: Date.now() });
  }, [preset]);
  if (!game) return <Lobby onStart={(deck, stake, opp) => setGame({ deck, stake, opp, key: Date.now() })} />;
  return <Match key={game.key} deck={game.deck} stake={game.stake} opp={game.opp} onExit={() => setGame(null)} />;
}

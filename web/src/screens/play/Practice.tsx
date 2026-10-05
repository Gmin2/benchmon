import { useEffect, useMemo, useRef, useState } from "react";
import { byId, deckCap, roster } from "../../hooks";
import { PLAYERS, mockDuel, type Deck, type Player } from "../../mock";
import { useMe } from "../../profile";
import { roundWinner } from "../../rules";
import { Btn } from "../../ui/kit";
import { infoOf } from "../../ui/meta";
import type { Transcript } from "../../duel";
import { ArenaIntro, DuelPanel, Hand, LockBtn, PickPanel, Result, RoundFlash, Rounds, Scoreboard, Table, avatarSrc, best, type RoundRow } from "./parts";

const PICK_SECONDS = 30;

// a legal random deck for the bot: five cards under the cap
function botDeck(): number[] {
  for (let tries = 0; tries < 200; tries++) {
    const pick = [...roster()].sort(() => Math.random() - 0.5).slice(0, 5);
    if (pick.reduce((a, c) => a + infoOf(c).power, 0) <= deckCap()) return pick.map((c) => c.id);
  }
  return [3, 4, 9, 13, 14];
}

// the bot plays its best stat for the arena most of the time, sometimes a random card
function botCard(deck: number[], used: number[], arena: number) {
  const left = deck.filter((id) => !used.includes(id));
  if (Math.random() < 0.3) return left[Math.floor(Math.random() * left.length)]!;
  return best(left, arena);
}

const tagOf = (by: string) => (by.startsWith("drawn") ? "drawn" : by.startsWith("you") ? "your pick" : by.startsWith("random after") ? "random" : by.includes("timed") ? "timed out" : "their pick");
const offer = () => [...Array(6).keys()].sort(() => Math.random() - 0.5).slice(0, 3);

function Finding({ opp, onDone }: { opp: Player; onDone: () => void }) {
  const { me } = useMe();
  const [found, setFound] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setFound(true), 1200);
    const b = setTimeout(onDone, 2400);
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
            <img src={avatarSrc(me, false)} alt="" className="pixel h-36 w-36 object-contain" />
            <span className="font-bold">{me.handle}</span>
          </div>
          <span className="font-display text-6xl text-neon">VS</span>
          <div className="flex flex-col items-center gap-2">
            {found ? (
              <img src={avatarSrc(opp, false)} alt="" className="pixel h-36 w-36 animate-[hero-in_.4s_ease_both] object-contain" />
            ) : (
              <span className="grid h-36 w-36 place-items-center">
                <span className="h-24 w-24 animate-ping rounded-full border-4 border-neon/60" />
              </span>
            )}
            <span className="font-bold">{found ? `${opp.handle} (bot)` : "setting up"}</span>
          </div>
        </div>
        <div className="text-mute">practice match · nothing staked</div>
      </div>
    </section>
  );
}

type Phase = "intro" | "pick" | "waiting" | "flash" | "duel" | "choose" | "theyChoose" | "over";
type Round = RoundRow & { duel?: Transcript };

function Match({ deck, opp, onExit, onAgain }: { deck: Deck; opp: Player; onExit: () => void; onAgain: () => void }) {
  const { me } = useMe();
  const theirDeck = useMemo(botDeck, []);
  const [round, setRound] = useState(0);
  const [arena, setArena] = useState(() => Math.floor(Math.random() * 6));
  const [by, setBy] = useState("drawn at random for round 1");
  const [phase, setPhase] = useState<Phase>("intro");
  const [sel, setSel] = useState<number | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [theirs, setTheirs] = useState<number | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [choices, setChoices] = useState<number[]>([]);
  const [theirChoice, setTheirChoice] = useState<number | null>(null);
  const [left, setLeft] = useState(PICK_SECONDS);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  const usedMine = rounds.map((r) => r.mine);
  const usedTheirs = rounds.map((r) => r.theirs);
  const winsMe = rounds.filter((r) => r.winner === 1).length;
  const winsThem = rounds.filter((r) => r.winner === 2).length;
  const last = rounds[rounds.length - 1];
  const isDuel = round === 2;
  const myLeft = deck.cards.filter((id) => !usedMine.includes(id) && id !== mine);
  const final = phase === "over" ? (winsMe > winsThem ? "win" : winsThem > winsMe ? "loss" : "draw") : null;

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("pick"), 1700);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "choose") return;
    setLeft(PICK_SECONDS);
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === "choose" && left <= 0) startRound(choices[Math.floor(Math.random() * choices.length)]!, "random, the pick timed out");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  function startRound(next: number, why: string) {
    setRound((r) => r + 1);
    setArena(next);
    setBy(why);
    setSel(null);
    setMine(null);
    setTheirs(null);
    setTheirChoice(null);
    setPhase("intro");
  }

  function afterRound(r: Round, me2: number, them2: number) {
    if (me2 >= 2 || them2 >= 2 || round === 2) return later(1800, () => setPhase("over"));
    const opts = offer();
    setChoices(opts);
    if (r.winner === 0) return later(1800, () => startRound(Math.floor(Math.random() * 6), "random after a drawn round"));
    if (r.winner === 2) return later(1800, () => setPhase("choose"));
    // the bot lost, it takes the arena where its best card beats ours by the most
    later(1800, () => {
      setPhase("theyChoose");
      const theirLeft = theirDeck.filter((id) => !usedTheirs.includes(id) && id !== r.theirs);
      const edge = (a: number) => byId(best(theirLeft, a)).stats[a]! - byId(best(myLeft, a)).stats[a]!;
      const pick = [...opts].sort((a, b) => edge(b) - edge(a))[0]!;
      later(1600, () => setTheirChoice(pick));
      later(2800, () => startRound(pick, `${opp.handle} picked it`));
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
        const w = roundWinner(byId(sel).stats, byId(t).stats, arena);
        const r: Round = { arena, by: tagOf(by), mine: sel, theirs: t, winner: w, duel: isDuel ? mockDuel(arena, byId(sel), byId(t), w) : undefined };
        if (isDuel) setPhase("duel");
        later(isDuel ? 2600 : 0, () => {
          setRounds((rs) => [...rs, r]);
          setPhase("flash");
          afterRound(r, winsMe + (w === 1 ? 1 : 0), winsThem + (w === 2 ? 1 : 0));
        });
      });
    });
  };

  const settled = ["flash", "choose", "theyChoose", "over"].includes(phase) && last?.mine === mine;
  const faceUp = settled || phase === "duel";
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
          : phase === "choose"
            ? "You lost the round, pick the next arena"
            : phase === "theyChoose"
              ? `${opp.handle} is picking the next arena`
              : phase === "over"
                ? "Match over"
                : "";

  return (
    <div className="flex flex-col gap-6">
      <Scoreboard me={me} opp={opp} winsMe={winsMe} winsThem={winsThem} round={round} arena={arena} pot={0} />
      <Table
        arena={arena}
        status={status}
        tone={phase === "duel" ? "violet" : phase === "choose" ? "down" : "gold"}
        oppName={opp.handle}
        mine={{ card: mine, facedown: !faceUp, state: settled ? (last!.winner === 1 ? "winner" : last!.winner === 2 ? "loser" : null) : null, placeholder: sel === null ? "your card goes here" : "ready to lock" }}
        theirs={{ card: theirs, facedown: theirs !== null && !faceUp, state: settled ? (last!.winner === 2 ? "winner" : last!.winner === 1 ? "loser" : null) : null, placeholder: `${opp.handle} is choosing` }}
        overlay={phase === "intro" ? <ArenaIntro round={round} arena={arena} by={by} /> : phase === "flash" && last ? <RoundFlash n={rounds.length - 1} arena={last.arena} mine={last.mine} theirs={last.theirs} winner={last.winner} oppName={opp.handle} /> : undefined}
      />
      {(phase === "choose" || phase === "theyChoose") && <PickPanel mine={phase === "choose"} choices={choices} cards={myLeft} left={left} total={PICK_SECONDS} oppName={opp.handle} chosen={theirChoice} onPick={(a) => startRound(a, "you picked it")} />}
      {isDuel && (phase === "duel" || (phase === "over" && last?.duel)) && <DuelPanel arena={arena} duel={phase === "duel" ? null : (last?.duel ?? null)} oppName={opp.handle} judging />}
      {final && (
        <Result final={final} line={final === "win" ? "a practice win. play a real match to stake and win MON" : final === "draw" ? "nothing staked, nothing lost" : "the loser picks the arena, so it is always close"}>
          <Btn onClick={onAgain}>Play again</Btn>
          <Btn kind="ghost" onClick={onExit}>
            Lobby
          </Btn>
        </Result>
      )}
      {phase !== "over" && <Hand cards={deck.cards} used={[...usedMine, ...(mine !== null ? [mine] : [])]} arena={arena} sel={sel} pickable={phase === "pick"} onSel={setSel} action={phase === "pick" && <LockBtn sel={sel} onLock={lock} />} />}
      <Rounds rounds={rounds} oppName={opp.handle} />
    </div>
  );
}

// a free match against a bot, same rules, nothing staked
export function Practice({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [game, setGame] = useState(() => ({ key: Date.now(), opp: PLAYERS[Math.floor(Math.random() * PLAYERS.length)]!, ready: false }));
  const again = () => setGame({ key: Date.now(), opp: PLAYERS[Math.floor(Math.random() * PLAYERS.length)]!, ready: false });
  if (!game.ready) return <Finding key={game.key} opp={game.opp} onDone={() => setGame((g) => ({ ...g, ready: true }))} />;
  return <Match key={game.key} deck={deck} opp={game.opp} onExit={onExit} onAgain={again} />;
}

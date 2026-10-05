import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatEther, type Address } from "viem";
import { loadPick } from "../../chain";
import { ZERO, ZERO32, cancelMatch, claimTimeout, joinMatch, loadTranscript, lockCard, offerOf, pickArena, pickerOf, revealMine, settleByStats, skipPick, useMatch, withdraw, type AnyWrite, type Transcript } from "../../duel";
import { useMe, useProfiles } from "../../profile";
import { useCards } from "../../hooks";
import { useWallet } from "../../useWallet";
import { Btn, Ico, Panel } from "../../ui/kit";
import { loadDecks } from "../Decks";
import { ArenaIntro, DuelPanel, Hand, LockBtn, PickPanel, Result, RoundFlash, Rounds, Scoreboard, Table, avatarSrc, faceOf, type RoundRow } from "./parts";

const PICK_TIMEOUT = 60;
const bitsToIds = (mask: bigint) => Array.from({ length: 64 }, (_, i) => i).filter((i) => (mask >> BigInt(i)) & 1n);
const errText = (e: unknown) => (e as Error).message.split("\n")[0]!.slice(0, 160);

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Waiting({ id, stake, mine, onCancel, onJoin, busy }: { id: bigint; stake: bigint; mine: boolean; onCancel: () => void; onJoin: () => void; busy: string }) {
  const { me } = useMe();
  return (
    <section className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-[var(--radius-panel)] bg-panel">
      <img src="/art/arenas/code@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="relative flex flex-col items-center gap-7 text-center">
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <img src={avatarSrc(me, false)} alt="" className="pixel h-36 w-36 object-contain" />
            <span className="font-bold">{mine ? me.handle : "host"}</span>
          </div>
          <span className="font-display text-6xl text-neon">VS</span>
          <span className="grid h-36 w-36 place-items-center">
            <span className="h-24 w-24 animate-ping rounded-full border-4 border-neon/60" />
          </span>
        </div>
        <div>
          <div className="text-xl font-bold">{mine ? "Waiting for an opponent" : "This seat is open"}</div>
          <div className="mt-1 text-mute">
            match #{id.toString()} · {formatEther(stake)} MON each · winner takes {formatEther(stake * 2n)} MON
          </div>
        </div>
        {mine ? (
          <Btn kind="ghost" onClick={onCancel} disabled={Boolean(busy)}>
            {busy || "Cancel and take the stake back"}
          </Btn>
        ) : (
          <Btn size="lg" onClick={onJoin} disabled={Boolean(busy)}>
            {busy || `Join for ${formatEther(stake)} MON`}
          </Btn>
        )}
      </div>
    </section>
  );
}

export function Live({ id }: { id: bigint }) {
  const nav = useNavigate();
  const { me } = useMe();
  useCards();
  const { address, write, ready } = useWallet();
  const w = write as unknown as AnyWrite;
  const { m, rounds, owed } = useMatch(id, address);
  const profileOf = useProfiles(m ? [m.a, m.b] : []);
  const now = useNow();
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [duel, setDuel] = useState<Transcript | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [intro, setIntro] = useState<string | null>(null);
  const seen = useRef<{ rounds: number | null; intros: Set<string>; tried: Set<string>; bothAt: Record<string, number> }>({ rounds: null, intros: new Set(), tried: new Set(), bothAt: {} });

  const act = async (label: string, f: () => Promise<unknown>) => {
    setBusy(label);
    setErr("");
    try {
      await f();
    } catch (e) {
      setErr(errText(e));
    }
    setBusy("");
  };

  const me_ = address?.toLowerCase();
  const isA = Boolean(m && me_ && m.a.toLowerCase() === me_);
  const isB = Boolean(m && me_ && m.b.toLowerCase() === me_);
  const playing = m?.state === 1;
  const myCommit = m ? (isA ? m.commitA : m.commitB) : ZERO32;
  const theirCommit = m ? (isA ? m.commitB : m.commitA) : ZERO32;
  const myRevealed = m ? (isA ? m.revealedA : m.revealedB) : false;
  const picking = Boolean(playing && m && m.picker !== ZERO);
  const myPick = picking && m!.picker.toLowerCase() === me_;
  const left = m ? Number(m.deadline) - now : 0;
  const key = m ? `${m.round}:${m.arena}` : "";

  // a new round result gets its moment on the table, then the next arena is announced
  useEffect(() => {
    if (seen.current.rounds === null) {
      if (m) seen.current.rounds = rounds.length;
      return;
    }
    if (rounds.length > seen.current.rounds) {
      seen.current.rounds = rounds.length;
      setFlash(rounds.length - 1);
      setSel(null);
    }
  }, [rounds.length, m]);
  useEffect(() => {
    if (flash === null) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!m || !playing || picking || m.awaitingVerdict || myCommit !== ZERO32 || flash !== null) return;
    if (seen.current.intros.has(key)) return;
    seen.current.intros.add(key);
    setIntro(key);
  }, [m, key, playing, picking, myCommit, flash]);
  useEffect(() => {
    if (intro === null) return;
    const t = setTimeout(() => setIntro(null), 1800);
    return () => clearTimeout(t);
  }, [intro]);

  // the transcript shows up once the backend has run the live duel
  const liveRound = Boolean(m && (m.awaitingVerdict || (m.state === 2 && m.round === 3)));
  useEffect(() => {
    if (!liveRound) return;
    let alive = true;
    const load = () => loadTranscript(id).then((t) => alive && t && setDuel(t));
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, liveRound]);

  // chores anyone may do, done once each: a stalled arena pick gets drawn from the offer, and if the relay
  // has not revealed our card a few seconds after both commits, we reveal it ourselves
  useEffect(() => {
    if (!m || !playing || !ready || !address || busy) return;
    if (picking && left < -2) {
      const k = `skip:${m.round}`;
      if (!seen.current.tried.has(k)) {
        seen.current.tried.add(k);
        skipPick(w, id).catch(() => {});
      }
    }
    if (!picking && !m.awaitingVerdict && m.commitA !== ZERO32 && m.commitB !== ZERO32 && !myRevealed) {
      const k = `reveal:${m.round}`;
      seen.current.bothAt[k] ??= Date.now();
      if (Date.now() - seen.current.bothAt[k]! > 8000 && !seen.current.tried.has(k)) {
        seen.current.tried.add(k);
        revealMine(w, id, m, address as Address).catch(() => {});
      }
    }
  }, [m, now, playing, picking, left, myRevealed, ready, address, busy, id, w]);

  if (!m) return <Panel className="p-8 text-mute">loading match #{id.toString()}…</Panel>;

  if (m.a === ZERO)
    return (
      <Panel className="p-8">
        <p className="text-mute">There is no match #{id.toString()}.</p>
        <Link to="/play" className="mt-3 inline-block text-neon">
          back to the lobby
        </Link>
      </Panel>
    );

  if (m.state === 0)
    return (
      <Waiting
        id={id}
        stake={m.stake}
        mine={isA}
        busy={busy}
        onCancel={() => act("cancelling", () => cancelMatch(w, id))}
        onJoin={() =>
          act("joining", async () => {
            const deck = loadDecks()[0]!;
            await joinMatch(w, id, deck.cards, m.stake);
          })
        }
      />
    );

  // a seat taken back before anyone joined
  if (m.state === 2 && m.b === ZERO)
    return (
      <Panel className="flex flex-wrap items-center justify-between gap-4 p-8">
        <div>
          <div className="text-2xl font-extrabold">Match #{id.toString()} was cancelled</div>
          <div className="mt-1 text-mute">nobody joined, so the host gets the {formatEther(m.stake)} MON stake back. bets on it are refunded.</div>
          {err && <div className="mt-2 text-sm text-down">{err}</div>}
        </div>
        <div className="flex gap-3">
          {isA && owed > 0n && (
            <Btn disabled={Boolean(busy)} onClick={() => act("claiming", () => withdraw(w))}>
              {busy || `Claim ${Number(formatEther(owed)).toFixed(3)} MON`}
            </Btn>
          )}
          <Btn kind="ghost" onClick={() => nav("/play")}>
            Lobby
          </Btn>
        </div>
      </Panel>
    );

  if (!isA && !isB)
    return (
      <Panel className="p-8">
        <p className="text-mute">You are not playing in match #{id.toString()}.</p>
        <Link to="/watch" className="mt-3 inline-block text-neon">
          watch it on the watch page
        </Link>
      </Panel>
    );

  const opp = faceOf(isA ? m.b : m.a, profileOf(isA ? m.b : m.a));
  const winsMe = isA ? m.winsA : m.winsB;
  const winsThem = isA ? m.winsB : m.winsA;
  const deck = bitsToIds(isA ? m.deckA : m.deckB);
  const used = bitsToIds(isA ? m.usedA : m.usedB);
  const flip = (w: 0 | 1 | 2): 0 | 1 | 2 => (isA || w === 0 ? w : w === 1 ? 2 : 1);
  const side = isA ? "a" : "b";
  const rows: RoundRow[] = rounds.map((r) => ({
    arena: r.arena,
    mine: isA ? r.cardA : r.cardB,
    theirs: isA ? r.cardB : r.cardA,
    winner: flip(r.winner),
    by: r.picked ? (r.picked === side ? "your pick" : "their pick") : r.round === 0 ? "drawn" : "random",
  }));
  const shown = flash !== null ? rows[flash] : undefined;
  const over = m.state === 2;
  const final = over ? (m.result === 3 ? "draw" : (m.result === 1) === isA ? "win" : "loss") : null;
  const lastRow = rows[rows.length - 1];
  // after a round settles the struct already holds the next, random arena, so show the one that was played
  const arena = shown ? shown.arena : over && lastRow ? lastRow.arena : m.arena;

  const pick = address ? loadPick(id, m.round, address as Address) : null;
  const iMoved = theirCommit === ZERO32 ? myCommit !== ZERO32 : myRevealed;
  const theyMoved = myCommit === ZERO32 ? theirCommit !== ZERO32 : isA ? m.revealedB : m.revealedA;
  const canClaim = playing && !picking && !m.awaitingVerdict && left < 0 && iMoved && !theyMoved;
  const picker = pickerOf(id, m.round);
  const introBy = m.round === 0 ? "drawn at random for round 1" : picker ? (picker === side ? "you picked it" : `${opp.handle} picked it`) : "random after a drawn round";

  // what sits on the table
  let mineSlot: Parameters<typeof Table>[0]["mine"];
  let theirSlot: Parameters<typeof Table>[0]["theirs"];
  const res = (w: 0 | 1 | 2, forMe: boolean) => (w === 0 ? null : (w === 1) === forMe ? "winner" : "loser");
  if (shown) {
    mineSlot = { card: shown.mine, facedown: false, state: res(shown.winner, true), placeholder: "" };
    theirSlot = { card: shown.theirs, facedown: false, state: res(shown.winner, false), placeholder: "" };
  } else if (m.awaitingVerdict) {
    mineSlot = { card: isA ? m.cardA : m.cardB, facedown: false, state: "duel", placeholder: "" };
    theirSlot = { card: isA ? m.cardB : m.cardA, facedown: false, state: "duel", placeholder: "" };
  } else if (over && lastRow) {
    mineSlot = { card: lastRow.mine, facedown: false, state: res(lastRow.winner, true), placeholder: "" };
    theirSlot = { card: lastRow.theirs, facedown: false, state: res(lastRow.winner, false), placeholder: "" };
  } else {
    mineSlot = { card: myCommit !== ZERO32 ? (pick?.card ?? null) : null, facedown: true, state: null, commit: myCommit !== ZERO32 ? myCommit : undefined, placeholder: myCommit !== ZERO32 ? "locked in" : sel === null ? "your card goes here" : "ready to lock" };
    theirSlot = { card: null, facedown: theirCommit !== ZERO32, state: null, commit: theirCommit !== ZERO32 ? theirCommit : undefined, placeholder: picking ? "" : `${opp.handle} is choosing` };
  }

  const status = over
    ? "Match over"
    : picking
      ? myPick
        ? "You lost the round, pick the next arena"
        : `${opp.handle} is picking the next arena`
      : m.awaitingVerdict
        ? "Live duel, the models are answering"
        : myCommit === ZERO32
          ? sel === null
            ? "Tap a card to play it"
            : "Ready, lock it in"
          : theirCommit === ZERO32
            ? `Locked in. ${opp.handle} is choosing`
            : "Both locked, flipping";
  const tone = m.awaitingVerdict ? "violet" : picking && myPick ? "down" : "gold";
  const overlay = shown ? (
    <RoundFlash n={flash!} arena={shown.arena} mine={shown.mine} theirs={shown.theirs} winner={shown.winner} oppName={opp.handle} />
  ) : intro === key && playing && !picking ? (
    <ArenaIntro round={m.round} arena={m.arena} by={introBy} />
  ) : undefined;
  const canPlay = playing && !picking && !m.awaitingVerdict && myCommit === ZERO32 && !overlay;

  return (
    <div className="flex flex-col gap-6">
      <Scoreboard pending={picking} me={me} opp={opp} winsMe={winsMe} winsThem={winsThem} round={m.round} arena={arena} pot={Number(formatEther(m.stake * 2n))} clock={playing && left > 0 && !picking ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : null} />
      <Table arena={arena} status={status} tone={tone} oppName={opp.handle} mine={mineSlot} theirs={theirSlot} overlay={overlay} />

      {err && (
        <Panel className="flex items-center justify-between gap-3 border border-down/40 p-4 text-sm">
          <span className="text-down">{err}</span>
          <button className="text-mute hover:text-ink" onClick={() => setErr("")}>
            dismiss
          </button>
        </Panel>
      )}

      {canClaim && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="font-bold">{opp.handle} ran out of time</div>
            <div className="text-sm text-mute">you moved and they did not, so the match is yours to claim</div>
          </div>
          <Btn disabled={Boolean(busy)} onClick={() => act("claiming", () => claimTimeout(w, id))}>
            {busy || "Claim the match"}
          </Btn>
        </Panel>
      )}

      {picking && !shown && (
        <PickPanel
          mine={myPick}
          choices={offerOf(m.offer)}
          cards={deck.filter((c) => !used.includes(c))}
          left={left}
          total={PICK_TIMEOUT}
          oppName={opp.handle}
          onPick={busy ? undefined : (a) => act("picking the arena", () => pickArena(w, id, a))}
        />
      )}

      {(m.awaitingVerdict || m.round === 3) && (
        <>
          <DuelPanel arena={m.awaitingVerdict ? m.arena : (rounds.find((r) => r.round === 2)?.arena ?? m.arena)} duel={duel} oppName={opp.handle} judging={m.awaitingVerdict} />
          {m.awaitingVerdict && left < 0 && (
            <Panel className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="text-sm text-mute">the judge has not answered in time, anyone can settle this round on the card stats</div>
              <Btn kind="outline" disabled={Boolean(busy)} onClick={() => act("settling", () => settleByStats(w, id))}>
                {busy || "Settle on stats"}
              </Btn>
            </Panel>
          )}
        </>
      )}

      {final && (
        <Result final={final} line={final === "win" ? `you won ${formatEther(m.stake * 2n)} MON` : final === "draw" ? `your ${formatEther(m.stake)} MON stake comes back` : `${opp.handle} takes the pot`}>
          {owed > 0n && (
            <Btn disabled={Boolean(busy)} onClick={() => act("claiming", () => withdraw(w))}>
              <Ico name="check" className="h-5 w-5" />
              {busy || `Claim ${Number(formatEther(owed)).toFixed(3)} MON`}
            </Btn>
          )}
          <Btn kind="ghost" onClick={() => nav("/play")}>
            Lobby
          </Btn>
        </Result>
      )}

      {!over && (
        <Hand
          cards={deck}
          used={[...used, ...(pick && myCommit !== ZERO32 ? [pick.card] : [])]}
          arena={m.arena}
          sel={sel}
          pickable={canPlay && !busy}
          onSel={setSel}
          action={canPlay && <LockBtn sel={sel} busy={busy === "locking in"} onLock={() => sel !== null && address && act("locking in", () => lockCard(w, id, m.round, address as Address, sel))} />}
        />
      )}
      <Rounds rounds={rows} oppName={opp.handle} />
    </div>
  );
}

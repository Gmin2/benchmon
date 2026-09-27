import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther, keccak256, parseEther, toHex, type Address } from "viem";
import { duelAbi } from "./abi";
import { CONTRACTS, GAS, commitHash, loadCards, loadPick, readMatch, recentMatches, savePick, sendPick, type Card, type Match } from "./chain";
import { ARENAS } from "./rules";
import { useWallet } from "./useWallet";

const btn = "border rounded px-3 py-2 w-fit disabled:opacity-40";
const STATE = ["open", "playing", "done"];

function useHashMatch(): [bigint | null, (id: bigint | null) => void] {
  const read = () => {
    const m = window.location.hash.match(/^#\/match\/(\d+)$/);
    return m ? BigInt(m[1]!) : null;
  };
  const [id, setId] = useState(read);
  useEffect(() => {
    const on = () => setId(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (next: bigint | null) => {
    window.location.hash = next === null ? "" : `/match/${next}`;
  };
  return [id, go];
}

function CardView({ c, arena, onClick, disabled, selected }: { c: Card; arena?: number; onClick?: () => void; disabled?: boolean; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border rounded p-2 text-left text-xs w-40 disabled:opacity-40 ${selected ? "border-black border-2" : ""}`}
    >
      <div className="font-bold text-sm">{c.name}</div>
      {ARENAS.map((a, i) => (
        <div key={a} className={i === arena ? "font-bold" : ""}>
          {a} {c.stats[i]}
        </div>
      ))}
    </button>
  );
}

function DeckPicker({ cards, onDone, label }: { cards: Card[]; onDone: (deck: number[]) => void; label: string }) {
  const [deck, setDeck] = useState<number[]>([]);
  const toggle = (id: number) => setDeck((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < 5 ? [...d, id] : d));
  return (
    <div className="flex flex-col gap-3">
      <p>pick 5 cards ({deck.length}/5)</p>
      <div className="flex flex-wrap gap-2">
        {cards.map((c) => (
          <CardView key={c.id} c={c} selected={deck.includes(c.id)} onClick={() => toggle(c.id)} />
        ))}
      </div>
      <button className={btn} disabled={deck.length !== 5} onClick={() => onDone(deck)}>
        {label}
      </button>
    </div>
  );
}

function Lobby({ cards, open }: { cards: Card[]; open: (id: bigint) => void }) {
  const { address, write } = useWallet();
  const [list, setList] = useState<{ id: bigint; m: Match }[]>([]);
  const [mode, setMode] = useState<"list" | "create" | { join: bigint; stake: bigint }>("list");
  const [stake, setStake] = useState("0.01");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(
    () =>
      recentMatches()
        .then((l) => {
          setList(l);
          setErr("");
        })
        .catch((e: Error) => setErr(e.message.split("\n")[0]!)),
    [],
  );
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const create = async (deck: number[]) => {
    setBusy("creating match");
    try {
      await write({ address: CONTRACTS.duel, abi: duelAbi, functionName: "create", args: [deck], value: parseEther(stake), gas: GAS.create });
      const count = (await recentMatches(1))[0]!;
      open(count.id);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy("");
  };
  const join = async (id: bigint, value: bigint, deck: number[]) => {
    setBusy("joining");
    try {
      await write({ address: CONTRACTS.duel, abi: duelAbi, functionName: "join", args: [id, deck], value, gas: GAS.join });
      open(id);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy("");
  };

  if (busy) return <p>{busy}</p>;
  if (mode === "create")
    return (
      <div className="flex flex-col gap-3">
        <label className="flex gap-2 items-center">
          stake <input className="border rounded px-2 py-1 w-24" value={stake} onChange={(e) => setStake(e.target.value)} /> MON
        </label>
        <DeckPicker cards={cards} label="create match" onDone={create} />
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>
    );
  if (typeof mode === "object")
    return (
      <div className="flex flex-col gap-3">
        <p>join match {mode.join.toString()} for {formatEther(mode.stake)} MON</p>
        <DeckPicker cards={cards} label="join match" onDone={(d) => join(mode.join, mode.stake, d)} />
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <button className={btn} onClick={() => setMode("create")}>new match</button>
      <p className="font-bold">recent matches</p>
      {list.map(({ id, m }) => {
        const mine = address && [m.a, m.b].some((p) => p.toLowerCase() === address.toLowerCase());
        return (
          <div key={id.toString()} className="flex gap-3 items-center text-sm">
            <span>#{id.toString()}</span>
            <span>{STATE[m.state]}</span>
            <span>{formatEther(m.stake)} MON</span>
            {m.state === 0 && !mine && (
              <button className={btn} onClick={() => setMode({ join: id, stake: m.stake })}>join</button>
            )}
            {mine && <button className={btn} onClick={() => open(id)}>open</button>}
          </div>
        );
      })}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  );
}

function MatchView({ id, cards, back }: { id: bigint; cards: Card[]; back: () => void }) {
  const { address, write } = useWallet();
  const [m, setM] = useState<Match>();
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [owed, setOwed] = useState(0n);
  const working = useRef(false);

  const me = address?.toLowerCase();
  const isA = m && m.a.toLowerCase() === me;
  const isB = m && m.b.toLowerCase() === me;

  // poll the match; when my commit is in and the other side has committed, reveal on my own
  useEffect(() => {
    let alive = true;
    let tryingRound = -1;
    const tick = async () => {
      try {
        const next = await readMatch(id);
        if (!alive) return;
        setM(next);
        if (address) {
          const o = await import("./chain").then((c) => c.pub.readContract({ address: CONTRACTS.duel, abi: duelAbi, functionName: "owed", args: [address] }));
          setOwed(o);
        }
        if (!address || working.current || next.state !== 1 || next.awaitingVerdict) return;
        const amA = next.a.toLowerCase() === address.toLowerCase();
        const myCommit = amA ? next.commitA : next.commitB;
        const myReveal = amA ? next.revealedA : next.revealedB;
        const zero = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const bothIn = next.commitA !== zero && next.commitB !== zero;
        const pick = loadPick(id, next.round, address);
        if (bothIn && myCommit !== zero && !myReveal && pick) {
          working.current = true;
          tryingRound = next.round;
          setStatus("revealing your card");
          await write({ address: CONTRACTS.duel, abi: duelAbi, functionName: "reveal", args: [id, pick.card, pick.salt], gas: GAS.reveal });
          setStatus("");
          working.current = false;
        }
      } catch (e) {
        working.current = false;
        setStatus("");
        // the backend may have revealed for us a moment earlier, or the round already settled: both are fine
        const after = await readMatch(id).catch(() => null);
        const amA = after && address && after.a.toLowerCase() === address.toLowerCase();
        const handled = after && (after.round > tryingRound || after.state !== 1 || (amA ? after.revealedA : after.revealedB));
        if (!handled) setErr((e as Error).message.split("\n")[0]!);
      }
    };
    tick();
    const t = setInterval(tick, 1500);
    // background tabs get their timers throttled, so catch up the moment the tab is visible again
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, address, write]);

  if (!m) return <p>loading match</p>;
  const zero = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const myDeck = isA ? m.deckA : m.deckB;
  const myUsed = isA ? m.usedA : m.usedB;
  const myCommit = isA ? m.commitA : m.commitB;
  const theirCommit = isA ? m.commitB : m.commitA;
  const deckCards = cards.filter((c) => (myDeck >> BigInt(c.id)) & 1n);

  const pick = async (card: number) => {
    if (!address) return;
    working.current = true;
    setErr("");
    try {
      const salt = keccak256(toHex(crypto.getRandomValues(new Uint8Array(32))));
      savePick(id, m.round, address, card, salt);
      setStatus("locking in your pick");
      await write({ address: CONTRACTS.duel, abi: duelAbi, functionName: "commit", args: [id, commitHash(id, m.round, address as Address, card, salt)], gas: GAS.commit });
      setStatus("");
      // the backend reveals for us once both picks are in; our own reveal below stays as a backup
      sendPick(id, m.round, address as Address, card, salt).catch((e: Error) => console.log(`bm: ${e.message}`));
    } catch (e) {
      setErr((e as Error).message);
      setStatus("");
    }
    working.current = false;
  };
  const withdraw = async () => {
    try {
      await write({ address: CONTRACTS.duel, abi: duelAbi, functionName: "withdraw", gas: GAS.withdraw });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const result = ["", "a won", "b won", "draw"][m.result];
  return (
    <div className="flex flex-col gap-3">
      <button className="text-sm underline w-fit" onClick={back}>back to lobby</button>
      <p className="font-bold">match #{id.toString()} · {formatEther(m.stake)} MON each · you are {isA ? "a" : isB ? "b" : "watching"}</p>
      <p>
        round {Math.min(m.round + 1, 3)} of 3 · score a {m.winsA} - {m.winsB} b · {STATE[m.state]}
      </p>
      {m.state === 0 && <p>waiting for an opponent to join</p>}
      {m.state === 1 && !m.awaitingVerdict && (
        <>
          <p>
            arena: <b>{ARENAS[m.arena]}</b>
            {m.round === 2 && " · live duel: the two models will actually answer a prompt"}
          </p>
          {(isA || isB) && myCommit === zero && (
            <div className="flex flex-wrap gap-2">
              {deckCards.map((c) => (
                <CardView key={c.id} c={c} arena={m.arena} disabled={Boolean((myUsed >> BigInt(c.id)) & 1n) || Boolean(status)} onClick={() => pick(c.id)} />
              ))}
            </div>
          )}
          {myCommit !== zero && theirCommit === zero && <p>pick locked, waiting for the other player</p>}
        </>
      )}
      {m.awaitingVerdict && <p>live duel: the models are answering, the judge posts the verdict onchain</p>}
      {m.state === 2 && <p className="font-bold">{result}</p>}
      {owed > 0n && (
        <button className={btn} onClick={withdraw}>
          withdraw {formatEther(owed)} MON
        </button>
      )}
      {status && <p className="text-sm">{status}</p>}
      {err && <p className="text-red-600 text-sm break-all">{err}</p>}
    </div>
  );
}

export function Game() {
  const [cards, setCards] = useState<Card[]>([]);
  const [matchId, go] = useHashMatch();
  const [err, setErr] = useState("");
  // the public rpc drops the odd request, so keep trying until the roster loads
  useEffect(() => {
    let alive = true;
    const load = () =>
      loadCards()
        .then((c) => alive && setCards(c))
        .catch((e: Error) => {
          if (!alive) return;
          setErr(e.message.split("\n")[0]!);
          setTimeout(load, 2000);
        });
    load();
    return () => {
      alive = false;
    };
  }, []);
  if (cards.length === 0) return <p>loading cards{err && ` (retrying: ${err})`}</p>;
  return matchId === null ? <Lobby cards={cards} open={go} /> : <MatchView id={matchId} cards={cards} back={() => go(null)} />;
}

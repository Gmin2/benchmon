import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { BACKEND, type Card, type Match } from "../chain";
import { loadRounds, trackRounds, type RoundLog } from "../duel";
import { deckOf, short } from "../hooks";
import { ARENAS } from "../rules";
import { CardBack, GameCard } from "../ui/Card";
import { Chip, Ico } from "../ui/kit";
import { artOf, infoOf, tierOf, type Arena } from "../ui/meta";

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
const TITLES: Record<Arena, string> = { code: "server room", math: "chalk hall", reasoning: "library", speed: "night track", cost: "market", honesty: "court" };

type Transcript = {
  prompt: { id: string; text: string; answer?: string };
  a: { text: string; ms: number; costUsd: number; model: string; correct?: boolean };
  b: { text: string; ms: number; costUsd: number; model: string; correct?: boolean };
  outcome: number;
  reason: string;
};

function phase(m: Match) {
  if (m.state === 0) return { label: "Waiting for an opponent", tone: "flat" as const };
  if (m.state === 2) return { label: m.result === 3 ? "Draw" : "Finished", tone: "flat" as const };
  if (m.awaitingVerdict) return { label: "Live duel, models answering", tone: "violet" as const };
  if (m.picker !== "0x0000000000000000000000000000000000000000") return { label: `Side ${m.picker.toLowerCase() === m.a.toLowerCase() ? "A" : "B"} picks the next arena`, tone: "down" as const };
  const a = m.commitA !== ZERO, b = m.commitB !== ZERO;
  if (m.revealedA && m.revealedB) return { label: "Cards revealed", tone: "gold" as const };
  if (a && b) return { label: "Both locked, revealing", tone: "gold" as const };
  if (a || b) return { label: "One side locked in", tone: "up" as const };
  return { label: "Picking cards", tone: "up" as const };
}

function useCountdown(deadline: bigint) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Number(deadline) * 1000 - now);
  if (!deadline || left === 0) return null;
  const s = Math.floor(left / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Pips({ wins, tone }: { wins: number; tone: "a" | "b" }) {
  return (
    <div className="flex gap-1.5">
      {[0, 1].map((i) => (
        <span key={i} className={`h-2.5 w-7 rounded-full ${i < wins ? (tone === "a" ? "bg-neon" : "bg-down") : "bg-white/15"}`} />
      ))}
    </div>
  );
}

function DeckRow({ deck, used, current, side }: { deck: Card[]; used: bigint; current?: number; side: "a" | "b" }) {
  return (
    <div className={`flex gap-1.5 ${side === "b" ? "flex-row-reverse" : ""}`}>
      {deck.map((c) => {
        const spent = Boolean((used >> BigInt(c.id)) & 1n);
        const now = c.id === current;
        const i = infoOf(c);
        return (
          <span
            key={c.id}
            title={`${i.display}${spent ? " (used)" : ""}`}
            className={`relative grid h-14 w-12 place-items-center overflow-hidden rounded-xl border ${now ? "border-neon" : "border-white/10"} bg-black/50 ${spent && !now ? "opacity-35 grayscale" : ""}`}
          >
            <img src={artOf(c.name, tierOf(i))} alt="" className="pixel h-full w-full scale-125 object-contain" />
          </span>
        );
      })}
    </div>
  );
}

function Slot({ card, locked, revealed, commit, side, arena, facing, result }: { card?: Card; locked: boolean; revealed: boolean; commit: string; side: "a" | "b"; arena: Arena; facing?: Card; result?: "winner" | "loser" | null }) {
  if (card && (revealed || result !== undefined)) return <GameCard info={infoOf(card)} size="tile" arena={arena} facing={facing ? infoOf(facing).type : null} state={result ?? null} />;
  if (locked) {
    return (
      <div className="bm-card size-tile is-facedown">
        <div className="inner">
          <div className="side front" />
          <PlaceholderBack side={side} commit={commit} />
        </div>
      </div>
    );
  }
  return (
    <div className="grid aspect-[5/7.4] w-[198px] place-items-center rounded-2xl border-2 border-dashed border-white/20 bg-black/30 text-center text-sm text-white/60">
      <span>
        <Ico name="clock-2" className="mx-auto mb-2 h-6 w-6" />
        picking a card
      </span>
    </div>
  );
}

// a locked card nobody can name yet still gets the proper back
function PlaceholderBack({ side, commit }: { side: "a" | "b"; commit: string }) {
  return <CardBack side={side === "a" ? "mine" : "theirs"} commit={commit} label={side === "a" ? "side a" : "side b"} />;
}

export function MatchStage({ id, match: m, cards }: { id: bigint; match: Match; cards: Card[] }) {
  const arena = ARENAS[m.arena] ?? "code";
  const deckA = deckOf(m.deckA, cards);
  const deckB = deckOf(m.deckB, cards);
  const byId = (n: number) => cards.find((c) => c.id === n);
  const lockedA = m.commitA !== ZERO;
  const lockedB = m.commitB !== ZERO;
  const over = m.state === 2;
  // after the match the struct keeps the last round's cards, show them if they were really played
  const lastA = over && (m.usedA >> BigInt(m.cardA)) & 1n ? byId(m.cardA) : undefined;
  const lastB = over && (m.usedB >> BigInt(m.cardB)) & 1n ? byId(m.cardB) : undefined;
  const cardA = m.revealedA ? byId(m.cardA) : lastA;
  const cardB = m.revealedB ? byId(m.cardB) : lastB;
  const resA = over ? (m.result === 1 ? "winner" : m.result === 2 ? "loser" : null) : undefined;
  const resB = over ? (m.result === 2 ? "winner" : m.result === 1 ? "loser" : null) : undefined;
  const p = phase(m);
  const clock = useCountdown(m.state === 1 ? m.deadline : 0n);
  const [rounds, setRounds] = useState<RoundLog[]>(() => loadRounds(id));
  const prev = useRef<Match>(undefined);
  const [duel, setDuel] = useState<Transcript | null>(null);

  useEffect(() => {
    prev.current = undefined;
    setRounds(loadRounds(id));
  }, [id]);
  // rounds are read off the counter moving, see trackRounds
  useEffect(() => {
    setRounds(trackRounds(id, prev.current, m));
    prev.current = m;
  }, [id, m]);

  // the transcript shows up once the backend has run the live duel
  useEffect(() => {
    if (!(m.awaitingVerdict || (m.state === 2 && m.round >= 2))) return;
    let alive = true;
    const load = () =>
      fetch(`${BACKEND}/duel/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((t) => alive && t && setDuel(t))
        .catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, m.awaitingVerdict, m.state, m.round]);

  const winnerText = m.result === 1 ? "Side A wins the match" : m.result === 2 ? "Side B wins the match" : m.result === 3 ? "Draw, stakes returned" : "";

  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] bg-panel">
      <div className="relative min-h-[520px]">
        <img src={`/art/arenas/${arena}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,19,.55),rgba(16,17,19,.15)_35%,rgba(16,17,19,.7))]" />

        {/* top banner */}
        <div className="relative flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3 rounded-full bg-black/60 px-4 py-2 backdrop-blur">
            <span className="text-sm text-white/60">Round {Math.min(m.round + 1, 3)} of 3</span>
            <span className="h-4 w-px bg-white/20" />
            <span className="text-sm">
              {m.state === 0 ? (
                "arena is drawn when a player joins"
              ) : (
                <>
                  arena <b className="font-semibold text-neon uppercase">{arena}</b> · {TITLES[arena]}
                </>
              )}
            </span>
            {m.round === 2 && m.state === 1 && <Chip tone="violet">live duel round</Chip>}
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={p.tone}>{p.label}</Chip>
            {clock && (
              <span className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-[13px] backdrop-blur">
                <Ico name="stopwatch" className="h-4 w-4" />
                {clock}
              </span>
            )}
          </div>
        </div>

        {winnerText && (
          <div className="relative -mt-2 mb-2 flex justify-center">
            <span className="flex items-center gap-2 rounded-2xl bg-neon px-6 py-2.5 font-display text-2xl tracking-wide text-bg uppercase shadow-2xl">
              <Ico name="star-2" className="h-5 w-5" />
              {winnerText}
            </span>
          </div>
        )}

        {/* the two sides */}
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-end gap-4 px-6 pb-6 md:gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex w-full items-center justify-between rounded-2xl bg-black/60 px-4 py-3 backdrop-blur">
              <div>
                <div className="text-xs text-white/60">Side A</div>
                <div className="font-semibold">{short(m.a)}</div>
              </div>
              <Pips wins={m.winsA} tone="a" />
            </div>
            <Slot card={cardA ?? undefined} locked={lockedA} revealed={m.revealedA} commit={m.commitA} side="a" arena={arena} facing={cardB} result={resA} />
            <DeckRow deck={deckA} used={m.usedA} current={m.revealedA ? m.cardA : undefined} side="a" />
          </div>

          <div className="flex flex-col items-center gap-2 pb-40">
            <span className="font-display text-5xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,.6)]">VS</span>
            <span className="rounded-full bg-black/60 px-4 py-1.5 text-2xl font-bold backdrop-blur">
              <span className="text-neon">{m.winsA}</span>
              <span className="mx-2 text-white/40">:</span>
              <span className="text-down">{m.winsB}</span>
            </span>
            <span className="text-xs text-white/60">{formatEther(m.stake)} MON each</span>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex w-full items-center justify-between rounded-2xl bg-black/60 px-4 py-3 backdrop-blur">
              <Pips wins={m.winsB} tone="b" />
              <div className="text-right">
                <div className="text-xs text-white/60">Side B</div>
                <div className="font-semibold">{m.b.startsWith("0x0000") ? "open seat" : short(m.b)}</div>
              </div>
            </div>
            <Slot card={cardB ?? undefined} locked={lockedB} revealed={m.revealedB} commit={m.commitB} side="b" arena={arena} facing={cardA} result={resB} />
            <DeckRow deck={deckB} used={m.usedB} current={m.revealedB ? m.cardB : undefined} side="b" />
          </div>
        </div>


      </div>

      {/* live duel and round history */}
      {(duel || m.awaitingVerdict || rounds.length > 0) && (
        <div className="grid gap-4 border-t border-line p-5 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-mute">
              <Ico name="energy" className="h-4 w-4 text-neon" />
              Live duel
            </div>
            {duel ? (
              <div className="rounded-2xl bg-panel-2 p-4">
                <p className="text-[15px] leading-relaxed">{duel.prompt.text}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["a", "b"] as const).map((k) => {
                    const r = duel[k];
                    const won = duel.outcome === (k === "a" ? 1 : 2);
                    return (
                      <div key={k} className={`rounded-xl border p-3 ${won ? "border-neon/60 bg-neon/5" : "border-line"}`}>
                        <div className="flex items-center justify-between text-xs text-mute">
                          <span>
                            side {k} · {r.model}
                          </span>
                          {r.correct !== undefined && <Chip tone={r.correct ? "up" : "down"}>{r.correct ? "correct" : "wrong"}</Chip>}
                        </div>
                        <p className="mt-2 line-clamp-4 text-sm">{r.text || "no answer"}</p>
                        <div className="mt-2 text-xs text-dim">
                          {(r.ms / 1000).toFixed(1)}s · ${r.costUsd.toFixed(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-mute">
                  judge: <span className="text-ink">{duel.reason}</span>
                </p>
              </div>
            ) : m.awaitingVerdict ? (
              <div className="rounded-2xl bg-panel-2 p-4 text-sm text-mute">both models are answering the same prompt. the judge posts the verdict onchain in a few seconds.</div>
            ) : (
              <div className="rounded-2xl bg-panel-2 p-4 text-sm text-mute">the third round is played by the models themselves, judged live.</div>
            )}
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-mute">
              <Ico name="flag-8" className="h-4 w-4 text-neon" />
              Rounds seen
            </div>
            <div className="flex flex-col gap-2">
              {rounds.length === 0 && <div className="rounded-2xl bg-panel-2 p-4 text-sm text-mute">rounds appear here as cards are revealed.</div>}
              {rounds.map((r) => {
                const a = byId(r.cardA), b = byId(r.cardB);
                return (
                  <div key={r.round} className="flex items-center justify-between rounded-2xl bg-panel-2 px-4 py-3 text-sm">
                    <span className="text-mute">
                      R{r.round + 1} · <span className="uppercase">{ARENAS[r.arena]}</span>
                    </span>
                    <span>
                      {a ? infoOf(a).display : `#${r.cardA}`} <span className="text-dim">vs</span> {b ? infoOf(b).display : `#${r.cardB}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

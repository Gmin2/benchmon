import type { ReactNode } from "react";
import { byId } from "../../hooks";
import type { Player } from "../../mock";
import { ARENAS } from "../../rules";
import { GameCard, type CardState } from "../../ui/Card";
import { CLASSES } from "../../ui/generated";
import { Btn, Chip, Ico, Panel } from "../../ui/kit";
import { infoOf, type Arena } from "../../ui/meta";
import type { Transcript } from "../../duel";

export const TITLES: Record<Arena, string> = { code: "server room", math: "chalk hall", reasoning: "library", speed: "night track", cost: "market", honesty: "court" };
export const best = (cards: number[], arena: number) => cards.reduce((b, id) => (byId(id).stats[arena]! > byId(b).stats[arena]! ? id : b), cards[0]!);

export type Face = Pick<Player, "handle" | "cls" | "body" | "rank">;

// a player with a profile shows their username and look; a stranger gets a look from their address
export function faceOf(address: string, p?: { username: string; cls: string; body: "male" | "female" } | null): Face {
  if (p) return { handle: p.username, cls: p.cls as Face["cls"], body: p.body, rank: "rookie" };
  const n = parseInt(address.slice(2, 10), 16) || 0;
  return { handle: `${address.slice(0, 6)}…${address.slice(-4)}`, cls: CLASSES[n % CLASSES.length]!.cls as Face["cls"], body: n & 1 ? "female" : "male", rank: "rookie" };
}

export const avatarSrc = (p: Pick<Player, "cls" | "body" | "rank">, bust = true) => `/art/classes/${p.cls}-${p.body}-${p.rank}${bust ? "-bust" : ""}@1x.png`;

export function Avatar({ p, size = "h-12 w-12" }: { p: Pick<Player, "cls" | "body" | "rank">; size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-panel-2 ${size}`}>
      <img src={avatarSrc(p)} alt="" className="pixel h-full w-full object-cover" />
    </span>
  );
}

export function ArenaTile({ arena, hint, onClick, dim, chosen }: { arena: number; hint?: string; onClick?: () => void; dim?: boolean; chosen?: boolean }) {
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

export function Scoreboard({ me, opp, winsMe, winsThem, round, arena, pot, clock, pending }: { me: Face; opp: Face; winsMe: number; winsThem: number; round: number; arena: number; pot: number; clock?: string | null; pending?: boolean }) {
  const name = ARENAS[arena]!;
  return (
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
          Round {Math.min(round, 2) + 1} of 3 · <span className="font-semibold text-neon uppercase">{pending ? "arena being picked" : name}</span>
          {round === 2 && <span className="ml-2 rounded-md bg-[#8b5cf6]/20 px-2 py-0.5 text-xs text-[#b69cff]">live duel</span>}
        </div>
        <div className="mt-1 text-3xl font-extrabold">
          <span className="text-neon">{winsMe}</span>
          <span className="mx-3 text-dim">:</span>
          <span className="text-down">{winsThem}</span>
        </div>
        <div className="text-xs text-dim">
          pot {pot.toFixed(2)} MON{clock ? ` · ${clock} left` : ""}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-semibold">{opp.handle}</div>
          <div className="flex justify-end gap-1.5 pt-1">{[0, 1].map((i) => <span key={i} className={`h-2 w-7 rounded-full ${i < winsThem ? "bg-down" : "bg-panel-2"}`} />)}</div>
        </div>
        <Avatar p={opp} />
      </div>
    </div>
  );
}

export type Slot = { card: number | null; facedown: boolean; state: CardState | null; commit?: string; placeholder: ReactNode };

// the arena backdrop with both cards and the overlays that open each round
export function Table({ arena, status, tone, mine, theirs, oppName, overlay }: { arena: number; status: string; tone: "up" | "down" | "flat" | "gold" | "violet"; mine: Slot; theirs: Slot; oppName: string; overlay?: ReactNode }) {
  const name = ARENAS[arena]!;
  const face = (s: Slot, other: Slot) => (other.card !== null && !s.facedown && !other.facedown ? infoOf(byId(other.card)).type : null);
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)]">
      <img key={name} src={`/art/arenas/${name}@1x.png`} alt="" className="pixel absolute inset-0 h-full w-full animate-[fadein_.5s_ease] object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,19,.45),rgba(16,17,19,.1)_40%,rgba(16,17,19,.65))]" />
      {!overlay && status && (
        <div className="relative flex justify-center pt-5">
          <Chip tone={tone}>{status}</Chip>
        </div>
      )}
      <div className="relative grid min-h-[380px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-8">
        <div className="flex justify-center">
          {mine.card === null ? (
            <div className="grid aspect-[5/7.4] w-[198px] place-items-center rounded-2xl border-2 border-dashed border-white/25 bg-black/30 p-3 text-center text-sm text-white/70">{mine.placeholder}</div>
          ) : (
            <GameCard info={infoOf(byId(mine.card))} size="tile" arena={name} facing={face(mine, theirs)} facedown={mine.facedown} back={{ side: "mine", commit: mine.commit, label: "you" }} state={mine.state} className={mine.facedown ? "is-locking" : ""} />
          )}
        </div>
        <span className="font-display text-6xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,.6)]">VS</span>
        <div className="flex justify-center">
          {theirs.card === null && !theirs.facedown ? (
            <div className="grid aspect-[5/7.4] w-[198px] place-items-center rounded-2xl border-2 border-dashed border-white/25 bg-black/30 p-3 text-center text-sm text-white/70">{theirs.placeholder}</div>
          ) : (
            <GameCard info={infoOf(byId(theirs.card ?? mine.card ?? 0))} size="tile" arena={name} facing={face(theirs, mine)} facedown={theirs.facedown} back={{ side: "theirs", commit: theirs.commit, label: oppName }} state={theirs.state} />
          )}
        </div>
      </div>
      {overlay && <div className="absolute inset-0 z-10 grid animate-[fadein_.3s_ease] place-items-center bg-black/55 backdrop-blur-[2px]">{overlay}</div>}
    </section>
  );
}

export function ArenaIntro({ round, arena, by }: { round: number; arena: number; by: string }) {
  const name = ARENAS[arena]!;
  return (
    <div className="flex animate-[hero-in_.5s_cubic-bezier(.2,.7,.2,1)_both] flex-col items-center text-center">
      <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white/80">
        Round {round + 1} of 3{round === 2 ? " · live duel" : ""}
      </span>
      <span className="mt-3 font-display text-[88px] leading-none text-neon uppercase drop-shadow-[0_6px_0_rgba(0,0,0,.6)]">{name}</span>
      <span className="mt-2 text-lg text-white/80">
        {TITLES[name]} · the {name} stat decides this round
      </span>
      <span className="mt-1 text-sm text-white/55">{by}</span>
    </div>
  );
}

export function RoundFlash({ n, arena, mine, theirs, winner, oppName }: { n: number; arena: number; mine: number; theirs: number; winner: 0 | 1 | 2; oppName: string }) {
  return (
    <div className="flex animate-[hero-in_.4s_ease_both] flex-col items-center text-center">
      <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white/80">Round {n + 1}</span>
      <span className={`mt-3 font-display text-7xl uppercase drop-shadow-[0_6px_0_rgba(0,0,0,.6)] ${winner === 1 ? "text-neon" : winner === 2 ? "text-down" : "text-white"}`}>{winner === 1 ? "You take it" : winner === 2 ? `${oppName} takes it` : "Drawn"}</span>
      <span className="mt-3 text-lg text-white/85">
        {infoOf(byId(mine)).display} <b className="text-neon">{byId(mine).stats[arena]}</b>
        <span className="mx-2 text-white/50">vs</span>
        <b className="text-down">{byId(theirs).stats[arena]}</b> {infoOf(byId(theirs)).display}
      </span>
    </div>
  );
}

export function PickPanel({ mine, choices, cards, left, total, oppName, chosen, onPick }: { mine: boolean; choices: number[]; cards: number[]; left: number; total: number; oppName: string; chosen?: number | null; onPick?: (a: number) => void }) {
  return (
    <Panel className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{mine ? "Pick the next arena" : `${oppName} is picking the next arena`}</h3>
          <p className="text-sm text-mute">{mine ? "you lost the round, so you choose where the next one is fought." : "they lost the round, so they choose. you will see it before you play."}</p>
        </div>
        <div className="w-40">
          <div className="flex justify-between text-xs text-mute">
            <span>{mine ? "time" : "their time"}</span>
            <span className={left <= 10 ? "text-down" : ""}>{Math.max(0, left)}s</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-neon transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(0, left / total) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {choices.map((a) => {
          const b = cards.length ? best(cards, a) : null;
          return (
            <ArenaTile
              key={a}
              arena={a}
              hint={b !== null ? `your best: ${infoOf(byId(b)).display} ${byId(b).stats[a]}` : undefined}
              onClick={mine && onPick ? () => onPick(a) : undefined}
              dim={!mine && chosen != null && chosen !== a}
              chosen={chosen === a}
            />
          );
        })}
      </div>
    </Panel>
  );
}

export function DuelPanel({ arena, duel, oppName, judging }: { arena: number; duel: Transcript | null; oppName: string; judging: boolean }) {
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2 text-sm text-mute">
        <Ico name="energy" className="h-4 w-4 text-neon" />
        Live duel · judged by kimi
      </div>
      {!duel ? (
        <div className="flex items-center gap-3 rounded-2xl bg-panel-2 p-4 text-mute">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neon" />
          {judging ? `both models got the same ${ARENAS[arena]} prompt and are answering…` : "no transcript, the judge did not answer in time so this round was settled on the card stats"}
        </div>
      ) : (
        <div className="rounded-2xl bg-panel-2 p-4">
          <p className="text-[15px]">{duel.prompt}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["a", "b"] as const).map((k) => {
              const r = duel[k];
              const won = duel.outcome === (k === "a" ? 1 : 2);
              return (
                <div key={k} className={`rounded-xl border p-3 ${won ? "border-neon/60 bg-neon/5" : "border-line"}`}>
                  <div className="flex items-center justify-between text-xs text-mute">
                    <span>
                      {k === "a" ? "you" : oppName} · {r.model}
                    </span>
                    <Chip tone={r.correct ? "up" : "down"}>{r.correct ? "correct" : "wrong"}</Chip>
                  </div>
                  <p className="mt-2 font-mono text-sm break-words whitespace-pre-wrap">{r.text.slice(0, 600)}</p>
                  <div className="mt-2 text-xs text-dim">
                    {(r.ms / 1000).toFixed(1)}s · ${r.costUsd.toFixed(5)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-mute">
            verdict: <span className="text-ink">{duel.reason}</span>
          </p>
        </div>
      )}
    </Panel>
  );
}

export function Hand({ cards, used, arena, sel, pickable, onSel, action }: { cards: number[]; used: number[]; arena: number; sel: number | null; pickable: boolean; onSel: (id: number | null) => void; action?: ReactNode }) {
  const name = ARENAS[arena]!;
  const left = cards.filter((id) => !used.includes(id));
  const top = left.length ? best(left, arena) : null;
  return (
    <Panel className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold">
          Your hand <span className="text-sm font-medium text-mute">· {name} counts this round</span>
        </h3>
        {action}
      </div>
      <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
        {cards.map((id) => {
          const isUsed = used.includes(id);
          return (
            <div key={id} className="relative">
              {id === top && pickable && <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-neon px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-bg">best {name}</span>}
              <GameCard info={infoOf(byId(id))} size="tile" arena={name} state={isUsed ? "used" : sel === id ? "selected" : null} onClick={pickable && !isUsed ? () => onSel(sel === id ? null : id) : undefined} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function LockBtn({ sel, busy, onLock }: { sel: number | null; busy?: boolean; onLock: () => void }) {
  return (
    <Btn size="lg" disabled={sel === null || busy} onClick={onLock}>
      <Ico name="lock" className="h-5 w-5" />
      {busy ? "Locking in…" : sel === null ? "Pick a card" : `Lock in ${infoOf(byId(sel)).display}`}
    </Btn>
  );
}

export type RoundRow = { arena: number; mine: number; theirs: number; winner: 0 | 1 | 2; by?: string };

export function Rounds({ rounds, oppName }: { rounds: RoundRow[]; oppName: string }) {
  if (!rounds.length) return null;
  return (
    <Panel className="p-5">
      <h3 className="mb-3 text-xl font-bold">Rounds</h3>
      <div className="flex flex-col gap-2">
        {rounds.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel-2 px-4 py-3">
            <span className="text-mute">
              R{i + 1} · <span className="text-ink uppercase">{ARENAS[r.arena]}</span>
              {r.by && <span className="ml-2 text-xs">{r.by}</span>}
            </span>
            <span>
              {infoOf(byId(r.mine)).display} <b className="text-neon">{byId(r.mine).stats[r.arena]}</b>
              <span className="mx-2 text-dim">vs</span>
              <b className="text-down">{byId(r.theirs).stats[r.arena]}</b> {infoOf(byId(r.theirs)).display}
            </span>
            <Chip tone={r.winner === 1 ? "up" : r.winner === 2 ? "down" : "flat"}>{r.winner === 1 ? "you" : r.winner === 2 ? oppName : "draw"}</Chip>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Result({ final, line, children }: { final: "win" | "loss" | "draw"; line: string; children: ReactNode }) {
  return (
    <Panel className={`flex flex-wrap items-center justify-between gap-4 p-6 ${final === "win" ? "bg-[linear-gradient(110deg,#2a3a0e,#1e1f23_60%)]" : ""}`}>
      <div>
        <div className="font-display text-5xl tracking-wide uppercase">{final === "win" ? "You win" : final === "loss" ? "You lose" : "Draw"}</div>
        <div className="mt-1 text-mute">{line}</div>
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </Panel>
  );
}

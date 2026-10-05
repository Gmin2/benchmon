import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dealRound, loadScore, revealRound, saveScore, scoreRound, type ArenaModel, type Call, type Reveal, type Round, type Score, type Slot } from "../arena";
import { roster } from "../hooks";
import { ARENAS } from "../rules";
import { Logo } from "../ui/brand";
import { Btn, Chip, Ico, Panel } from "../ui/kit";
import { Md } from "../ui/Md";
import { Mon } from "../ui/Mon";
import { artOf, displayName, infoOf, tierOf } from "../ui/meta";
import { LoginDialog } from "./landing/LoginDialog";

type Mode = "blind" | "pick";
const CATS = ["any", ...ARENAS] as const;

const art = (name: string) => {
  const c = roster().find((x) => x.name === name);
  return c ? artOf(c.name, tierOf(infoOf(c))) : null;
};

function ModelBadge({ m, big }: { m: ArenaModel; big?: boolean }) {
  const src = art(m.name);
  return (
    <span className="flex items-center gap-3">
      {src && <img src={src} alt="" className={`pixel shrink-0 rounded-xl bg-panel-2 object-contain ${big ? "h-14 w-14" : "h-9 w-9"}`} />}
      <span className="min-w-0">
        <span className={`block truncate font-semibold ${big ? "text-lg" : ""}`}>{displayName(m.name)}</span>
        <span className="block text-xs text-mute">{m.lab}</span>
      </span>
    </span>
  );
}

function Answer({ slot, round, reveal, call, spotPick }: { slot: Slot; round: Round; reveal: Reveal | null; call: Call | null; spotPick: Slot | null }) {
  const side = round[slot];
  const shown = reveal?.[slot];
  const won = reveal && reveal.winner === slot;
  const lost = reveal && reveal.winner !== slot && reveal.winner !== "draw";
  const model = shown?.model ?? side.model;
  return (
    <div className={`flex min-h-[150px] min-w-0 flex-col rounded-2xl border p-4 transition ${won ? "border-neon/70 bg-neon/[.06] shadow-[0_0_0_1px_rgba(184,255,61,.25)]" : lost ? "border-line opacity-80" : "border-line bg-panel-2/40"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        {model ? (
          <ModelBadge m={model} />
        ) : (
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-panel-2 font-display text-lg text-neon">{slot}</span>
            model {slot}
          </span>
        )}
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {call === slot && <Chip tone="violet">your call</Chip>}
          {spotPick === slot && <Chip tone="gold">your spot</Chip>}
          {shown && shown.correct !== undefined && <Chip tone={shown.correct ? "up" : "down"}>{shown.correct ? "right" : "wrong"}</Chip>}
          {won && <Chip tone="up">winner</Chip>}
        </span>
      </div>
      <Md text={side.text.slice(0, 1600)} className="flex-1 text-[15px] leading-6 text-ink/90" />
      <div className="mt-3 flex items-center gap-3 text-xs text-dim">
        {/* time and cost decide ties, so they stay hidden until the reveal */}
        {reveal ? (
          <>
            <span>{(side.ms / 1000).toFixed(1)}s</span>
            <span>${side.costUsd < 0.0001 ? side.costUsd.toFixed(6) : side.costUsd.toFixed(4)}</span>
          </>
        ) : (
          <span>time and cost show after the reveal</span>
        )}
        {shown?.grade && (
          <span className="truncate" title={shown.grade.why}>
            graded {shown.grade.score}/10 · {shown.grade.why}
          </span>
        )}
      </div>
    </div>
  );
}

function Setup({ mode, setMode, cat, setCat, pickA, pickB, setPick, onDeal, busy }: {
  mode: Mode;
  setMode: (m: Mode) => void;
  cat: (typeof CATS)[number];
  setCat: (c: (typeof CATS)[number]) => void;
  pickA: number | null;
  pickB: number | null;
  setPick: (id: number) => void;
  onDeal: () => void;
  busy: boolean;
}) {
  const ready = mode === "blind" || (pickA !== null && pickB !== null);
  return (
    <Panel className="p-5 md:p-7">
      <div className="flex flex-wrap items-center gap-2">
        {(["blind", "pick"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`h-11 rounded-full px-5 text-sm font-bold transition ${mode === m ? "bg-neon text-bg" : "bg-panel-2 text-mute hover:text-ink"}`}>
            {m === "blind" ? "Blind round" : "Pick two models"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-mute">
        {mode === "blind" ? "Two random models answer the same task. You call the winner before kimi does, then spot which one is which." : "Choose two models and call which answer kimi will prefer."}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`h-9 rounded-full border px-4 text-sm capitalize transition ${cat === c ? "border-neon/60 bg-neon/10 text-neon" : "border-line text-mute hover:text-ink"}`}>
            {c}
          </button>
        ))}
      </div>

      {mode === "pick" && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {roster().map((c) => {
            const on = c.id === pickA || c.id === pickB;
            return (
              <button key={c.id} onClick={() => setPick(c.id)} className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition ${on ? "border-neon/70 bg-neon/10" : "border-line hover:border-mute/40"}`}>
                <img src={artOf(c.name, tierOf(infoOf(c)))} alt="" className="pixel h-10 w-10 shrink-0 rounded-lg bg-panel-2 object-contain" />
                <span className="min-w-0 truncate text-sm">{displayName(c.name)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Btn size="lg" onClick={onDeal} disabled={!ready || busy}>
          {busy ? "Dealing…" : mode === "pick" && !ready ? "Pick two models" : "Deal a round"}
        </Btn>
      </div>
    </Panel>
  );
}

export function Arena({ standalone = false }: { standalone?: boolean }) {
  const [mode, setMode] = useState<Mode>("blind");
  const [cat, setCat] = useState<(typeof CATS)[number]>("any");
  const [pickA, setPickA] = useState<number | null>(null);
  const [pickB, setPickB] = useState<number | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [spotPick, setSpotPick] = useState<Slot | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [score, setScore] = useState<Score>(loadScore);
  const [login, setLogin] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => saveScore(score), [score]);

  const setPick = (id: number) => {
    if (id === pickA) return setPickA(pickB), setPickB(null);
    if (id === pickB) return setPickB(null);
    if (pickA === null) return setPickA(id);
    setPickB(id);
  };

  async function deal() {
    setBusy(true);
    setErr("");
    setReveal(null);
    setCall(null);
    setSpotPick(null);
    try {
      const arena = cat === "any" ? undefined : ARENAS.indexOf(cat);
      const q = mode === "pick" && pickA !== null && pickB !== null ? { arena, a: pickA, b: pickB } : { arena };
      setRound(await dealRound(q));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function lockIn() {
    if (!round || !call) return;
    setBusy(true);
    setErr("");
    try {
      const r = await revealRound(round.token, { winner: call, ...(round.spot && spotPick ? { model: round.spot.id, slot: spotPick } : {}) });
      setReveal(r);
      setScore((s) => scoreRound(s, r));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const share = async () => {
    const text = `I called ${score.best} AI model fights in a row on benchmon arena. Can you tell claude from gpt blind? ${location.origin}/arena`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr("could not copy, your browser blocked the clipboard");
    }
  };

  const judging = busy && Boolean(round) && Boolean(call) && !reveal;
  const verdictLine = useMemo(() => {
    if (!reveal) return "";
    const w = reveal.winner === "draw" ? "a draw" : `${displayName(reveal[reveal.winner].model.name)} wins`;
    return `${w}: ${reveal.reason}`;
  }, [reveal]);

  const body = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-neon uppercase">{standalone ? "Arena · free, no login" : "Arena · free practice"}</p>
          <h2 className="font-display text-[40px] leading-none tracking-wide uppercase md:text-[52px]">Call the fight</h2>
          <p className="mt-2 max-w-xl text-mute">Real answers from 15 real AI models. Guess which one kimi picks, then find out who wrote what.</p>
        </div>
        <div className="flex gap-2">
          {[
            ["points", score.points],
            ["streak", score.streak],
            ["best", score.best],
          ].map(([k, v]) => (
            <div key={k} className="min-w-[84px] rounded-2xl bg-panel px-4 py-3 text-center">
              <div className="font-display text-3xl leading-none">{v}</div>
              <div className="mt-1 text-xs text-mute uppercase">{k}</div>
            </div>
          ))}
        </div>
      </div>

      {!round && <Setup mode={mode} setMode={setMode} cat={cat} setCat={setCat} pickA={pickA} pickB={pickB} setPick={setPick} onDeal={deal} busy={busy} />}

      {round && (
        <Panel className="p-5 md:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-mute">
            <Chip tone="flat">{ARENAS[round.task.arena]}</Chip>
            <span>same task, same rules for both</span>
          </div>
          <Md text={round.task.text} className="text-xl font-semibold md:text-2xl" />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Answer slot="A" round={round} reveal={reveal} call={call} spotPick={spotPick} />
            <Answer slot="B" round={round} reveal={reveal} call={call} spotPick={spotPick} />
          </div>

          {!reveal && (
            <div className="mt-6 space-y-4">
              <div>
                <p className="font-semibold">Who wins?</p>
                <p className="mb-3 text-sm text-mute">
                  {round.task.checked
                    ? round.task.arena === 4
                      ? "A right answer beats a wrong one. Both right: the cheaper one wins."
                      : "A right answer beats a wrong one. Both right: the faster one wins."
                    : "kimi judges it blind, in both orders. If it changes its mind when the order flips, it is a draw."}
                </p>
                <div className="grid max-w-md grid-cols-3 gap-2">
                  {(["A", "draw", "B"] as const).map((c) => (
                    <button key={c} onClick={() => setCall(c)} disabled={busy} className={`h-12 min-w-0 rounded-full px-3 font-bold transition ${call === c ? "bg-[#8b5cf6] text-white" : "bg-panel-2 text-ink hover:bg-panel-2/70"}`}>
                      {c === "draw" ? "Draw" : `${c} wins`}
                    </button>
                  ))}
                </div>
              </div>
              {round.spot && (
                <div>
                  <p className="mb-2 font-semibold">
                    Bonus: which one is <span className="text-gold">{displayName(round.spot.name)}</span>?
                  </p>
                  <div className="flex gap-2">
                    {(["A", "B"] as const).map((s) => (
                      <button key={s} onClick={() => setSpotPick(spotPick === s ? null : s)} disabled={busy} className={`h-11 min-w-[90px] rounded-full px-5 font-bold transition ${spotPick === s ? "bg-gold text-bg" : "bg-panel-2 text-ink hover:bg-panel-2/70"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Btn size="lg" onClick={lockIn} disabled={!call || busy}>
                  {judging ? "kimi is judging…" : call ? "Lock in and reveal" : "Make your call"}
                </Btn>
                <button onClick={() => setRound(null)} disabled={busy} className="text-sm text-mute hover:text-ink">
                  change setup
                </button>
              </div>
            </div>
          )}

          {reveal && (
            <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-panel-2 p-5 md:flex-row md:items-center">
              <Mon mood={reveal.calledWinner ? "happy" : "sad"} px={5} paws="none" className="h-20 w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">
                  {reveal.calledWinner ? "You called it." : "Not this time."}
                  {reveal.calledModel === true && <span className="text-gold"> And you spotted {displayName(round.spot!.name)}.</span>}
                  {reveal.calledModel === false && (
                    <span className="text-mute">
                      {" "}
                      {displayName(round.spot!.name)} was {reveal.A.model.id === round.spot!.id ? "A" : "B"}, not {spotPick}.
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-mute">{verdictLine}</p>
                {reveal.task.answer !== undefined && (
                  <p className="mt-1 text-sm text-mute">
                    right answer: <span className="text-ink">{Array.isArray(reveal.task.answer) ? reveal.task.answer[0] : reveal.task.answer}</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Btn onClick={deal} disabled={busy}>
                  <Ico name="refresh" className="h-4 w-4" />
                  Next round
                </Btn>
                {score.best > 0 && (
                  <Btn kind="ghost" onClick={share}>
                    {copied ? "Copied" : `Share best streak ${score.best}`}
                  </Btn>
                )}
              </div>
            </div>
          )}
        </Panel>
      )}

      {err && <p className="rounded-2xl bg-down-bg px-4 py-3 text-sm text-down">{err}</p>}

      <Panel className="flex flex-col items-start justify-between gap-3 p-5 md:flex-row md:items-center">
        <p className="text-mute">
          Arena is free practice. In a real match you stake MON, pick model cards blind and the last round is a live duel.
        </p>
        {standalone ? (
          <Btn onClick={() => setLogin(true)}>Play a real match</Btn>
        ) : (
          <Link to="/play">
            <Btn>Play a real match</Btn>
          </Link>
        )}
      </Panel>
    </div>
  );

  if (!standalone) return body;
  return (
    <div className="min-h-svh bg-app">
      <header className="mx-auto flex h-24 max-w-[1280px] items-center justify-between px-5 md:px-10">
        <Link to="/" aria-label="benchmon home">
          <Logo className="h-12 w-12" />
        </Link>
        <button onClick={() => setLogin(true)} className="h-12 rounded-full bg-neon px-6 text-sm font-extrabold tracking-wide text-bg uppercase transition hover:bg-neon-hi">
          Log in
        </button>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 pb-24 md:px-10">{body}</main>
      {login && <LoginDialog onClose={() => setLogin(false)} />}
    </div>
  );
}

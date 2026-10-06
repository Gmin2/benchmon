import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { arenaMeta, askOwnKey, askQuota, askServer, dealRound, loadKey, loadScore, revealAsk, revealRound, saveKey, saveScore, scoreRound, type ArenaModel, type Call, type MetaModel, type Quota, type Reveal, type Round, type Score, type Slot } from "../arena";
import { roster } from "../hooks";
import { ARENAS } from "../rules";
import { Logo } from "../ui/brand";
import { Btn, Chip, Ico, Panel } from "../ui/kit";
import { Md } from "../ui/Md";
import { Mon } from "../ui/Mon";
import { artOf, displayName, infoOf, tierOf } from "../ui/meta";
import { LoginDialog } from "./landing/LoginDialog";

type Mode = "blind" | "pick" | "ask";
type Guess = { winner?: Call; model?: number; slot?: Slot };
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

function Setup({ mode, setMode, cat, setCat, pickA, pickB, setPick, onDeal, busy, question, setQuestion, askPick, setAskPick, quota, ownKey, setOwnKey }: {
  question: string;
  setQuestion: (q: string) => void;
  askPick: boolean;
  setAskPick: (v: boolean) => void;
  quota: Quota | null;
  ownKey: string;
  setOwnKey: (k: string) => void;
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
  const [keyOpen, setKeyOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const showGrid = mode === "pick" || (mode === "ask" && askPick);
  const pairOk = pickA !== null && pickB !== null;
  const outOfFree = mode === "ask" && !ownKey && quota !== null && (quota.left === 0 || !quota.open);
  const ready = mode === "blind" || (mode === "pick" && pairOk) || (mode === "ask" && question.trim().length >= 3 && (!askPick || pairOk) && !outOfFree);
  const label = busy ? (mode === "ask" ? "Both models are answering live…" : "Dealing…") : mode === "ask" ? (outOfFree ? "Add your key to keep asking" : askPick && !pairOk ? "Pick two models" : "Ask both models") : mode === "pick" && !pairOk ? "Pick two models" : "Deal a round";
  return (
    <Panel className="p-5 md:p-7">
      <div className="flex flex-wrap items-center gap-2">
        {(["blind", "pick", "ask"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`h-11 rounded-full px-5 text-sm font-bold transition ${mode === m ? "bg-neon text-bg" : "bg-panel-2 text-mute hover:text-ink"}`}>
            {m === "blind" ? "Blind round" : m === "pick" ? "Pick two models" : "Ask your own"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-mute">
        {mode === "blind"
          ? "Two random models answer the same task. You call the winner before kimi does, then spot which one is which."
          : mode === "pick"
            ? "Choose two models and call which answer kimi will prefer."
            : "Write any question. Two models answer it live, kimi judges blind, you call it first."}
      </p>

      {mode === "ask" && (
        <div className="mt-5 space-y-4">
          <div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="e.g. Explain recursion to a five year old in two sentences."
              className="w-full resize-none rounded-2xl border border-line bg-panel-2 p-4 text-[15px] outline-none placeholder:text-dim focus:border-neon/50"
            />
            <div className="mt-1 flex justify-between text-xs text-dim">
              <span>{ownKey ? "on your openrouter key, no limit" : quota ? (quota.open ? `${quota.left} of ${quota.limit} free live questions left today` : "free live questions are paused for today") : "checking your free questions…"}</span>
              <span>{question.length}/500</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[false, true].map((v) => (
              <button key={String(v)} onClick={() => setAskPick(v)} className={`h-9 rounded-full border px-4 text-sm transition ${askPick === v ? "border-neon/60 bg-neon/10 text-neon" : "border-line text-mute hover:text-ink"}`}>
                {v ? "I pick the two models" : "Two random models, blind"}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-line p-4">
            {ownKey ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-mute">
                  Using your OpenRouter key <span className="font-mono text-ink">…{ownKey.slice(-4)}</span>. It stays in this browser and goes only to OpenRouter.
                </span>
                <button
                  onClick={() => {
                    setOwnKey("");
                    setDraft("");
                    setKeyOpen(false);
                  }}
                  className="text-down hover:underline"
                >
                  remove key
                </button>
              </div>
            ) : keyOpen ? (
              <div className="space-y-2">
                <p className="text-sm text-mute">Your key stays in this browser. The questions go straight from here to OpenRouter, benchmon never sees the key.</p>
                <div className="flex gap-2">
                  <input type="password" value={draft} onChange={(e) => setDraft(e.target.value.trim())} placeholder="sk-or-…" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-2 px-3 font-mono text-sm outline-none focus:border-neon/50" />
                  <Btn onClick={() => draft.startsWith("sk-") && setOwnKey(draft)} disabled={!draft.startsWith("sk-")}>
                    Use key
                  </Btn>
                </div>
              </div>
            ) : (
              <button onClick={() => setKeyOpen(true)} className="text-sm text-mute hover:text-ink">
                {outOfFree ? "Out of free questions today. " : ""}
                <span className="text-neon underline-offset-2 hover:underline">Use my own OpenRouter key</span> for unlimited questions
              </button>
            )}
          </div>
        </div>
      )}

      {mode !== "ask" && <div className="mt-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`h-9 rounded-full border px-4 text-sm capitalize transition ${cat === c ? "border-neon/60 bg-neon/10 text-neon" : "border-line text-mute hover:text-ink"}`}>
            {c}
          </button>
        ))}
      </div>}

      {showGrid && (
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
        {/* out of free questions: the button opens the key box instead of sitting disabled */}
        <Btn size="lg" onClick={outOfFree ? () => setKeyOpen(true) : onDeal} disabled={outOfFree ? false : !ready || busy}>
          {label}
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
  const [question, setQuestion] = useState("");
  const [askPick, setAskPick] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [ownKey, setOwnKeyState] = useState(loadKey);
  const [meta, setMeta] = useState<MetaModel[]>([]);
  // how this round gets revealed: the bank, our key on the server, or the player's key in this browser
  const [revealer, setRevealer] = useState<{ run: (g: Guess) => Promise<Reveal> } | null>(null);

  useEffect(() => saveScore(score), [score]);
  const setOwnKey = (k: string) => {
    saveKey(k);
    setOwnKeyState(k);
  };
  useEffect(() => {
    if (mode !== "ask") return;
    askQuota().then(setQuota).catch(() => setQuota(null));
    if (!meta.length) arenaMeta().then((m) => setMeta(m.models as MetaModel[])).catch(() => {});
  }, [mode, meta.length]);

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
      if (mode === "ask") {
        const q = { prompt: question.trim(), ...(askPick && pickA !== null && pickB !== null ? { a: pickA, b: pickB } : {}) };
        if (ownKey) {
          const models = meta.length ? meta : ((await arenaMeta()).models as MetaModel[]);
          const r = await askOwnKey(ownKey, models, q);
          setRevealer({ run: r.reveal });
          setRound(r.round);
        } else {
          const r = await askServer(q);
          setRevealer({ run: (g) => revealAsk(r.id!, g) });
          if (r.quota) setQuota(r.quota);
          setRound(r);
        }
        return;
      }
      const arena = cat === "any" ? undefined : ARENAS.indexOf(cat);
      const q = mode === "pick" && pickA !== null && pickB !== null ? { arena, a: pickA, b: pickB } : { arena };
      const r = await dealRound(q);
      setRevealer({ run: (g) => revealRound(r.token, g) });
      setRound(r);
    } catch (e) {
      if (mode === "ask" && !ownKey) askQuota().then(setQuota).catch(() => {});
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function lockIn() {
    if (!round || !call || !revealer) return;
    setBusy(true);
    setErr("");
    try {
      const r = await revealer.run({ winner: call, ...(round.spot && spotPick ? { model: round.spot.id, slot: spotPick } : {}) });
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

      {!round && <Setup mode={mode} setMode={setMode} cat={cat} setCat={setCat} pickA={pickA} pickB={pickB} setPick={setPick} onDeal={deal} busy={busy} question={question} setQuestion={setQuestion} askPick={askPick} setAskPick={setAskPick} quota={quota} ownKey={ownKey} setOwnKey={setOwnKey} />}

      {round && (
        <Panel className="p-5 md:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-mute">
            <Chip tone="flat">{round.task.arena < 0 ? "your question" : ARENAS[round.task.arena]}</Chip>
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
                <Btn onClick={() => (mode === "ask" ? (setRound(null), setReveal(null), setCall(null), setSpotPick(null)) : deal())} disabled={busy}>
                  <Ico name="refresh" className="h-4 w-4" />
                  {mode === "ask" ? "Ask another" : "Next round"}
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

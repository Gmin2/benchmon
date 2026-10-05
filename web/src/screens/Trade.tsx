import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatEther, parseEther } from "viem";
import { backingAbi, matchMarketAbi } from "../abi";
import { CONTRACTS, type Card } from "../chain";
import { deckOf, roster, short, useBalance, useCards, usePoll } from "../hooks";
import { backedOf, cents, loadHistory, loadMarkets, recentIds, mon, poolPayout, priceAfter, pushSample, quote, redeemableOf, sharesFor, sharesOf, type MarketRow, type Sample } from "../market";
import { useProfiles } from "../profile";
import { useWallet } from "../useWallet";
import { AreaChart } from "../ui/chart";
import { Btn, Chip, Empty, Ico, Panel, Seg } from "../ui/kit";
import { artOf, infoOf, tierOf } from "../ui/meta";
import { MatchStage } from "./MatchStage";

const RANGES = ["all", "1h", "10m"] as const;
type Range = (typeof RANGES)[number];
const ZERO = "0x0000000000000000000000000000000000000000";
const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const QUICK = ["0.005", "0.01", "0.02", "0.05"];

function Sprite({ card, className = "" }: { card: Card; className?: string }) {
  const i = infoOf(card);
  return <img src={artOf(card.name, tierOf(i))} alt={i.display} className={`pixel object-contain ${className}`} draggable={false} />;
}

// a deck as overlapping pixel heads, strongest first
function DeckStack({ deck, size = "h-10 w-10" }: { deck: Card[]; size?: string }) {
  const sorted = [...deck].sort((a, b) => infoOf(b).power - infoOf(a).power);
  return (
    <div className="flex -space-x-3">
      {sorted.map((c) => (
        <span key={c.id} className={`grid place-items-center overflow-hidden rounded-full border-2 border-panel bg-panel-2 ${size}`} title={infoOf(c).display}>
          <Sprite card={c} className="h-[150%] w-[150%] translate-y-[12%]" />
        </span>
      ))}
    </div>
  );
}

const top = (deck: Card[]) => [...deck].sort((a, b) => infoOf(b).power - infoOf(a).power)[0];

function status(m: MarketRow): { label: string; tone: "up" | "down" | "flat" | "gold" | "violet" } {
  if (m.match.state === 2) return { label: m.match.b === ZERO ? "Cancelled" : "Settled", tone: "flat" };
  if (m.betting) return { label: m.open ? "Bets open" : "Pool open", tone: "up" };
  if (m.match.awaitingVerdict) return { label: "Live duel", tone: "violet" };
  return { label: "In play", tone: "gold" };
}

function TokenBadge({ children }: { children: React.ReactNode }) {
  return <span className="flex h-12 shrink-0 items-center gap-2.5 rounded-2xl border border-line bg-panel px-2.5 pr-3.5">{children}</span>;
}

export function Trade() {
  const live = useCards();
  const cards = live.length ? live : roster();
  const { address, write, ready } = useWallet();
  const balance = useBalance(address);
  const [params] = useSearchParams();
  const [pick, setPick] = useState<bigint | null>(() => (/^\d+$/.test(params.get("m") ?? "") ? BigInt(params.get("m")!) : null));
  // the list refreshes slowly, the match on screen quickly. the indexer picks the ids, the chain has the market
  const { data: listed, err } = usePoll(async () => loadMarkets(await recentIds(12)), 10000, []);
  const { data: sel } = usePoll(async () => (pick === null ? [] : loadMarkets([pick])), 3000, [pick]);
  const fresh = sel?.[0]?.id === pick ? sel?.[0] : undefined;
  const markets = useMemo(() => {
    const rows = (listed ?? []).map((x) => (fresh && x.id === fresh.id ? fresh : x));
    return fresh && !rows.some((x) => x.id === fresh.id) ? [fresh, ...rows] : rows;
  }, [listed, fresh]);
  // backing a side is the simple bet, so it is what people see first
  const [mode, setMode] = useState<"buy" | "sell" | "pool">("pool");
  const [side, setSide] = useState<1 | 2>(1);
  const [amount, setAmount] = useState("0.01");
  const [range, setRange] = useState<Range>("all");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<Sample[]>([]);

  // a match you can still bet on first, then one with a market
  const m = markets.find((x) => x.id === pick) ?? markets.find((x) => x.betting) ?? markets.find((x) => x.open) ?? markets[0];
  useEffect(() => {
    if (m && pick === null) setPick(m.id);
  }, [m, pick]);
  const nameOf = useProfiles(markets.flatMap((x) => [x.match.a, x.match.b]));
  const name = (a: string) => {
    const p = nameOf(a);
    return p ? `@${p.username}` : short(a);
  };

  useEffect(() => {
    if (!m?.open) return setHistory([]);
    setHistory(pushSample(m.id, m.priceA));
  }, [m?.id, m?.priceA, m?.open]);
  useEffect(() => {
    if (m) setHistory(loadHistory(m.id));
  }, [m?.id]);

  const { data: mine } = usePoll(async () => (m && address ? { ...(await sharesOf(m.id, address)), redeem: await redeemableOf(m.id, address) } : null), 5000, [m?.id, address]);
  const { data: pool } = usePoll(async () => (m && address ? backedOf(m.id, address) : null), 5000, [m?.id, address]);

  const deckA = m ? deckOf(m.match.deckA, cards) : [];
  const deckB = m ? deckOf(m.match.deckB, cards) : [];
  const sideDeck = side === 1 ? deckA : deckB;
  const sideTop = top(sideDeck);
  const sidePrice = m ? (side === 1 ? m.priceA : 1 - m.priceA) : 0.5;
  const n = Math.max(0, Number(amount) || 0);
  const held = mine ? (side === 1 ? mine.a : mine.b) : 0;

  // buy: you pay n MON and get shares. sell: you pay n shares and get MON
  const shares = m && mode === "buy" ? sharesFor(m, side, n / 1.01) : n;
  const payout = m && mode === "sell" ? quote(m, side, n, true) : 0;
  const after = m?.open ? priceAfter(m, side, shares, mode === "sell") : 0.5;
  const afterSide = side === 1 ? after : 1 - after;
  const avg = mode === "buy" ? (shares > 0 ? n / shares : 0) : n > 0 ? payout / n : 0;

  const chartData = useMemo(() => {
    const now = Date.now();
    const cut = range === "1h" ? now - 3600_000 : range === "10m" ? now - 600_000 : 0;
    const pts = history.filter((p) => p.t >= cut).map((p) => ({ t: p.t, v: side === 1 ? p.v : 1 - p.v }));
    if (m?.open && pts.length) pts.push({ t: now, v: sidePrice });
    return pts;
  }, [history, range, side, sidePrice, m?.open]);
  const change = sidePrice - 0.5;

  const run = async (label: string, f: () => Promise<unknown>, done: string) => {
    setNote("");
    setBusy(label);
    try {
      await f();
      setNote(done);
    } catch (e) {
      setNote((e as Error).message.split("\n")[0]!);
    }
    setBusy("");
  };
  const submit = () => {
    if (!m) return;
    if (mode === "buy")
      return run(
        "buying",
        // the shares are quoted a percent under what you pay, the contract refunds whatever the trade did not use
        () => write({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "buy", args: [m.id, side, parseEther(shares.toFixed(18))], value: parseEther(n.toString()), gas: 250_000n }),
        `bought ${shares.toFixed(4)} side ${side === 1 ? "A" : "B"} shares`,
      );
    return run("selling", () => write({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "sell", args: [m.id, side, parseEther(n.toString())], gas: 250_000n }), `sold ${n} side ${side === 1 ? "A" : "B"} shares`);
  };
  const backSide = () => m && run("backing", () => write({ address: CONTRACTS.backing, abi: backingAbi, functionName: "back", args: [m.id, side], value: parseEther(n.toString()), gas: 100_000n }), `backed side ${side === 1 ? "A" : "B"} with ${n} MON`);
  const claimPool = () => m && run("claiming", () => write({ address: CONTRACTS.backing, abi: backingAbi, functionName: "claim", args: [m.id], gas: 90_000n }), "claimed");
  const redeem = () => m && run("redeeming", () => write({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "redeem", args: [m.id], gas: 150_000n }), "redeemed");

  const cantPool = !m?.betting ? "bets are closed for this match" : !ready ? "account is getting ready" : n <= 0 ? "enter an amount" : n > balance ? "not enough MON" : "";
  const cantTrade = !m?.open
    ? "no market on this match, use the pool"
    : !m.trading
      ? "trading is closed for this match"
      : !ready
        ? "account is getting ready"
        : n <= 0
          ? "enter an amount"
          : mode === "buy" && n > balance
            ? "not enough MON"
            : mode === "sell" && n > held
              ? "you do not hold that many"
              : "";

  const sideBadge = (
    <button onClick={() => setSide(side === 1 ? 2 : 1)} title="switch side" className="flex h-12 shrink-0 items-center gap-2.5 rounded-2xl border border-line bg-panel px-2.5 pr-3 transition hover:bg-raised">
      <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-neon/15">{sideTop && <Sprite card={sideTop} className="h-[150%] w-[150%] translate-y-[12%]" />}</span>
      <span className="text-left leading-tight">
        <span className="block font-semibold">Side {side === 1 ? "A" : "B"}</span>
        <span className="block text-[11px] text-mute">{sideTop ? infoOf(sideTop).display : "deck"}</span>
      </span>
      <Ico name="chevron-down" className="h-4 w-4 text-mute" />
    </button>
  );
  const monBadge = (
    <TokenBadge>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#836ef9] font-bold text-white">M</span>
      <span className="font-semibold">MON</span>
    </TokenBadge>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
      {/* left: the match is the show, the price and the other matches sit under it */}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-2xl font-bold">
            <select value={m ? m.id.toString() : ""} onChange={(e) => setPick(BigInt(e.target.value))} className="cursor-pointer appearance-none bg-transparent pr-1 outline-none" aria-label="match">
              {markets.map((x) => (
                <option key={x.id.toString()} value={x.id.toString()} className="bg-panel text-base">
                  Match #{x.id.toString()}
                </option>
              ))}
            </select>
            <Ico name="chevron-down" className="h-5 w-5 text-mute" />
          </label>
          {m && (
            <span className="text-sm text-mute">
              {name(m.match.a)} vs {m.match.b === ZERO ? "open seat" : name(m.match.b)} · {formatEther(m.match.stake * 2n)} MON pot
            </span>
          )}
          {m &&
            (m.betting ? (
              <span className="ml-auto flex items-center gap-2 rounded-full bg-neon/10 px-3 py-1.5 text-sm font-semibold text-neon">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-neon" />
                </span>
                {m.match.b === ZERO ? "bets open, waiting for a player" : m.match.commitA !== ZERO32 && m.match.commitB !== ZERO32 ? "bets close any second" : "bets open until the first reveal"}
              </span>
            ) : (
              <span className="ml-auto">
                <Chip tone={status(m).tone}>{status(m).label}</Chip>
              </span>
            ))}
        </div>

        {m ? (
          <MatchStage id={m.id} match={m.match} cards={cards} />
        ) : listed && !err ? (
          <Empty className="h-[420px]" title="No matches yet" body="once a match is opened from Play it shows up here, and you can back a side before the first reveal." />
        ) : (
          <Panel className="grid h-[420px] place-items-center text-mute">{err ? `retrying: ${err}` : "loading matches"}</Panel>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Panel className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm text-mute">side {side === 1 ? "A" : "B"} price · what the crowd thinks</div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-[34px] leading-none font-bold tracking-tight">{m?.open ? cents(sidePrice) : "—"}</span>
                  {m?.open && (
                    <Chip tone={change >= 0 ? "up" : "down"}>
                      {change >= 0 ? "+" : ""}
                      {(change * 100).toFixed(1)}¢
                    </Chip>
                  )}
                </div>
              </div>
              <Seg value={range} options={RANGES} onChange={setRange} />
            </div>
            <div className="mt-3">
              {m?.open ? (
                <AreaChart data={chartData} format={cents} height={210} />
              ) : (
                <div className="grid h-[210px] place-items-center rounded-2xl border border-dashed border-line text-sm text-mute">{m?.betting ? "no market on this match yet, back a side instead" : "no market on this match"}</div>
              )}
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="text-lg font-bold">Matches</h2>
            <div className="mt-3 flex max-h-[290px] flex-col gap-1.5 overflow-y-auto">
              {listed && !markets.length && <p className="px-3 py-2.5 text-sm text-mute">no matches yet.</p>}
              {markets.map((x) => {
                const s = status(x);
                const on = x.id === m?.id;
                return (
                  <button key={x.id.toString()} onClick={() => setPick(x.id)} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-panel-2 ${on ? "bg-panel-2" : ""}`}>
                    <DeckStack deck={deckOf(x.match.deckA, cards).slice(0, 2)} size="h-8 w-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">Match #{x.id.toString()}</span>
                      <span className="block truncate text-xs text-mute">
                        {name(x.match.a)} vs {x.match.b === ZERO ? "open seat" : name(x.match.b)}
                      </span>
                    </span>
                    <Chip tone={s.tone}>{s.label}</Chip>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* right: the bet */}
      <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <h2 className="text-2xl font-bold">Bet on this match</h2>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-panel p-1">
          {([
            ["pool", "Back a side"],
            ["buy", "Trade shares"],
          ] as const).map(([k, label]) => {
            const on = k === "pool" ? mode === "pool" : mode !== "pool";
            return (
              <button key={k} onClick={() => setMode(k === "pool" ? "pool" : "buy")} className={`h-11 rounded-full text-sm font-bold transition ${on ? "bg-neon text-bg" : "text-mute hover:text-ink"}`}>
                {label}
              </button>
            );
          })}
        </div>
        {mode !== "pool" && (
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-full bg-panel p-1">
              {(["buy", "sell"] as const).map((k) => (
                <button key={k} onClick={() => setMode(k)} className={`h-8 rounded-full px-4 text-xs font-bold uppercase transition ${mode === k ? "bg-raised text-ink" : "text-dim hover:text-mute"}`}>
                  {k}
                </button>
              ))}
            </div>
            <span className="text-xs text-dim">shares pay 1 MON if their side wins, sell any time before the first reveal</span>
          </div>
        )}

        {mode !== "pool" ? (
          <>
            <div className="relative flex flex-col gap-2">
              <Panel className="p-5">
                <div className="flex items-center justify-between gap-2 text-sm text-mute">
                  <span>You pay</span>
                  <span className="flex gap-1.5">
                    {mode === "buy" &&
                      QUICK.map((v) => (
                        <button key={v} onClick={() => setAmount(v)} className={`h-7 rounded-full px-2.5 text-xs font-semibold ${amount === v ? "bg-neon text-bg" : "bg-panel-2 text-mute hover:text-ink"}`}>
                          {v}
                        </button>
                      ))}
                    <button className="h-7 rounded-full bg-panel-2 px-2.5 text-xs font-semibold text-neon" onClick={() => setAmount(mode === "buy" ? Math.max(0, balance - 0.001).toFixed(4) : held.toFixed(4))}>
                      max
                    </button>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="amount" className="w-full min-w-0 bg-transparent text-[38px] leading-none font-bold outline-none" />
                  {mode === "buy" ? monBadge : sideBadge}
                </div>
                <div className="mt-2 text-right text-xs text-dim">{mode === "buy" ? `balance ${balance.toFixed(4)} MON` : `you hold ${held.toFixed(4)} shares`}</div>
              </Panel>

              <button
                onClick={() => {
                  setMode(mode === "buy" ? "sell" : "buy");
                  setAmount(mode === "buy" ? (held > 0 ? held.toFixed(4) : "1") : "0.01");
                }}
                aria-label="flip buy and sell"
                className="absolute top-1/2 left-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-app bg-panel-2 text-neon hover:bg-raised"
              >
                <Ico name="repeat-2" className="h-4 w-4 rotate-90" />
              </button>

              <Panel className="p-5">
                <div className="flex items-center justify-between text-sm text-mute">
                  <span>You get</span>
                  <span>{mode === "buy" ? `pays 1 MON a share if side ${side === 1 ? "A" : "B"} wins` : "back to your balance"}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="w-full min-w-0 truncate text-[38px] leading-none font-bold">{mode === "buy" ? shares.toFixed(4) : payout.toFixed(4)}</span>
                  {mode === "buy" ? sideBadge : monBadge}
                </div>
              </Panel>
            </div>

            <Panel className="grid grid-cols-3 gap-3 p-5 text-sm">
              <div>
                <div className="text-dim">Avg price</div>
                <div className="mt-1 text-lg font-medium">{avg > 0 ? cents(avg) : "—"}</div>
              </div>
              <div>
                <div className="text-dim">Price after</div>
                <div className="mt-1 text-lg font-medium">{m?.open ? cents(afterSide) : "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-dim">{mode === "buy" ? "If it wins" : "Now"}</div>
                <div className="mt-1 text-lg font-medium text-neon">{mode === "buy" ? (shares > 0 ? mon(shares, 3) : "—") : cents(sidePrice)}</div>
              </div>
            </Panel>

            <Btn size="lg" disabled={Boolean(cantTrade) || Boolean(busy)} onClick={submit} className="w-full">
              {busy ? `${busy}…` : cantTrade || (mode === "buy" ? `Buy side ${side === 1 ? "A" : "B"}` : `Sell side ${side === 1 ? "A" : "B"}`)}
            </Btn>
          </>
        ) : (
          m && (
            <>
              <Panel className="p-5">
                <p className="text-sm text-mute">Back a side. When the match ends the winning side splits the whole pool. A draw refunds everyone.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {([1, 2] as const).map((k) => {
                    const backedSide = k === 1 ? m.poolA : m.poolB;
                    const total = m.poolA + m.poolB;
                    const t = top(k === 1 ? deckA : deckB);
                    return (
                      <button key={k} onClick={() => setSide(k)} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition ${side === k ? "border-neon bg-neon/10" : "border-line bg-panel-2 hover:bg-raised"}`}>
                        <span className="flex items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-neon/15">{t && <Sprite card={t} className="h-[150%] w-[150%] translate-y-[12%]" />}</span>
                          <span className="text-lg font-semibold">Side {k === 1 ? "A" : "B"}</span>
                        </span>
                        <span className="text-sm text-mute">{mon(backedSide, 3)} backed</span>
                        <span className="text-xs text-dim">{total > 0 ? `${Math.round((backedSide / total) * 100)}% of the pool` : "no one yet"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <label className="min-w-0 flex-1">
                    <span className="text-sm text-dim">You put in</span>
                    <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="MON to back" className="mt-1 block w-full min-w-0 bg-transparent text-[38px] leading-none font-bold outline-none" />
                  </label>
                  <span className="shrink-0 text-right text-sm text-dim">
                    If side {side === 1 ? "A" : "B"} wins
                    <span className="mt-1 block text-lg font-medium text-neon">{mon(poolPayout(side === 1 ? m.poolA : m.poolB, side === 1 ? m.poolB : m.poolA, n), 4)}</span>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK.map((v) => (
                    <button key={v} onClick={() => setAmount(v)} className={`h-8 rounded-full px-3 text-xs font-semibold ${amount === v ? "bg-neon text-bg" : "bg-panel-2 text-mute hover:text-ink"}`}>
                      {v}
                    </button>
                  ))}
                  <span className="ml-auto self-center text-sm text-dim">balance {balance.toFixed(3)}</span>
                </div>
              </Panel>
              <Btn size="lg" disabled={Boolean(cantPool) || Boolean(busy)} onClick={backSide} className="w-full">
                {busy ? `${busy}…` : cantPool || `Back side ${side === 1 ? "A" : "B"} with ${n} MON`}
              </Btn>
            </>
          )
        )}

        {mine && mine.redeem > 0 && (
          <Btn kind="ghost" size="lg" className="w-full" onClick={redeem} disabled={Boolean(busy)}>
            Redeem {mon(mine.redeem)} from the market
            <Ico name="check" className="h-5 w-5" />
          </Btn>
        )}
        {pool && pool.claim > 0 && (
          <Btn kind="ghost" size="lg" className="w-full" onClick={claimPool} disabled={Boolean(busy)}>
            Claim {mon(pool.claim)} from the pool
            <Ico name="check" className="h-5 w-5" />
          </Btn>
        )}
        {note && <p className="px-2 text-sm text-mute">{note}</p>}

        <Panel className="flex items-center justify-between p-5">
          <div>
            <div className="text-sm text-dim">Your position</div>
            <div className="mt-1 text-lg font-bold">
              {(mine?.a ?? 0).toFixed(2)} A · {(mine?.b ?? 0).toFixed(2)} B
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-dim">In the pool</div>
            <div className="mt-1 text-lg font-bold">{((pool?.a ?? 0) + (pool?.b ?? 0)).toFixed(3)} MON</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

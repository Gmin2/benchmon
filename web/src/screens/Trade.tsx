import { useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";
import { matchMarketAbi } from "../abi";
import { CONTRACTS, type Card } from "../chain";
import { deckOf, short, useBalance, useCards, usePoll } from "../hooks";
import { cents, loadHistory, loadMarkets, mon, priceAfter, pushSample, quote, redeemableOf, sharesOf, type MarketRow, type Sample } from "../market";
import { useWallet } from "../useWallet";
import { AreaChart } from "../ui/chart";
import { Btn, Chip, Ico, IconBtn, Panel, SearchBar, Seg } from "../ui/kit";
import { artOf, infoOf, tierOf } from "../ui/meta";

const RANGES = ["all", "1h", "10m"] as const;
type Range = (typeof RANGES)[number];

function Sprite({ card, className = "" }: { card: Card; className?: string }) {
  const i = infoOf(card);
  return <img src={artOf(card.name, tierOf(i))} alt={i.display} className={`pixel object-contain ${className}`} draggable={false} />;
}

// a deck as five overlapping pixel heads, strongest first
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

function status(m: MarketRow): { label: string; tone: "up" | "down" | "flat" | "gold" | "violet" } {
  if (!m.open) return { label: "No market", tone: "flat" };
  if (m.match.state === 2) return { label: "Settled", tone: "flat" };
  if (m.trading) return { label: "Trading", tone: "up" };
  if (m.match.awaitingVerdict) return { label: "Live duel", tone: "violet" };
  return { label: "In play", tone: "gold" };
}

function SidePill({ side, deck, onClick }: { side: 1 | 2; deck: Card[]; onClick?: () => void }) {
  const top = [...deck].sort((a, b) => infoOf(b).power - infoOf(a).power)[0];
  return (
    <button onClick={onClick} className="flex h-16 items-center gap-3 rounded-2xl border border-line bg-panel px-3 pr-4 transition hover:bg-raised">
      <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-neon/15">{top && <Sprite card={top} className="h-[150%] w-[150%] translate-y-[12%]" />}</span>
      <span className="text-left">
        <span className="block text-lg leading-tight font-semibold">Side {side === 1 ? "A" : "B"}</span>
        <span className="block text-xs text-mute">{top ? infoOf(top).display : "deck"}</span>
      </span>
      <Ico name="chevron-down" className="ml-1 h-4 w-4 text-mute" />
    </button>
  );
}

export function Trade() {
  const cards = useCards();
  const { address, write, ready } = useWallet();
  const balance = useBalance(address);
  const { data: markets = [], err } = usePoll(() => loadMarkets(12), 5000, []);
  const [pick, setPick] = useState<bigint | null>(null);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<1 | 2>(1);
  const [amount, setAmount] = useState("1");
  const [range, setRange] = useState<Range>("all");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<Sample[]>([]);

  const withMarket = markets.filter((m) => m.open);
  const m = markets.find((x) => x.id === pick) ?? withMarket[0] ?? markets[0];
  useEffect(() => {
    if (m && pick === null) setPick(m.id);
  }, [m, pick]);

  // every poll adds the live price to this browser's history for the market
  useEffect(() => {
    if (!m?.open) return setHistory([]);
    setHistory(pushSample(m.id, m.priceA));
  }, [m?.id, m?.priceA, m?.open]);
  useEffect(() => {
    if (m) setHistory(loadHistory(m.id));
  }, [m?.id]);

  const { data: mine } = usePoll(async () => (m && address ? { ...(await sharesOf(m.id, address)), redeem: await redeemableOf(m.id, address) } : null), 5000, [m?.id, address]);

  const deckA = m ? deckOf(m.match.deckA, cards) : [];
  const deckB = m ? deckOf(m.match.deckB, cards) : [];
  const sidePrice = m ? (side === 1 ? m.priceA : 1 - m.priceA) : 0.5;
  const n = Math.max(0, Number(amount) || 0);
  const cost = m ? quote(m, side, n, mode === "sell") : 0;
  const after = m?.open ? priceAfter(m, side, n, mode === "sell") : 0.5;
  const afterSide = side === 1 ? after : 1 - after;
  const held = mine ? (side === 1 ? mine.a : mine.b) : 0;

  const chartData = useMemo(() => {
    const now = Date.now();
    const cut = range === "1h" ? now - 3600_000 : range === "10m" ? now - 600_000 : 0;
    const pts = history.filter((p) => p.t >= cut).map((p) => ({ t: p.t, v: side === 1 ? p.v : 1 - p.v }));
    if (m?.open && pts.length) pts.push({ t: now, v: sidePrice });
    return pts;
  }, [history, range, side, sidePrice, m?.open]);
  const opening = 0.5;
  const change = sidePrice - opening;

  const submit = async () => {
    if (!m) return;
    setNote("");
    try {
      const amt = parseEther(n.toString());
      if (mode === "buy") {
        setBusy("backing");
        // pay a little over the quote, the contract refunds whatever the trade did not use
        const value = parseEther((cost * 1.02 + 0.000001).toFixed(18));
        await write({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "buy", args: [m.id, side, amt], value, gas: 250_000n });
        setNote(`bought ${n} side ${side === 1 ? "A" : "B"} shares`);
      } else {
        setBusy("selling");
        await write({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "sell", args: [m.id, side, amt], gas: 250_000n });
        setNote(`sold ${n} side ${side === 1 ? "A" : "B"} shares`);
      }
    } catch (e) {
      setNote((e as Error).message.split("\n")[0]!);
    }
    setBusy("");
  };
  const redeem = async () => {
    if (!m) return;
    setBusy("redeeming");
    try {
      await write({ address: CONTRACTS.market, abi: matchMarketAbi, functionName: "redeem", args: [m.id], gas: 150_000n });
      setNote("redeemed");
    } catch (e) {
      setNote((e as Error).message.split("\n")[0]!);
    }
    setBusy("");
  };

  const cantTrade = !m?.trading ? "trading is closed for this match" : !ready ? "account is getting ready" : n <= 0 ? "enter an amount" : mode === "buy" && cost > balance ? "not enough MON" : mode === "sell" && n > held ? "you do not hold that many" : "";

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_480px]">
      {/* left: market and chart */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-4">
          <SearchBar placeholder="Search matches, models or players" />
          <div className="hidden gap-3 md:flex">
            <IconBtn name="square-activity-chart" label="line chart" active />
            <IconBtn name="layers" label="order book" />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <label className="flex items-center gap-2 text-2xl font-semibold text-mute">
              <select
                value={m ? m.id.toString() : ""}
                onChange={(e) => setPick(BigInt(e.target.value))}
                className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
                aria-label="market"
              >
                {markets.map((x) => (
                  <option key={x.id.toString()} value={x.id.toString()} className="bg-panel text-base">
                    Match #{x.id.toString()} · side {side === 1 ? "A" : "B"}
                  </option>
                ))}
              </select>
              <Ico name="chevron-down" className="h-5 w-5" />
            </label>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-[44px] leading-none font-bold tracking-tight">{m ? cents(sidePrice) : "—"}</span>
              {m?.open && (
                <Chip tone={change >= 0 ? "up" : "down"}>
                  {change >= 0 ? "+" : ""}
                  {(change * 100).toFixed(1)}¢ ({((change / opening) * 100).toFixed(1)}%) since open
                </Chip>
              )}
            </div>
          </div>
          <Seg value={range} options={RANGES} onChange={setRange} />
        </div>

        <div className="mt-6">
          {m?.open ? (
            <AreaChart data={chartData} format={cents} height={380} />
          ) : (
            <div className="grid h-[380px] place-items-center rounded-[var(--radius-panel)] border border-dashed border-line text-mute">
              {markets.length ? "no market was opened for this match yet" : err ? `retrying: ${err}` : "loading markets"}
            </div>
          )}
          {m?.open && history.length < 3 && <p className="mt-2 text-sm text-dim">history fills in as trades land while this page is open. the full record comes from the indexer.</p>}
        </div>

        <Panel className="mt-10 p-6">
          <h2 className="text-2xl font-semibold">Match markets</h2>
          <div className="mt-6 grid grid-cols-[minmax(260px,2.2fr)_repeat(4,minmax(0,1fr))] gap-y-1 text-[15px]">
            {["Match", "Side A", "Side B", "Pool", "Status"].map((h) => (
              <div key={h} className="pb-3 text-mute">
                {h}
              </div>
            ))}
            {markets.map((x) => {
              const s = status(x);
              const on = x.id === m?.id;
              return (
                <button key={x.id.toString()} onClick={() => setPick(x.id)} className={`col-span-5 grid grid-cols-subgrid items-center rounded-2xl py-3 text-left transition hover:bg-panel-2 ${on ? "bg-panel-2" : ""}`}>
                  <span className="flex items-center gap-3 pl-2">
                    <DeckStack deck={deckOf(x.match.deckA, cards).slice(0, 3)} size="h-9 w-9" />
                    <span className="min-w-0">
                      <span className="block font-semibold">Match #{x.id.toString()}</span>
                      <span className="block truncate text-xs whitespace-nowrap text-mute">
                        {short(x.match.a)} vs {x.match.b.startsWith("0x0000") ? "open seat" : short(x.match.b)}
                      </span>
                    </span>
                  </span>
                  <span>{x.open ? cents(x.priceA) : "—"}</span>
                  <span>{x.open ? cents(1 - x.priceA) : "—"}</span>
                  <span>{x.open ? mon(x.pool, 2) : "—"}</span>
                  <span>
                    <Chip tone={s.tone}>{s.label}</Chip>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* right: back or sell a side */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-5 text-3xl font-bold tracking-tight">
            <button onClick={() => setMode("buy")} className={mode === "buy" ? "text-neon" : "text-dim hover:text-mute"}>
              BACK
            </button>
            <button onClick={() => setMode("sell")} className={mode === "sell" ? "text-neon" : "text-dim hover:text-mute"}>
              SELL
            </button>
          </div>
          <div className="flex gap-3">
            <IconBtn name="refresh" label="refresh" onClick={() => setHistory(m ? loadHistory(m.id) : [])} />
            <IconBtn name="gear-3" label="settings" />
          </div>
        </div>

        <div className="relative flex flex-col gap-2">
          <Panel className="p-5">
            <div className="flex items-start justify-between">
              <SidePill side={side} deck={side === 1 ? deckA : deckB} onClick={() => setSide(side === 1 ? 2 : 1)} />
              <span className="text-mute">{mode === "buy" ? "You back" : "You sell"}</span>
            </div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                aria-label="shares"
                className="w-full min-w-0 bg-transparent text-[40px] leading-none font-bold outline-none"
              />
              <span className="shrink-0 text-right text-sm text-dim">
                Shares held
                <span className="mt-1 block text-lg font-medium text-ink">{held.toFixed(2)}</span>
              </span>
            </div>
          </Panel>

          <button
            onClick={() => setSide(side === 1 ? 2 : 1)}
            aria-label="switch side"
            className="absolute top-1/2 left-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-app bg-panel-2 text-neon hover:bg-raised"
          >
            <Ico name="repeat-2" className="h-4 w-4 rotate-90" />
          </button>

          <Panel className="p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-16 items-center gap-3 rounded-2xl border border-line bg-panel px-3 pr-4">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#836ef9] text-lg font-bold text-white">M</span>
                <span className="text-lg font-semibold">MON</span>
              </span>
              <span className="text-mute">{mode === "buy" ? "You pay" : "You get"}</span>
            </div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <span className="truncate text-[40px] leading-none font-bold">{cost.toFixed(4)}</span>
              <span className="shrink-0 text-right text-sm text-dim">
                Balance
                <span className="mt-1 block text-lg font-medium text-ink">{balance.toFixed(4)}</span>
              </span>
            </div>
          </Panel>
        </div>

        <Btn size="lg" disabled={Boolean(cantTrade) || Boolean(busy)} onClick={submit} className="w-full">
          {busy ? `${busy}…` : cantTrade || (mode === "buy" ? `Back side ${side === 1 ? "A" : "B"}` : `Sell side ${side === 1 ? "A" : "B"}`)}
        </Btn>
        {mine && mine.redeem > 0 ? (
          <Btn kind="ghost" size="lg" className="w-full" onClick={redeem} disabled={Boolean(busy)}>
            Redeem {mon(mine.redeem)}
            <Ico name="check" className="h-5 w-5" />
          </Btn>
        ) : (
          <Btn kind="ghost" size="lg" className="w-full" onClick={() => setSide(side === 1 ? 2 : 1)}>
            Switch to side {side === 1 ? "B" : "A"}
            <Ico name="repeat-2" className="h-5 w-5" />
          </Btn>
        )}
        {note && <p className="px-2 text-sm text-mute">{note}</p>}

        <Panel className="p-5">
          <div className="text-sm text-dim">Your position</div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[26px] font-bold">
              {(mine?.a ?? 0).toFixed(2)} A · {(mine?.b ?? 0).toFixed(2)} B
            </span>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-dim">Avg price</div>
              <div className="mt-1 text-lg font-medium">{n > 0 ? cents(cost / n) : "—"}</div>
            </div>
            <div>
              <div className="text-dim">Price after</div>
              <div className="mt-1 text-lg font-medium">{m?.open ? cents(afterSide) : "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-dim">If it wins</div>
              <div className="mt-1 text-lg font-medium text-neon">{mode === "buy" && n > 0 ? mon(n, 2) : "—"}</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

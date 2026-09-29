import PxButton from "../ui/PxButton";
import Panel from "../ui/Panel";
import Tag from "../ui/Tag";
import MonCard, { Sprite } from "../ui/MonCard";
import { MONS } from "../ui/mons";

const auctions = [
  { mon: MONS[2], set: "Night Garden", bid: "$0.03", left: "6h 43m", bids: 2 },
  { mon: MONS[1], set: "Promo Stamp", bid: "$72.00", left: "1d 6h", bids: 0 },
];
const sales = MONS.slice(0, 5).map((m, i) => ({ mon: m, set: ["First Light", "Night Garden", "First Light", "Low Tide", "Ash Road"][i], ago: `${i + 3} hours ago` }));

export default function Market() {
  return (
    <main className="mx-auto max-w-[1236px] px-5 pt-[110px] pb-40">
      <section className="relative flex min-h-[290px] items-center overflow-hidden rounded-[4px] bg-background px-6 md:px-10">
        <div className="relative z-10 flex flex-col gap-3">
          <span className="font-display text-3xl text-primary">★ 1st</span>
          <Tag solid>Featured</Tag>
          <h2 className="font-display text-2xl">First Light</h2>
          <p className="font-mono text-xs text-subtext">Released 16/09/2026</p>
          <div className="mt-1">
            <PxButton>View Product</PxButton>
          </div>
        </div>
        <div className="absolute top-8 right-6 hidden gap-3 md:flex">
          {MONS.slice(0, 5).map((m, i) => (
            <div key={m.name} style={{ transform: `rotate(${(i - 2) * 3}deg) translateY(${Math.abs(i - 2) * 6}px)` }}>
              <MonCard mon={m} className="w-[120px]" />
            </div>
          ))}
        </div>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-[5px] w-[5px] ${i === 0 ? "bg-primary" : "bg-highlight"}`} />
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Auctions" icon={<span className="text-primary">▣</span>}>
          {auctions.map((a) => (
            <div key={a.mon.name} className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0">
              <div className="h-12 w-9 rounded-[2px] p-1" style={{ background: a.mon.bg }}>
                <Sprite mon={a.mon} />
              </div>
              <div className="flex-1">
                <div className="font-display text-[15px]">{a.mon.name}</div>
                <div className="font-mono text-xs text-subtext">{a.set}</div>
                <span className="mt-1 inline-block border border-[#8a6a1f] bg-[#3a2c0c] px-1.5 font-mono text-[11px] text-[#f2c14b]">Reserve not met</span>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="bg-primary/10 px-1.5 text-sm text-primary">{a.bid}</div>
                <div className="mt-1 text-main/80">{a.left}</div>
                <div className="text-subtext">{a.bids} bids</div>
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="Latest Sales" icon={<span className="text-primary">$</span>}>
          {sales.map((s) => (
            <div key={s.mon.name} className="flex items-center gap-4 border-b border-line px-3 py-3 last:border-b-0">
              <div className="h-12 w-9 rounded-[2px] p-1" style={{ background: s.mon.bg }}>
                <Sprite mon={s.mon} />
              </div>
              <div className="flex-1">
                <div className="font-display text-[15px]">{s.mon.name}</div>
                <div className="font-mono text-xs text-subtext">{s.set}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-[15px]">{s.mon.price}</div>
                <div className="font-mono text-xs text-subtext">{s.ago}</div>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </main>
  );
}

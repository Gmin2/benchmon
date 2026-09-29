import { useState } from "react";
import Tag from "../ui/Tag";
import PxButton from "../ui/PxButton";
import { MONS } from "../ui/mons";
import { Sprite } from "../ui/MonCard";
import { BRAND } from "../ui/TopNav";

// a sealed foil pack drawn in css: crimped ends, a colour band and one creature on the front
function Pack({ tone, mon, tilt = 0 }: { tone: string; mon: (typeof MONS)[number]; tilt?: number }) {
  const crimp = "h-3 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.35)_0_3px,transparent_3px_6px)]";
  return (
    <div className="w-[120px] overflow-hidden rounded-[3px] shadow-[0_16px_30px_-10px_rgba(0,0,0,.8)]" style={{ background: tone, transform: `rotate(${tilt}deg)` }}>
      <div className={crimp} />
      <div className="flex flex-col items-center px-3 py-4">
        <span className="font-display text-sm text-white/90">{BRAND.join("")}</span>
        <div className="mt-3 h-16 w-16 rounded-full bg-black/25 p-2">
          <Sprite mon={mon} />
        </div>
        <span className="mt-3 font-mono text-[9px] tracking-[1.5px] text-white/70 uppercase">booster pack</span>
      </div>
      <div className={crimp} />
    </div>
  );
}

const DROPS = [
  { name: "Pro Mystery Cards", gems: 11, tone: "#2b2b31", mon: MONS[2] },
  { name: "Starter Mystery Cards", gems: 5, tone: "#26352a", mon: MONS[0] },
  { name: "Tide Mystery Cards", gems: 4, tone: "#1c2c3a", mon: MONS[4] },
];

export default function Packs() {
  const [mode, setMode] = useState("MONSTERS");
  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-[110px] pb-40">
      <section className="pixel-field relative flex min-h-[250px] items-center overflow-hidden rounded-[4px] bg-secondary-bg px-8">
        <div className="relative z-10 flex flex-col gap-3">
          <Tag>Mystery drops</Tag>
          <h1 className="font-display text-[44px] leading-[44px]">
            CHASE CARDS,
            <br />
            <span className="text-primary">RIP PACKS</span>
          </h1>
          <Tag>◆ Limited time buybacks live</Tag>
        </div>
        <div className="absolute right-8 bottom-[-30px] hidden items-end -space-x-5 md:flex">
          <Pack tone="#3a6b3f" mon={MONS[0]} tilt={-10} />
          <Pack tone="#2d5a7a" mon={MONS[4]} tilt={4} />
          <Pack tone="#7a4a2a" mon={MONS[5]} tilt={14} />
        </div>
      </section>

      <div className="mt-6 inline-flex rounded-[4px] bg-subcolor p-1 font-mono text-xs">
        {["MONSTERS", "RELICS"].map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`cursor-pointer px-4 py-2 ${mode === m ? "bg-primary/15 text-primary" : "text-subtext"}`}>
            {m}
          </button>
        ))}
      </div>

      <h2 className="mt-6 flex items-center gap-3 font-display text-lg">
        <span className="h-[2px] w-5 bg-primary" />
        MYSTERY CARDS
        <span className="bg-highlight px-1.5 font-mono text-xs text-subtext">3</span>
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {DROPS.map((d) => (
          <div key={d.name} className="overflow-hidden rounded-[4px] bg-background ring-1 ring-shade">
            <div className="relative flex h-[220px] items-center justify-center bg-secondary-bg">
              <div className="absolute top-3 right-3 flex flex-col items-end gap-1 font-mono text-[10px] text-subtext uppercase">
                <span>Sold out</span>
                <span className="bg-highlight px-1">1 card</span>
                <span className="bg-highlight px-1">80% instant buyback</span>
              </div>
              <div className="opacity-50 grayscale">
                <Pack tone={d.tone} mon={d.mon} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3">
              <div>
                <div className="font-mono text-sm">{d.name}</div>
                <span className="mt-1 inline-block bg-primary/10 px-1.5 font-mono text-[11px] text-primary">◆ +{d.gems} Gems</span>
              </div>
              <PxButton dark>Notify</PxButton>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

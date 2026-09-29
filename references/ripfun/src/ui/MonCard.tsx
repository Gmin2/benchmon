import type { Mon } from "./mons";

function Sprite({ mon }: { mon: Mon }) {
  return (
    <svg viewBox="0 0 12 12" className="h-full w-full" aria-hidden>
      {mon.grid.flatMap((row, y) => [...row].map((ch, x) => (ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={mon.palette[ch]} />)))}
    </svg>
  );
}

// a trading card built from scratch: coloured frame, name and hp bar, pixel art window, one move
export default function MonCard({ mon, className = "" }: { mon: Mon; className?: string }) {
  return (
    <div className={`aspect-[0.718] rounded-[4.55%/3.5%] p-[5%] shadow-[0_18px_40px_-12px_rgba(0,0,0,.8)] ${className}`} style={{ background: mon.frame }}>
      <div className="flex h-full flex-col rounded-[3%] bg-[#F4F1E6] p-[5%] text-[#1a1a1a]">
        <div className="flex items-baseline justify-between font-display leading-none">
          <span className="text-[clamp(10px,1.3vw,16px)]">{mon.name}</span>
          <span className="text-[clamp(8px,0.9vw,12px)]">
            HP <b>{mon.hp}</b>
          </span>
        </div>
        <div className="mt-[6%] aspect-[4/3] w-full border-2 border-[#1a1a1a]/70 p-[8%]" style={{ background: mon.bg }}>
          <Sprite mon={mon} />
        </div>
        <div className="mt-[4%] font-mono text-[clamp(6px,0.65vw,9px)] tracking-wide text-black/50 uppercase">{mon.type} type</div>
        <div className="mt-auto flex items-center justify-between border-t border-black/15 pt-[4%] font-display text-[clamp(8px,0.9vw,12px)]">
          <span>{mon.move}</span>
          <span>{Math.round(mon.hp / 2)}</span>
        </div>
      </div>
    </div>
  );
}

export { Sprite };

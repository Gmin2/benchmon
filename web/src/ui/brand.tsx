import { CREST } from "./Card";
import { Pixel } from "./pixel";

export function Crest({ className = "", color = "#cdf462" }: { className?: string; color?: string }) {
  return <Pixel grid={CREST} colors={{ "1": color, "2": "#eefbb8", "3": "#5c6e1c", "4": "#1c2210" }} className={className} />;
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Crest className="w-7 h-7" />
      <span className="font-wide font-semibold tracking-[0.14em] text-[15px]">BENCHMON</span>
    </span>
  );
}

export const pill =
  "inline-flex items-center justify-center gap-2 rounded-full font-mono uppercase tracking-wide text-sm px-5 py-3 transition active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none select-none";
export const pillLime = `${pill} bg-lime text-gray-10 hover:brightness-95`;
export const pillGhost = `${pill} border border-gray-20 bg-gray-10 text-gray-85 hover:bg-gray-15`;

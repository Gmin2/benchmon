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

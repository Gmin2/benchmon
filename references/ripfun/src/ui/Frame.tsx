import type { ReactNode } from "react";

// a box with a green line top and bottom that steps down at the ends, like their tagline frame
export default function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const edge = (flip: boolean) => (
    <svg className={`absolute left-0 h-[6px] w-full text-primary ${flip ? "bottom-0 -scale-y-100" : "top-0"}`} preserveAspectRatio="none" viewBox="0 0 100 6" aria-hidden>
      <path d="M0 6V4h1V2h1V0h96v2h1v2h1v2" fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
  return (
    <div className={`relative px-10 py-4 ${className}`}>
      {edge(false)}
      {children}
      {edge(true)}
    </div>
  );
}

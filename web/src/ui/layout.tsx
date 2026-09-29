import type { ReactNode } from "react";
import tabedge from "./svg/tabedge.svg?raw";
import { Icon, type IconName } from "./pixel";

export const BRAND = ["BENCH", "MON"];

export function PxButton({ children, dark, wide, onClick, disabled, type = "button" }: { children: ReactNode; dark?: boolean; wide?: boolean; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`pxwrap ${dark ? "dark" : ""} flex cursor-pointer px-1 font-display whitespace-nowrap ${wide ? "w-full" : "w-min"}`}>
      <span className="pxbtn flex w-full items-center justify-center gap-2.5 px-5 text-base">
        <span className="text-shadow">{children}</span>
      </span>
    </button>
  );
}

export function Panel({ title, icon, right, children, className = "" }: { title?: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[4px] border-t-2 border-primary bg-background ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-line px-3 py-3 font-display text-base">
          {icon}
          {title}
          {right && <span className="ml-auto font-mono text-xs text-subtext">{right}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

// a line top and bottom that steps down at the ends
export function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
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

export function Tag({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return solid ? (
    <span className="w-min bg-primary px-2 text-sm whitespace-nowrap text-bg uppercase">{children}</span>
  ) : (
    <span className="w-min border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs whitespace-nowrap text-primary uppercase">{children}</span>
  );
}

export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex cursor-pointer items-center font-display text-[30px] leading-none tracking-[1px] md:text-[34px]">
      <span className="bg-primary px-1 text-bg">{BRAND[0]}</span>
      <span>{BRAND[1]}</span>
    </button>
  );
}

export function Ticker({ tag, children, onClick }: { tag: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="relative hidden cursor-pointer items-center gap-2 rounded-[4px] bg-subcolor px-3 py-2 font-display md:flex">
      <span className="bg-primary px-1.5 font-mono text-xs text-bg">{tag}</span>
      <span className="text-[15px]">{children}</span>
      <span className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-primary/80" />
    </button>
  );
}

export type Tab = "home" | "decks" | "play" | "watch" | "ranks";
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "decks", label: "Decks", icon: "decks" },
  { id: "watch", label: "Watch", icon: "watch" },
  { id: "ranks", label: "Ranks", icon: "ranks" },
];

function Edge({ flip }: { flip?: boolean }) {
  return <span aria-hidden className={`inline-flex h-[60px] text-subcolor [&>svg]:h-full [&>svg]:w-auto ${flip ? "-scale-x-100" : ""}`} dangerouslySetInnerHTML={{ __html: tabedge }} />;
}

// the floating dock: stepped pixel ends, the active tab lime with a notch, PLAY raised in the middle
export function Dock({ tab, go }: { tab: string; go: (t: Tab) => void }) {
  const item = (t: (typeof TABS)[number]) => {
    const on = tab === t.id;
    return (
      <button key={t.id} onClick={() => go(t.id)} className="group relative flex h-full w-[64px] cursor-pointer flex-col items-center justify-center gap-1 pt-1.5 font-display text-[15px] md:w-[71px]">
        {on && <span className="absolute top-0 left-1/2 h-[4px] w-4 -translate-x-1/2 bg-primary [clip-path:polygon(0_0,100%_0,60%_100%,40%_100%)]" />}
        <Icon name={t.icon} className={`h-5 w-5 ${on ? "text-primary" : "text-main opacity-20 group-hover:opacity-60"} transition-opacity`} />
        <span className={on ? "text-primary" : "text-main opacity-40 transition-opacity group-hover:opacity-60"}>{t.label}</span>
      </button>
    );
  };
  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-end" aria-label="main">
      <Edge flip />
      <div className="flex h-[60px] items-center gap-x-1 bg-subcolor px-3 pb-2 md:gap-x-3 md:px-4">
        {item(TABS[0]!)}
        {item(TABS[1]!)}
        <button onClick={() => go("play")} className="group relative -mt-9 flex w-[64px] cursor-pointer flex-col items-center md:w-[71px]">
          <span className="pxwrap">
            <span className="pxbtn flex w-[54px] items-center justify-center">
              <Icon name="play" className="h-5 w-5 text-bg" />
            </span>
          </span>
          <span className={`font-display text-[13px] ${tab === "play" ? "text-primary" : "text-main/60"}`}>Play</span>
        </button>
        {item(TABS[2]!)}
        {item(TABS[3]!)}
      </div>
      <Edge />
    </nav>
  );
}

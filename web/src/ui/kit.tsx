import type { ReactNode } from "react";

const svgs = import.meta.glob("./icons/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const ICONS = Object.fromEntries(Object.entries(svgs).map(([path, svg]) => [path.replace(/^.*\/(.*)\.svg$/, "$1"), svg]));

export type IcoName =
  | "house-6" | "layers" | "gamepad" | "square-activity-chart" | "star-2" | "gear-3" | "magnifier" | "bell" | "refresh"
  | "eye-2" | "chevron-down" | "repeat-2" | "user-3" | "arrow-door-out-2" | "stopwatch" | "energy" | "lock"
  | "circle-plus" | "check" | "clock-2" | "flag-8" | "skull";

// nucleo core icons, recoloured to currentColor at copy time
export function Ico({ name, className = "h-5 w-5" }: { name: IcoName; className?: string }) {
  return <span aria-hidden className={`ico shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />;
}

type BtnKind = "neon" | "ghost" | "outline" | "quiet";
const KIND: Record<BtnKind, string> = {
  neon: "bg-neon text-bg hover:bg-neon-hi glow-neon",
  ghost: "bg-panel-2 text-ink hover:bg-raised",
  outline: "border-2 border-neon/70 text-neon hover:bg-neon/10",
  quiet: "text-mute hover:text-ink hover:bg-panel-2",
};

export function Btn({ kind = "neon", size = "md", className = "", children, ...rest }: { kind?: BtnKind; size?: "sm" | "md" | "lg" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sz = size === "lg" ? "h-16 px-8 text-lg" : size === "sm" ? "h-9 px-4 text-sm" : "h-12 px-6 text-[15px]";
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 ${sz} ${KIND[kind]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconBtn({ name, label, onClick, active }: { name: IcoName; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`grid h-12 w-12 place-items-center rounded-2xl border border-line transition hover:bg-panel-2 ${active ? "bg-panel-2 text-ink" : "text-mute"}`}>
      <Ico name={name} className="h-5 w-5" />
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[var(--radius-panel)] bg-panel ${className}`}>{children}</section>;
}

export function Chip({ tone = "up", children }: { tone?: "up" | "down" | "flat" | "gold" | "violet"; children: ReactNode }) {
  const t = {
    up: "bg-neon/12 text-neon",
    down: "bg-down-bg text-down",
    flat: "bg-panel-2 text-mute",
    gold: "bg-gold/12 text-gold",
    violet: "bg-[#8b5cf6]/15 text-[#b69cff]",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-medium whitespace-nowrap ${t}`}>{children}</span>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`h-10 rounded-xl px-4 text-sm font-medium transition ${o === value ? "bg-panel-2 text-ink" : "text-dim hover:text-mute"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function SearchBar({ placeholder = "Search" }: { placeholder?: string }) {
  return (
    <label className="flex h-14 w-full max-w-[480px] items-center gap-3 rounded-full border border-line bg-panel px-5 text-mute focus-within:border-neon/50">
      <Ico name="magnifier" className="h-5 w-5" />
      <input placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-dim" />
      <kbd className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 font-sans text-xs text-mute">/</kbd>
    </label>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@dynamic-labs-sdk/client";
import { Game } from "../Game";
import { useWallet } from "../useWallet";
import { DEV, SEAT, devUrl } from "../dev";
import { short, useBalance } from "../hooks";
import { Btn, Ico, Panel, type IcoName } from "../ui/kit";
import { Trade } from "./Trade";
import { Home } from "./Home";

export type Tab = "home" | "decks" | "play" | "trade" | "ranks";
const NAV: { id: Tab; label: string; icon: IcoName }[] = [
  { id: "home", label: "Home", icon: "house-6" },
  { id: "decks", label: "Decks", icon: "layers" },
  { id: "play", label: "Play", icon: "gamepad" },
  { id: "trade", label: "Trade", icon: "square-activity-chart" },
  { id: "ranks", label: "Ranks", icon: "star-2" },
];

function readTab(): Tab {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("match/")) return "play";
  return NAV.some((n) => n.id === h) ? (h as Tab) : "home";
}

export function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-full bg-neon text-bg ${className}`}>
      <span className="font-display text-[22px] leading-none">B</span>
    </span>
  );
}

function Rail({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[92px] flex-col items-center bg-app py-6 md:flex">
      <button onClick={() => go("home")} aria-label="benchmon home">
        <Logo />
      </button>
      <nav className="mt-14 flex flex-1 flex-col gap-3">
        {NAV.map((n) => {
          const on = n.id === tab;
          return (
            <button key={n.id} onClick={() => go(n.id)} title={n.label} aria-label={n.label} className="group relative grid h-14 w-[92px] place-items-center">
              {on && <span className="absolute top-2 right-0 bottom-2 w-1.5 rounded-l-full bg-neon" />}
              <span className={`grid h-12 w-12 place-items-center rounded-2xl transition ${on ? "bg-panel-2 text-ink" : "text-dim group-hover:text-mute"}`}>
                <Ico name={n.icon} className="h-[22px] w-[22px]" />
              </span>
            </button>
          );
        })}
      </nav>
      <button className="grid h-12 w-12 place-items-center rounded-2xl text-dim hover:text-mute" aria-label="settings" title="settings">
        <Ico name="gear-3" className="h-[22px] w-[22px]" />
      </button>
    </aside>
  );
}

function TopBar({ tab }: { tab: Tab }) {
  const { address } = useWallet();
  const balance = useBalance(address);
  const [open, setOpen] = useState(false);
  const title = NAV.find((n) => n.id === tab)!.label;
  return (
    <header className="flex h-24 items-center justify-between gap-4">
      <div className="flex items-center gap-3 md:hidden">
        <Logo className="h-10 w-10" />
      </div>
      <h1 className="hidden font-display text-[34px] tracking-wide uppercase md:block">{title}</h1>
      <div className="relative flex items-center gap-3">
        {DEV && (
          <span className="hidden h-12 items-center rounded-full border border-neon/30 bg-neon/10 px-4 text-sm font-semibold text-neon sm:flex" title="dev mode: no login, a throwaway player key in this browser">
            DEV · player {SEAT}
          </span>
        )}
        <button onClick={() => setOpen((o) => !o)} className="flex h-14 items-center gap-3 rounded-full bg-panel pr-5 pl-2 transition hover:bg-panel-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-neon/15 text-neon">
            <Ico name="user-3" className="h-5 w-5" />
          </span>
          <span className="text-left">
            <span className="block text-[15px] font-semibold">{address ? short(address) : "setting up"}</span>
            <span className="block text-xs text-mute">{balance.toFixed(3)} MON</span>
          </span>
          <Ico name="chevron-down" className="h-4 w-4 text-mute" />
        </button>
        <button className="grid h-14 w-14 place-items-center rounded-full bg-panel text-mute hover:text-ink" aria-label="notifications">
          <Ico name="bell" className="h-5 w-5" />
        </button>
        {open && (
          <div className="absolute top-16 right-0 z-50 w-80 rounded-3xl border border-line bg-panel p-3 shadow-2xl">
            <div className="rounded-2xl bg-panel-2 p-3 text-xs break-all text-mute">{address}</div>
            {DEV ? (
              <>
                <p className="px-2 pt-3 text-xs leading-5 text-mute">
                  stakes need testnet MON. top this player up from the deployer:
                  <code className="mt-1 block text-ink">cd backend && bun --env-file=../.env scripts/fund-dev.ts {address ?? "0x…"}</code>
                </p>
                <a className="mt-2 block rounded-2xl px-3 py-3 text-sm hover:bg-panel-2" href={devUrl(SEAT === "a" ? "b" : "a")} target="_blank" rel="noreferrer">
                  Open player {SEAT === "a" ? "b" : "a"} in a new tab
                </a>
                <a className="block rounded-2xl px-3 py-3 text-sm hover:bg-panel-2" href={devUrl(null)}>
                  Leave dev mode
                </a>
              </>
            ) : (
              <button className="mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm hover:bg-panel-2" onClick={() => logout()}>
                <Ico name="arrow-door-out-2" className="h-4 w-4" />
                Log out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function Soon({ children, go }: { children: ReactNode; go: (t: Tab) => void }) {
  return (
    <Panel className="p-8">
      <p className="max-w-xl text-mute">{children}</p>
      <Btn className="mt-6" onClick={() => go("trade")}>
        Open the trade page
      </Btn>
    </Panel>
  );
}

export function Shell() {
  const [tab, setTab] = useState<Tab>(readTab);
  useEffect(() => {
    const on = () => setTab(readTab());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const go = (t: Tab) => {
    location.hash = t;
    scrollTo(0, 0);
  };

  return (
    <div className="min-h-svh bg-app">
      <Rail tab={tab} go={go} />
      <div className="md:pl-[92px]">
        <div className="mx-auto max-w-[1480px] px-5 pb-24 md:px-10">
          <TopBar tab={tab} />
          {tab === "trade" ? (
            <Trade />
          ) : tab === "play" ? (
            <Panel className="p-6">
              <Game />
            </Panel>
          ) : tab === "home" ? (
            <Home go={go} />
          ) : tab === "decks" ? (
            <Soon go={go}>collection and deck builder, restyled after the lobby.</Soon>
          ) : (
            <Soon go={go}>players by wins and winnings, cards by win rate.</Soon>
          )}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-app/95 py-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => go(n.id)} className={`flex flex-col items-center gap-1 px-2 text-[11px] ${n.id === tab ? "text-neon" : "text-dim"}`}>
            <Ico name={n.icon} className="h-5 w-5" />
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

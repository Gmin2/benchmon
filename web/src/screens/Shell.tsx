import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { logout } from "@dynamic-labs-sdk/client";
import { useWallet } from "../useWallet";
import { DEV, SEAT, devUrl, leaveDev } from "../dev";
import { short, useBalance } from "../hooks";
import { Logo } from "../ui/brand";
import { Ico } from "../ui/kit";
import { RailIcon, type RailIconName } from "../ui/railIcons";
import { useMe } from "../profile";
import { Onboarding } from "./Onboarding";

const NAV: { to: string; label: string; icon: RailIconName }[] = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/decks", label: "Decks", icon: "decks" },
  { to: "/play", label: "Play", icon: "play" },
  { to: "/trade", label: "Trade", icon: "trade" },
  { to: "/ranks", label: "Ranks", icon: "ranks" },
];

function Rail() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[92px] flex-col items-center bg-app py-6 md:flex">
      <NavLink to="/home" aria-label="benchmon home">
        <Logo />
      </NavLink>
      <nav className="mt-12 flex flex-1 flex-col gap-2">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} title={n.label} aria-label={n.label} className="group relative flex w-[92px] flex-col items-center gap-1 py-1">
            {({ isActive: on }) => (
              <>
                {on && <span className="absolute top-2 right-0 h-10 w-1.5 rounded-l-full bg-neon" />}
                <span className={`grid h-[52px] w-[52px] place-items-center rounded-[18px] transition duration-200 ${on ? "bg-neon text-bg shadow-[0_8px_24px_-8px_rgba(184,255,61,.7)]" : "bg-transparent text-[#6b6d75] group-hover:-translate-y-0.5 group-hover:bg-panel group-hover:text-ink"}`}>
                  <RailIcon name={n.icon} className="h-[26px] w-[26px]" cutColor={on ? "#b8ff3d" : "#16171a"} />
                </span>
                <span className={`text-[11px] font-semibold ${on ? "text-ink" : "text-dim group-hover:text-mute"}`}>{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <button className="grid h-[52px] w-[52px] place-items-center rounded-[18px] text-dim transition hover:rotate-45 hover:bg-panel hover:text-mute" aria-label="settings" title="settings">
        <RailIcon name="settings" className="h-[24px] w-[24px]" />
      </button>
    </aside>
  );
}

function TopBar() {
  const { address } = useWallet();
  const balance = useBalance(address);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const title = NAV.find((n) => pathname.startsWith(n.to))?.label ?? "Onchain";
  return (
    <header className="flex h-24 items-center justify-between gap-4">
      <div className="md:hidden">
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
            <NavLink to="/onchain" onClick={() => setOpen(false)} className="mt-2 block rounded-2xl px-3 py-3 text-sm hover:bg-panel-2">
              Onchain game (beta)
            </NavLink>
            {DEV ? (
              <>
                <p className="px-2 pt-2 text-xs leading-5 text-mute">
                  stakes need testnet MON. top this player up from the deployer:
                  <code className="mt-1 block text-ink">cd backend && bun --env-file=../.env scripts/fund-dev.ts {address ?? "0x…"}</code>
                </p>
                <a className="mt-2 block rounded-2xl px-3 py-3 text-sm hover:bg-panel-2" href={devUrl(SEAT === "a" ? "b" : "a")} target="_blank" rel="noreferrer">
                  Open player {SEAT === "a" ? "b" : "a"} in a new tab
                </a>
                <button className="block w-full rounded-2xl px-3 py-3 text-left text-sm hover:bg-panel-2" onClick={leaveDev}>
                  Leave dev mode
                </button>
              </>
            ) : (
              <button className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm hover:bg-panel-2" onClick={() => logout()}>
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

export function Shell() {
  const { profile } = useMe();
  return (
    <div className="min-h-svh bg-app">
      {!profile && <Onboarding />}
      <Rail />
      <div className="md:pl-[92px]">
        <div className="mx-auto max-w-[1480px] px-5 pb-24 md:px-10">
          <TopBar />
          <Outlet />
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-app/95 py-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `flex flex-col items-center gap-1 px-2 text-[11px] ${isActive ? "text-neon" : "text-dim"}`}>
            <RailIcon name={n.icon} className="h-6 w-6" cutColor="#16171a" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

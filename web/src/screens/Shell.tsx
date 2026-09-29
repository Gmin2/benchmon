import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@dynamic-labs-sdk/client";
import { Game } from "../Game";
import { useWallet } from "../useWallet";
import { Brand, Dock, Panel, PxButton, Ticker, type Tab } from "../ui/layout";
import { Icon, type IconName } from "../ui/pixel";

const TABS: Tab[] = ["home", "decks", "play", "watch", "ranks"];

// #home, #decks ... and the old #/match/:id links still open inside play
function readTab(): Tab {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("match/")) return "play";
  return (TABS as string[]).includes(h) ? (h as Tab) : "home";
}

function TopBar({ go }: { go: (t: Tab) => void }) {
  const { address } = useWallet();
  const [open, setOpen] = useState(false);
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "setting up";
  return (
    <nav className="fixed top-0 left-0 z-50 w-full bg-bg/70 backdrop-blur-sm">
      <div className="mx-auto flex h-[72px] max-w-[1236px] items-center justify-between px-5">
        <Brand onClick={() => go("home")} />
        <Ticker tag="LIVE" onClick={() => go("watch")}>
          matches running on monad testnet
        </Ticker>
        <div className="relative flex items-start gap-3">
          <div className="hidden flex-col items-center sm:flex">
            <div className="flex items-center gap-2 rounded-[4px] border-2 border-shade bg-secondary-bg p-1.5 pr-2">
              <div className="grid h-7 w-6 place-items-center rounded-[2px] bg-highlight text-primary">
                <Icon name="ranks" className="h-3.5 w-3.5" />
              </div>
              <div className="w-[150px]">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="bg-primary/10 px-1 text-primary">ROOKIE</span>
                  <span className="bg-primary/10 px-1 text-primary">0 WINS</span>
                </div>
                <div className="mt-1.5 h-[6px] bg-[repeating-linear-gradient(90deg,#2e2e31_0_4px,transparent_4px_6px)]" />
              </div>
            </div>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="flex h-11 cursor-pointer items-center gap-2 rounded-[4px] bg-secondary-bg px-2 font-display text-[15px]">
            <span className="h-7 w-7 rounded-[4px] bg-[#2a3312]" />
            {short}
            <span className="text-subtext">⌄</span>
          </button>
          {open && (
            <div className="absolute top-12 right-0 w-56 rounded-[4px] border border-line bg-background p-2 font-mono text-sm">
              <div className="px-2 py-1.5 text-xs break-all text-subtext">{address}</div>
              <button className="w-full cursor-pointer rounded-[3px] px-2 py-2 text-left hover:bg-shade" onClick={() => logout()}>
                log out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function Soon({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1236px] px-5 pt-[110px] pb-40">
      <Panel title={title} icon={<Icon name={icon} className="h-4 w-4 text-primary" />}>
        <p className="px-4 py-6 font-mono text-sm text-subtext">{children}</p>
      </Panel>
    </main>
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
    <div className="relative min-h-svh bg-[radial-gradient(ellipse_at_50%_-10%,#1e2610_0%,#0d0d10_55%)]">
      <TopBar go={go} />
      {tab === "play" ? (
        <main className="mx-auto max-w-[1236px] px-5 pt-[110px] pb-40">
          <Panel title="Play" icon={<Icon name="play" className="h-4 w-4 text-primary" />} right="the match screens get their design next">
            <div className="p-4">
              <Game />
            </div>
          </Panel>
        </main>
      ) : tab === "home" ? (
        <Soon icon="home" title="Home">
          the lobby comes next: open matches to join, live matches to watch and back, your matches and the top players.
          <span className="mt-4 block">
            <PxButton onClick={() => go("play")}>Play now</PxButton>
          </span>
        </Soon>
      ) : tab === "decks" ? (
        <Soon icon="decks" title="Decks">your collection and the deck builder, power meter against the 1600 cap.</Soon>
      ) : tab === "watch" ? (
        <Soon icon="watch" title="Watch">live matches, back a side and the spectator market.</Soon>
      ) : (
        <Soon icon="ranks" title="Ranks">players by wins and winnings, cards by win rate and live duel wins.</Soon>
      )}
      <Dock tab={tab} go={go} />
    </div>
  );
}

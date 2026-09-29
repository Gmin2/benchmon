import { devUrl } from "../../dev";
import { scrollToLogin } from "./Login";

export function Nav({ links = true }: { links?: boolean }) {
  return (
    <header className="relative z-20 mx-auto flex max-w-[1320px] items-center justify-between px-6 py-6">
      <span className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-neon font-display text-xl text-bg">B</span>
        <span className="font-display text-2xl tracking-[0.1em] text-ink">BENCHMON</span>
      </span>
      {links && (
        <nav className="hidden gap-9 text-[15px] font-medium text-mute md:flex">
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#cards" className="hover:text-ink">
            Cards
          </a>
          <a href="#live" className="hover:text-ink">
            Live
          </a>
        </nav>
      )}
      <div className="flex items-center gap-4">
        {import.meta.env.DEV && (
          <a href={devUrl("a")} className="hidden text-sm font-semibold text-dim hover:text-ink sm:block">
            dev mode
          </a>
        )}
        <button onClick={scrollToLogin} className="h-12 rounded-full border-2 border-neon/70 px-7 text-sm font-bold text-neon transition hover:bg-neon hover:text-bg">
          Log in
        </button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-6 text-xs text-dim">
      <span>benchmon · monad metropolis 2026 · live on monad testnet</span>
      <span>
        stats: arena (cc-by), openrouter prices · art: lpc artists (cc-by-sa) ·{" "}
        <a className="underline hover:text-ink" href="/art/CREDITS-characters.md" target="_blank" rel="noreferrer">
          credits
        </a>
      </span>
    </footer>
  );
}

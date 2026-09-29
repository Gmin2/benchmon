import { useState } from "react";
import MonCard from "../ui/MonCard";
import { MONS } from "../ui/mons";

const SETS = [
  { name: "First Light", cards: 161, date: "16/09/2026" },
  { name: "Night Garden", cards: 120, date: "18/07/2026" },
  { name: "Low Tide", cards: 122, date: "02/05/2026" },
  { name: "Ash Road", cards: 124, date: "14/03/2026" },
  { name: "Stone Hours", cards: 99, date: "30/01/2026" },
  { name: "Starter Box", cards: 9, date: "11/12/2025" },
];

export default function Explore() {
  const [tab, setTab] = useState("Monsters");
  const [lang, setLang] = useState("English");
  return (
    <main className="pb-40">
      <section className="relative flex h-[560px] flex-col items-center justify-center overflow-hidden px-5 pt-[72px] text-center">
        {/* the faded wall of cards behind the title */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-[repeat(auto-fill,92px)] justify-center gap-x-5 gap-y-5 pt-6 opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,transparent_10%,#000_70%)]">
          {Array.from({ length: 64 }, (_, i) => (
            <MonCard key={i} mon={MONS[i % MONS.length]} className="w-[92px] grayscale-[0.4]" />
          ))}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,13,16,.85)_20%,rgba(13,13,16,.4)_70%)]" />
        <h1 className="relative font-display text-[48px] leading-[48px]">Explore</h1>
        <p className="relative mt-4 max-w-[620px] font-mono text-sm text-subtext">
          Search cards, packs and profiles, then switch between monster and relic expansion browse modes.
        </p>
        <label className="relative mt-8 flex h-14 w-full max-w-[650px] items-center gap-3 rounded-[4px] bg-subcolor/90 px-5 ring-1 ring-highlight">
          <svg viewBox="0 0 16 16" className="h-5 w-5 text-primary" aria-hidden>
            <path d="M6 1h4v1h2v2h1v4h-1v2h-2v1H6v-1H4V8H3V4h1V2h2zm0 2v1H5v4h1v1h4V8h1V4h-1V3zm6 8h1v1h1v1h1v2h-2v-1h-1v-1h-1v-1h1z" fill="currentColor" />
          </svg>
          <input className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-subtext" placeholder="Search for cards, packs, sets, artists, or profiles" />
          <kbd className="rounded-[3px] bg-highlight px-1.5 font-mono text-xs text-subtext">↵</kbd>
        </label>
      </section>

      <div className="mx-auto max-w-[1236px] px-5">
        <div className="flex border-b-2 border-line font-display text-[15px]">
          {["All", "Monsters", "Relics", "Guests"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`-mb-[2px] w-[124px] cursor-pointer border-b-2 py-3 ${tab === t ? "border-primary bg-primary/10 text-primary" : "border-transparent text-main/60 hover:text-main"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2 font-display text-[15px]">
          {["English", "Japanese", "Chinese"].map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`cursor-pointer px-4 py-2 ${lang === l ? "bg-primary/10 text-primary" : "bg-subcolor text-main/50 hover:text-main"}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {SETS.map((s, i) => (
            <button key={s.name} className="group flex cursor-pointer flex-col overflow-hidden rounded-[4px] bg-background text-left ring-1 ring-shade transition hover:ring-primary/60">
              <div className="flex h-[110px] items-center justify-center p-4" style={{ background: MONS[i % MONS.length].bg }}>
                <MonCard mon={MONS[i % MONS.length]} className="w-[62px] rotate-[-6deg] transition group-hover:rotate-0" />
              </div>
              <div className="p-3">
                <div className="font-display text-base">{s.name}</div>
                <div className="mt-1 font-mono text-xs text-subtext">{s.cards} cards</div>
                <div className="font-mono text-xs text-subtext">Released {s.date}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

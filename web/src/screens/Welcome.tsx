import { useEffect, useState } from "react";
import { byName } from "../mock";
import { CardBack, GameCard } from "../ui/Card";
import { artOf, infoOf } from "../ui/meta";
import { Pixel, ICONS } from "../ui/pixel";
import { Login } from "./landing/Login";
import { Wordmark } from "../ui/brand";
import { RailIcon } from "../ui/railIcons";

// film grain over everything, the reference's printed look
function Grain({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full mix-blend-overlay" style={{ opacity }} aria-hidden>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

// soft violet clouds built from overlapping blurred puffs
function Smoke({ side }: { side: "left" | "right" }) {
  const puffs = side === "left" ? [[-6, 58, 30], [4, 72, 26], [-2, 90, 34], [16, 88, 22], [10, 100, 30], [26, 102, 20]] : [[106, 56, 30], [96, 70, 26], [102, 88, 34], [84, 86, 22], [90, 100, 30], [74, 102, 20]];
  return (
    <>
      {puffs.map(([x, y, r], i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${r}vw`,
            height: `${r}vw`,
            translate: "-50% -50%",
            background: `radial-gradient(circle at 40% 35%, #8f7cff 0%, #5b43f0 38%, #2a1a8f 70%, transparent 72%)`,
            filter: "blur(6px)",
            opacity: 0.95,
          }}
        />
      ))}
    </>
  );
}

// the salmon flame wall behind the table
function Flames() {
  return (
    <svg viewBox="0 0 1000 420" preserveAspectRatio="none" className="absolute inset-x-[12%] bottom-[16%] h-[62%] w-[76%]" aria-hidden>
      <defs>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f59a86" />
          <stop offset=".6" stopColor="#ee8570" />
          <stop offset="1" stopColor="#c4586a" />
        </linearGradient>
      </defs>
      <path
        fill="url(#flame)"
        d="M0 420 C40 330 60 300 90 250 C110 290 120 300 140 280 C150 220 190 170 230 150 C220 210 250 240 280 230 C290 170 330 120 380 80 C370 150 400 180 440 170 C450 110 480 50 520 20 C520 90 550 130 590 130 C600 80 640 40 690 20 C670 90 690 140 730 150 C750 110 790 90 830 90 C810 150 830 190 870 200 C890 170 920 160 950 170 C940 230 960 280 1000 320 L1000 420 Z"
      />
    </svg>
  );
}

// the round table in the middle, like the roulette wheel. built as flat circles squashed
// into an ellipse, so the ring can spin without the shape turning with it
function Table() {
  const ring = (inset: string, style: React.CSSProperties, cls = "") => <div className={`absolute rounded-full ${cls}`} style={{ inset, ...style }} />;
  return (
    <div className="absolute bottom-[-22%] left-1/2 aspect-square w-[50%] -translate-x-1/2 origin-bottom scale-y-[.4]">
      {ring("0", { background: "#161233", boxShadow: "0 -30px 120px rgba(0,0,0,.6) inset" })}
      {ring("5%", { background: "#221a4d" })}
      {ring("11%", { background: "repeating-conic-gradient(from 0deg, #f59a86 0 4deg, #1a1440 4deg 9deg, #6a58ff 9deg 13deg, #1a1440 13deg 18deg)" }, "animate-[spin-slow_40s_linear_infinite]")}
      {ring("20%", { background: "#1b1540" })}
      {ring("26%", { background: "radial-gradient(circle, #3a2d80, #1b1540 70%)" })}
    </div>
  );
}

type Floater = { x: string; y: string; r: number; d: number; el: React.ReactNode };

export function Welcome() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);

  const heroes = ["kimi-k3", "claude-opus-5.5", "deepseek-v4.1-flash"].map((n) => infoOf(byName(n)));
  const [h, setH] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setH((x) => (x + 1) % heroes.length), 3800);
    return () => clearInterval(t);
  }, [heroes.length]);
  const hero = heroes[h]!;
  const kimi = infoOf(byName("gemini-3.8-flash"));
  const opus = infoOf(byName("claude-fable-5"));
  const deep = infoOf(byName("grok-4.20"));
  const gem = (color: string) => <Pixel grid={ICONS.gem} colors={{ "1": color, "2": "#ffffff" }} className="h-full w-full" />;
  const back = (side: "mine" | "theirs") => (
    <div className="bm-card size-mini is-facedown" style={{ fontSize: 4.5 }}>
      <div className="inner">
        <div className="side front" />
        <CardBack side={side} />
      </div>
    </div>
  );

  // cards, backs and gems flying around the table like the chips and dice
  const floaters: Floater[] = [
    { x: "22%", y: "58%", r: -18, d: 0, el: <GameCard info={kimi} size="mini" style={{ fontSize: 5 }} /> },
    { x: "74%", y: "54%", r: 16, d: 1.2, el: <GameCard info={opus} size="mini" style={{ fontSize: 5 }} /> },
    { x: "84%", y: "74%", r: -10, d: 2.1, el: <GameCard info={deep} size="mini" style={{ fontSize: 4.5 }} /> },
    { x: "33%", y: "46%", r: 22, d: 0.6, el: back("mine") },
    { x: "63%", y: "40%", r: -24, d: 1.8, el: back("theirs") },
    { x: "14%", y: "76%", r: 12, d: 2.6, el: back("mine") },
    { x: "28%", y: "70%", r: 0, d: 0.3, el: <span className="block h-10 w-10">{gem("#5fe08a")}</span> },
    { x: "70%", y: "66%", r: 0, d: 1.4, el: <span className="block h-9 w-9">{gem("#8f7cff")}</span> },
    { x: "41%", y: "36%", r: 0, d: 2.2, el: <span className="block h-7 w-7">{gem("#f59a86")}</span> },
    { x: "58%", y: "52%", r: 0, d: 0.9, el: <span className="block h-7 w-7">{gem("#b8ff3d")}</span> },
  ];

  return (
    <div className="relative h-svh overflow-hidden bg-[#08080a] text-white">
      {/* nav */}
      <header className="relative z-30 mx-auto flex max-w-[1180px] items-center justify-between px-6 py-5">
        <Wordmark className="h-14 md:h-[68px]" />
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="hidden h-12 rounded-full border-2 border-neon/70 px-6 text-sm font-extrabold tracking-wide text-neon uppercase transition hover:bg-neon/10 sm:block">
            Try for free
          </button>
          <button onClick={() => setOpen(true)} className="h-12 rounded-full bg-neon px-6 text-sm font-extrabold tracking-wide text-bg uppercase transition hover:bg-neon-hi">
            Log in
          </button>
        </div>
      </header>

      {/* hero copy */}
      <section className="relative z-20 mx-auto flex max-w-[1000px] flex-col items-center px-6 pt-6 text-center md:pt-8">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 py-1 pr-3 pl-1 text-[13px] font-semibold text-neon transition hover:bg-neon/15">
          <span className="rounded-full bg-neon px-2 py-0.5 text-[11px] font-extrabold text-bg uppercase">New</span>
          Claude Fable 6 card preview
          <span aria-hidden>→</span>
        </button>
        <h1 className="mt-6 text-[clamp(46px,min(6.4vw,10.5svh),84px)] leading-[1.02] font-semibold tracking-[-0.04em]">
          Pick the model
          <br />
          <span className="text-neon">Chase the win</span>
        </h1>
        <p className="mt-5 text-[16px] font-medium text-white/65 md:text-[18px]">Every card is a real AI model. Build a deck, stake on it and battle for the pot.</p>
        <div className="pointer-events-auto mt-8 flex gap-3">
          <button onClick={() => setOpen(true)} className="flex h-14 items-center gap-2 rounded-full bg-neon px-8 text-[15px] font-extrabold tracking-wide text-bg uppercase shadow-[0_12px_40px_-10px_rgba(184,255,61,.7)] transition hover:bg-neon-hi active:scale-[.98]">
            <RailIcon name="play" className="h-6 w-6" cutColor="#b8ff3d" />
            Play for free
          </button>
          <a href="#" onClick={(e) => { e.preventDefault(); setOpen(true); }} className="grid h-14 place-items-center rounded-full border-2 border-neon/70 bg-[#08080a]/85 px-8 text-[15px] font-extrabold tracking-wide text-neon uppercase backdrop-blur transition hover:bg-[#15180d]">
            Explore
          </a>
        </div>
      </section>

      {/* the scene */}
      <section className="pointer-events-none absolute inset-x-0 bottom-0 h-[50svh]">
        <Flames />
        <Table />
        <img key={hero.card.name} src={artOf(hero.card.name, 3)} alt={`${hero.display}, legendary`} className="pixel absolute bottom-[2%] left-1/2 h-[58%] -translate-x-1/2 animate-[hero-in_.5s_cubic-bezier(.2,.7,.2,1)_both] object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,.55)]" />
        <span key={`${hero.card.name}-tag`} className="absolute bottom-[4%] left-1/2 -translate-x-1/2 animate-[fadein_.5s_ease_both] rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold whitespace-nowrap backdrop-blur">
          {hero.display} <span className="text-neon">· {hero.power}</span>
        </span>
        {floaters.map((f, i) => (
          <div key={i} className="absolute animate-[float_6s_ease-in-out_infinite]" style={{ left: f.x, top: f.y, rotate: `${f.r}deg`, animationDelay: `-${f.d}s` }}>
            {f.el}
          </div>
        ))}
        <Smoke side="left" />
        <Smoke side="right" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#08080a] to-transparent" />
      </section>

      <Grain />

      {/* login dialog */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-6 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal aria-label="log in" className="relative w-full max-w-[460px] rounded-3xl border border-white/10 bg-[#111114] p-7" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="close" className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
              ✕
            </button>
            <h2 className="text-2xl font-semibold tracking-tight">Start playing</h2>
            <p className="mt-1 mb-5 text-sm text-white/55">Sign in with Google or your email. No password, no wallet setup, every move is free.</p>
            <Login />
          </div>
        </div>
      )}
    </div>
  );
}

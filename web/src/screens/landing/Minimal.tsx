import { byName } from "../../mock";
import { GameCard } from "../../ui/Card";
import { infoOf } from "../../ui/meta";
import { Login } from "./Login";

export function Minimal() {
  const hand = ["kimi-k3", "claude-opus-5.5", "deepseek-v4.1-flash"].map((n) => infoOf(byName(n)));
  return (
    <div className="grid min-h-svh place-items-center bg-[radial-gradient(60%_50%_at_50%_40%,#1c2410,#101113_70%)] px-6 py-12">
      <main className="flex w-full max-w-[560px] flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-neon font-display text-2xl text-bg">B</span>
        <div className="relative mt-10 h-[300px] w-full">
          {hand.map((c, i) => (
            <div key={c.card.id} className="absolute top-0 left-1/2 origin-bottom" style={{ translate: `calc(-50% + ${(i - 1) * 110}px) ${Math.abs(i - 1) * 18}px`, rotate: `${(i - 1) * 10}deg`, zIndex: i === 1 ? 2 : 1 }}>
              <GameCard info={c} size="tile" />
            </div>
          ))}
        </div>
        <h1 className="mt-4 text-[40px] leading-tight font-extrabold tracking-tight md:text-[52px]">
          Every card is a <span className="text-neon">real AI model.</span>
        </h1>
        <p className="mt-3 text-lg text-mute">Pick five. Stake. Let the benchmarks fight.</p>
        <Login className="mt-8" />
        <p className="mt-10 text-xs text-dim">benchmon · live on monad testnet · art by lpc artists (cc-by-sa)</p>
      </main>
    </div>
  );
}

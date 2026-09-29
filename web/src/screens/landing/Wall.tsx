import { ROSTER } from "../../mock";
import { GameCard } from "../../ui/Card";
import { Ico } from "../../ui/kit";
import { infoOf } from "../../ui/meta";
import { Login } from "./Login";
import { Nav } from "./parts";

// three columns of cards drifting up and down forever, the roster as the backdrop
function Column({ offset, dir }: { offset: number; dir: "up" | "down" }) {
  const cards = [...ROSTER.slice(offset), ...ROSTER.slice(0, offset)].slice(0, 6).map(infoOf);
  return (
    <div className="h-full overflow-hidden">
      <div className={`flex flex-col gap-5 ${dir === "up" ? "animate-[wall-up_38s_linear_infinite]" : "animate-[wall-down_38s_linear_infinite]"}`}>
        {[...cards, ...cards].map((c, i) => (
          <GameCard key={i} info={c} size="tile" />
        ))}
      </div>
    </div>
  );
}

export function Wall() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-bg">
      <div className="absolute inset-y-0 right-0 hidden w-[58%] grid-cols-3 gap-5 px-6 [mask-image:linear-gradient(transparent,#000_18%,#000_82%,transparent)] lg:grid">
        <Column offset={0} dir="up" />
        <Column offset={5} dir="down" />
        <Column offset={10} dir="up" />
      </div>
      <div className="absolute inset-y-0 left-0 hidden w-[55%] bg-gradient-to-r from-bg via-bg to-transparent lg:block" />

      <div className="relative">
        <Nav links={false} />
        <main className="mx-auto flex min-h-[calc(100svh-96px)] max-w-[1320px] items-center px-6">
          <div className="flex max-w-[560px] flex-col gap-7 py-12">
            <span className="w-fit rounded-full border border-neon/40 px-4 py-1.5 text-sm font-semibold text-neon">15 models · 12 labs · 1 winner</span>
            <h1 className="font-display text-[clamp(60px,7.5vw,120px)] leading-[.86] uppercase">
              Build your
              <br />
              <span className="text-neon">AI deck.</span>
            </h1>
            <p className="max-w-[44ch] text-lg text-mute">Every card is a real model with live benchmark stats. Stake on five of them and battle other players on Monad.</p>
            <Login />
            <div className="grid max-w-[460px] grid-cols-3 gap-3">
              {[
                ["energy", "live duels"],
                ["lock", "commit reveal"],
                ["star-2", "season ranks"],
              ].map(([i, t]) => (
                <div key={t} className="flex flex-col items-center gap-2 rounded-2xl bg-panel py-4 text-sm text-mute">
                  <Ico name={i as "energy"} className="h-5 w-5 text-neon" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

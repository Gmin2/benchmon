import { MONS } from "./mons";
import { Sprite } from "./MonCard";

// swap these two for your own name when this becomes the base for another app
export const BRAND = ["RIP", ".FUN"];

export default function TopNav({ go }: { go: (p: string) => void }) {
  return (
    <nav className="fixed top-0 left-0 z-50 w-full">
      <div className="mx-auto flex h-[72px] max-w-[1236px] items-center justify-between px-5">
        <button onClick={() => go("home")} className="flex cursor-pointer items-center font-display text-[34px] leading-none tracking-[1px]">
          <span className="bg-primary px-1 text-bg">{BRAND[0]}</span>
          <span>{BRAND[1]}</span>
        </button>

        <button onClick={() => go("packs")} className="relative hidden cursor-pointer items-center gap-2 rounded-[4px] bg-subcolor px-3 py-2 font-display md:flex">
          <span className="bg-primary px-1.5 font-mono text-xs text-bg">NEW</span>
          <span className="text-[15px]">Mystery Cards in stock!</span>
          <span className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-primary/80" />
        </button>

        <div className="flex items-start gap-3">
          <div className="hidden flex-col items-center sm:flex">
            <div className="flex items-center gap-2 rounded-[4px] border-2 border-shade bg-secondary-bg p-1.5 pr-2">
              <div className="h-7 w-5 rounded-[2px] bg-highlight p-0.5">
                <Sprite mon={MONS[3]} />
              </div>
              <div className="w-[170px]">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="bg-primary/10 px-1 text-primary">RANK 1</span>
                  <span className="bg-primary/10 px-1 text-primary">◆ 0</span>
                </div>
                <div className="mt-1.5 h-[6px] bg-[repeating-linear-gradient(90deg,#2e2e31_0_4px,transparent_4px_6px)]" />
              </div>
            </div>
            <span className="-mt-px border border-primary/30 bg-primary/10 px-3 py-0.5 font-mono text-xs text-primary">Spin Daily Boost</span>
          </div>
          <div className="flex h-11 items-center gap-2 rounded-[4px] bg-secondary-bg px-2 font-display text-[15px]">
            <span className="h-7 w-7 rounded-[4px] bg-[#16324a]" />
            @you
            <span className="text-subtext">⌄</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

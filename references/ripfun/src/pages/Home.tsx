import { motion } from "framer-motion";
import Icon from "../ui/Icon";
import Frame from "../ui/Frame";
import MonCard from "../ui/MonCard";
import { MONS } from "../ui/mons";

const fan = [-24, -15, -7, 0, 7, 15, 24];

function Word({ children, green, icon }: { children: string; green?: boolean; icon?: "rip" | "repeat" }) {
  return (
    <span className={`flex items-center gap-2 px-3 leading-none ${green ? "bg-primary/80 text-bg" : ""}`}>
      {icon && <Icon name={icon} className="h-[0.9em] text-bg [&_*]:fill-current" />}
      {children}
    </span>
  );
}

export default function Home() {
  const cards = [...MONS, MONS[0]].slice(0, 7);
  return (
    <main className="relative flex min-h-svh flex-col items-center overflow-hidden pt-[110px] pb-40">
      <div className="pixel-field pointer-events-none absolute inset-x-0 bottom-0 h-1/2 [mask-image:linear-gradient(transparent,#000)]" />
      <h1 className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 font-display text-[clamp(34px,5.4vw,78px)]">
        <Word>COLLECT</Word>
        <Word green icon="rip">RIP</Word>
        <Word>REDEEM</Word>
        <Word green icon="repeat">REPEAT</Word>
      </h1>

      <div className="relative mt-14 h-[330px] w-full max-w-[760px]">
        {cards.map((m, i) => (
          <motion.div
            key={i}
            className="absolute top-0 left-1/2 w-[190px] origin-bottom"
            initial={{ opacity: 0, y: 60, rotate: 0, x: "-50%" }}
            animate={{ opacity: 1, y: Math.abs(fan[i]) * 1.3, rotate: fan[i], x: `calc(-50% + ${fan[i] * 12}px)` }}
            transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.08 * i }}
            whileHover={{ y: Math.abs(fan[i]) * 1.3 - 24, transition: { duration: 0.15 } }}
            style={{ zIndex: i }}
          >
            <MonCard mon={m} />
          </motion.div>
        ))}
      </div>

      <Frame className="mt-16 text-center text-base leading-6 md:text-[17px]">
        Experience the thrill of opening digital packs,
        <br />
        collect cards, and redeem them for physical at anytime
      </Frame>
    </main>
  );
}

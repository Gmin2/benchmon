import home from "../icons/home.svg?raw";
import market from "../icons/market.svg?raw";
import explore from "../icons/explore.svg?raw";
import packs from "../icons/packs.svg?raw";
import rip from "../icons/rip.svg?raw";
import repeat from "../icons/repeat.svg?raw";
import tabedge from "../icons/tabedge.svg?raw";

const icons = { home, market, explore, packs, rip, repeat, tabedge };
export type IconName = keyof typeof icons;

// the real pixel icons from the capture, inlined so currentColor works
export default function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <span aria-hidden className={`inline-flex [&>svg]:h-full [&>svg]:w-auto ${className}`} dangerouslySetInnerHTML={{ __html: icons[name] }} />;
}

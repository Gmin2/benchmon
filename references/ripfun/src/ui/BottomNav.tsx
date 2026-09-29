import Icon, { type IconName } from "./Icon";

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "market", label: "Market", icon: "market" },
  { id: "explore", label: "Explore", icon: "explore" },
  { id: "packs", label: "Packs", icon: "packs" },
];

// the floating dock: stepped pixel ends, tabs at 40% white, the active one green with a notch marker,
// and the raised green inventory button in the middle
export default function BottomNav({ page, go }: { page: string; go: (p: string) => void }) {
  const tab = (t: (typeof TABS)[number]) => {
    const on = page === t.id;
    return (
      <button key={t.id} onClick={() => go(t.id)} className="group relative flex h-full w-[71px] cursor-pointer flex-col items-center justify-center pt-1.5 font-display text-[15px]">
        {on && <span className="absolute top-0 left-1/2 h-[4px] w-4 -translate-x-1/2 bg-primary [clip-path:polygon(0_0,100%_0,60%_100%,40%_100%)]" />}
        <Icon name={t.icon} className={`h-6 ${on ? "text-primary" : "text-main opacity-20 group-hover:opacity-60"} transition-opacity`} />
        <span className={on ? "text-primary" : "text-main opacity-40 transition-opacity group-hover:opacity-60"}>{t.label}</span>
      </button>
    );
  };
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-end">
      <Icon name="tabedge" className="h-[60px] -scale-x-100 text-subcolor" />
      <div className="flex h-[60px] items-center gap-x-3 bg-subcolor px-4 pb-2">
        {tab(TABS[0])}
        {tab(TABS[1])}
        <button className="group relative -mt-9 flex w-[71px] cursor-pointer flex-col items-center">
          <span className="pxwrap">
            <span className="pxbtn flex w-[54px] items-center justify-center">
              <svg viewBox="0 0 16 16" className="h-6 w-6 text-bg" aria-hidden>
                <path d="M1 1h14v14H1zM3 3v4h4V3zm6 0v4h4V3zM3 9v4h4V9zm6 0v4h4V9z" fill="currentColor" fillRule="evenodd" />
              </svg>
            </span>
          </span>
          <span className="font-display text-[13px] text-main/60">Inventory</span>
        </button>
        {tab(TABS[2])}
        {tab(TABS[3])}
      </div>
      <Icon name="tabedge" className="h-[60px] text-subcolor" />
    </div>
  );
}

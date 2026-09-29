import { useState } from "react";
import { AppLook } from "./landing/AppLook";
import { Evolve } from "./landing/Evolve";
import { Minimal } from "./landing/Minimal";
import { Trailer } from "./landing/Trailer";
import { Wall } from "./landing/Wall";

// landing versions side by side until one is picked, ?landing=2 opens a version directly
const VERSIONS = [
  { id: "1", name: "App look", View: AppLook },
  { id: "2", name: "Trailer", View: Trailer },
  { id: "3", name: "Minimal", View: Minimal },
  { id: "4", name: "Card wall", View: Wall },
  { id: "5", name: "Evolve", View: Evolve },
];

export function Welcome() {
  const [v, setV] = useState(() => new URLSearchParams(location.search).get("landing") ?? "1");
  const pick = (id: string) => {
    const url = new URL(location.href);
    url.searchParams.set("landing", id);
    history.replaceState(null, "", url);
    setV(id);
    scrollTo(0, 0);
  };
  const { View } = VERSIONS.find((x) => x.id === v) ?? VERSIONS[0]!;
  return (
    <>
      <View />
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-bg/90 p-1.5 shadow-2xl backdrop-blur">
        <span className="px-3 text-xs font-semibold text-dim">landing</span>
        {VERSIONS.map((x) => (
          <button key={x.id} onClick={() => pick(x.id)} className={`h-9 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition ${x.id === v ? "bg-neon text-bg" : "text-mute hover:text-ink"}`}>
            {x.id} · {x.name}
          </button>
        ))}
      </div>
    </>
  );
}

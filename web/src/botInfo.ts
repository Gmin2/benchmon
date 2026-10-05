import { useEffect, useState } from "react";
import { BACKEND } from "./chain";

// the house bot settings from the backend, so the waiting screen never promises a bot that is off
export type BotInfo = { on: false } | { on: true; address: string; joinAfter: number; maxStake: string };

let cached: Promise<BotInfo> | null = null;
const load = () =>
  (cached ??= fetch(`${BACKEND}/bot`)
    .then((r) => (r.ok ? (r.json() as Promise<BotInfo>) : { on: false as const }))
    .catch(() => {
      cached = null;
      return { on: false as const };
    }));

export function useBot(): BotInfo | null {
  const [info, setInfo] = useState<BotInfo | null>(null);
  useEffect(() => {
    let live = true;
    load().then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
  }, []);
  return info;
}

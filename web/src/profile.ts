import { useEffect, useState } from "react";
import { DEV, SEAT } from "./dev";
import { ME, type ClassId, type Player } from "./mock";

// the player's own look, kept in this browser until it lives onchain
type Profile = { cls: ClassId; body: "male" | "female"; handle: string };
// the two dev players share one browser, so each seat keeps its own look
const PKEY = DEV ? `benchmon:profile:dev-${SEAT}` : "benchmon:profile";
const EVENT = "benchmon:profile";

export function loadProfile(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(PKEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  localStorage.setItem(PKEY, JSON.stringify(p));
  dispatchEvent(new Event(EVENT));
}

function current(): { me: Player; profile: Profile | null } {
  const profile = loadProfile();
  return { me: profile ? { ...ME, ...profile } : ME, profile };
}

// re-renders whenever the profile changes, in this tab or another
export function useMe() {
  const [state, setState] = useState(current);
  useEffect(() => {
    const on = () => setState(current());
    addEventListener(EVENT, on);
    addEventListener("storage", on);
    return () => {
      removeEventListener(EVENT, on);
      removeEventListener("storage", on);
    };
  }, []);
  return state;
}

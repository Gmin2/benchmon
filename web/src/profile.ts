import { useEffect, useState } from "react";
import { ME, type ClassId, type Player } from "./mock";

// the player's own look and unclaimed winnings, kept in this browser until they live onchain
type Profile = { cls: ClassId; body: "male" | "female"; handle: string };
const PKEY = "benchmon:profile";
const CKEY = "benchmon:claimable";
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

export function claimable(): number {
  return Number(localStorage.getItem(CKEY) ?? 0);
}

export function addClaimable(amount: number) {
  localStorage.setItem(CKEY, String(claimable() + amount));
  dispatchEvent(new Event(EVENT));
}

export function clearClaimable() {
  localStorage.removeItem(CKEY);
  dispatchEvent(new Event(EVENT));
}

function current(): { me: Player; profile: Profile | null; owed: number } {
  const profile = loadProfile();
  return { me: profile ? { ...ME, ...profile } : ME, profile, owed: claimable() };
}

// re-renders whenever the profile or winnings change, in this tab or another
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

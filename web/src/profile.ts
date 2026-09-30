import { useEffect, useState } from "react";
import { BACKEND } from "./chain";
import type { SmartWallet } from "./gas";
import { ME, type ClassId, type Player } from "./mock";

// usernames live on the backend, keyed by the player's smart account, so everyone sees the same name and look
export type Profile = { address: string; username: string; cls: ClassId; body: "male" | "female"; createdAt: number };
type Status = "idle" | "loading" | "none" | "ready" | "offline";

export const SITE = (import.meta.env.VITE_SITE_URL as string | undefined) ?? location.origin;
export const siteHost = SITE.replace(/^https?:\/\//, "");
export const profileUrl = (username: string) => `${SITE}/@${username}`;

const EVENT = "benchmon:profile";
const ckey = (address: string) => `benchmon:profile:${address.toLowerCase()}`;
let state: { status: Status; profile: Profile | null; address?: string } = { status: "idle", profile: null };

function set(next: typeof state) {
  state = next;
  if (next.profile) localStorage.setItem(ckey(next.profile.address), JSON.stringify(next.profile));
  dispatchEvent(new Event(EVENT));
}

function cached(address: string): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(ckey(address)) ?? "null");
  } catch {
    return null;
  }
}

// looks up the signed in player's profile once their smart account is known; the cached copy shows at once
export async function syncProfile(address: string) {
  if (state.address === address && state.status !== "idle") return;
  const c = cached(address);
  set({ status: c ? "ready" : "loading", profile: c, address });
  try {
    const r = await fetch(`${BACKEND}/profile/${address}`);
    if (r.status === 404) return set({ status: "none", profile: null, address });
    if (r.ok) return set({ status: "ready", profile: await r.json(), address });
    throw new Error(String(r.status));
  } catch {
    if (!c) set({ status: "offline", profile: null, address });
  }
}

export function useMe(): { me: Player; profile: Profile | null; status: Status } {
  const [s, setS] = useState(state);
  useEffect(() => {
    const on = () => setS(state);
    addEventListener(EVENT, on);
    return () => removeEventListener(EVENT, on);
  }, []);
  const p = s.profile;
  return { me: p ? { ...ME, handle: p.username, cls: p.cls, body: p.body, address: p.address } : ME, profile: p, status: s.status };
}

export async function checkUsername(name: string, address?: string): Promise<{ free: boolean; reason: string | null }> {
  const r = await fetch(`${BACKEND}/username/${encodeURIComponent(name)}${address ? `?for=${address}` : ""}`);
  return r.json();
}

// the smart account signs the claim, the backend checks the signature before taking the name
export async function claimProfile(wallet: SmartWallet, fields: { username: string; cls: ClassId; body: "male" | "female" }) {
  const address = wallet.address.toLowerCase();
  const issuedAt = Date.now();
  const message = `benchmon profile\naddress: ${address}\nusername: ${fields.username}\nclass: ${fields.cls}\nlook: ${fields.body}\nissued: ${issuedAt}`;
  const signature = await wallet.client.signMessage({ message });
  const r = await fetch(`${BACKEND}/profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, ...fields, issuedAt, signature }),
  });
  const j = (await r.json()) as { ok: boolean; error?: string; profile?: Profile };
  if (!j.ok || !j.profile) throw new Error(j.error ?? "could not save the profile");
  set({ status: "ready", profile: j.profile, address: wallet.address });
  return j.profile;
}

export async function profileByName(name: string): Promise<Profile | null> {
  const r = await fetch(`${BACKEND}/profile/@${encodeURIComponent(name.toLowerCase())}`).catch(() => null);
  return r?.ok ? r.json() : null;
}

// other players' profiles, fetched in one batch and kept for the session
const known = new Map<string, Profile | null>();
export function useProfiles(addresses: string[]) {
  const key = addresses.map((a) => a.toLowerCase()).sort().join(",");
  const [, bump] = useState(0);
  useEffect(() => {
    const missing = key.split(",").filter((a) => a && !/^0x0+$/.test(a) && !known.has(a));
    if (!missing.length) return;
    missing.forEach((a) => known.set(a, null));
    fetch(`${BACKEND}/profiles?addresses=${missing.join(",")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Profile[]) => {
        list.forEach((p) => known.set(p.address, p));
        bump((n) => n + 1);
      })
      .catch(() => missing.forEach((a) => known.delete(a)));
  }, [key]);
  return (address: string) => known.get(address.toLowerCase()) ?? null;
}

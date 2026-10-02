import { mkdir } from "node:fs/promises";
import { isAddress, type Address, type Hex } from "viem";
import { pub } from "./chain";
import { config } from "./config";

// usernames, class and look per player address. a claim is signed by the player's smart account, so nobody
// can take a name for someone else's wallet. kept in a json file next to the duel transcripts.
export type Profile = { address: string; username: string; cls: string; body: "male" | "female"; createdAt: number };

const CLASSES = ["researcher", "hacker", "trader", "builder", "sage", "athlete", "scout", "validator"];
const RESERVED = new Set(["home", "play", "trade", "ranks", "decks", "admin", "api", "benchmon", "support", "help", "settings", "profile", "login", "logout", "kimi", "judge", "house", "null", "undefined"]);
const file = `${config.duelsDir}../profiles.json`;
const byAddress = new Map<string, Profile>();
const byName = new Map<string, Profile>();

export async function loadProfiles() {
  const f = Bun.file(file);
  if (!(await f.exists())) return;
  for (const p of (await f.json()) as Profile[]) {
    byAddress.set(p.address, p);
    byName.set(p.username, p);
  }
}

async function persist() {
  await mkdir(config.duelsDir, { recursive: true });
  await Bun.write(file, JSON.stringify([...byAddress.values()], null, 1));
}

export function checkName(name: string, forAddress?: string): string | null {
  if (!/^[a-z0-9_]{3,18}$/.test(name)) return "3 to 18 letters, numbers or _";
  if (RESERVED.has(name)) return "that name is reserved";
  const taken = byName.get(name);
  if (taken && taken.address !== forAddress?.toLowerCase()) return "taken";
  return null;
}

export const profileOf = (address: string) => byAddress.get(address.toLowerCase()) ?? null;
export const profileByName = (name: string) => byName.get(name.toLowerCase()) ?? null;

// the exact text the player signs, the web builds the same string
export const claimMessage = (p: { address: string; username: string; cls: string; body: string; issuedAt: number }) =>
  `benchmon profile\naddress: ${p.address.toLowerCase()}\nusername: ${p.username}\nclass: ${p.cls}\nlook: ${p.body}\nissued: ${p.issuedAt}`;

export async function claim(body: unknown): Promise<Profile | string> {
  const b = body as Record<string, unknown>;
  if (typeof b?.address !== "string" || !isAddress(b.address)) return "bad address";
  if (typeof b.username !== "string") return "bad username";
  const username = b.username.toLowerCase();
  if (typeof b.cls !== "string" || !CLASSES.includes(b.cls)) return "bad class";
  if (b.body !== "male" && b.body !== "female") return "bad look";
  if (typeof b.issuedAt !== "number" || Math.abs(Date.now() - b.issuedAt) > 10 * 60_000) return "signature expired, try again";
  if (typeof b.signature !== "string" || !b.signature.startsWith("0x")) return "bad signature";
  const bad = checkName(username, b.address);
  if (bad) return bad;
  const message = claimMessage({ address: b.address, username, cls: b.cls, body: b.body, issuedAt: b.issuedAt });
  // works for deployed smart accounts (erc-1271) and not yet deployed ones (erc-6492)
  const ok = await pub.verifyMessage({ address: b.address as Address, message, signature: b.signature as Hex }).catch(() => false);
  if (!ok) return "signature does not match this account";

  const address = b.address.toLowerCase();
  const old = byAddress.get(address);
  if (old) byName.delete(old.username);
  const p: Profile = { address, username, cls: b.cls, body: b.body, createdAt: old?.createdAt ?? Date.now() };
  byAddress.set(address, p);
  byName.set(username, p);
  await persist();
  return p;
}

import { createWalletClient, http, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { RPC } from "./chain";

// dev mode: open the app with ?dev (or ?dev=b for a second player) to skip login.
// the choice sticks for the tab, so moving between pages keeps it. each seat gets a throwaway
// key kept in this browser that owns a sponsored smart account like a real player.
// only in the vite dev server, a production build never turns it on.
const params = new URLSearchParams(location.search);
const KEY = "benchmon:dev-seat";
if (import.meta.env.DEV && params.has("dev")) sessionStorage.setItem(KEY, params.get("dev") || "a");
const stored = import.meta.env.DEV ? sessionStorage.getItem(KEY) : null;

export const DEV = stored !== null;
export const SEAT = (stored || "a").toLowerCase().replace(/[^a-z0-9]/g, "") || "a";

function seatKey() {
  const k = `benchmon:dev-key:${SEAT}`;
  let key = localStorage.getItem(k) as `0x${string}` | null;
  if (!key) {
    key = generatePrivateKey();
    localStorage.setItem(k, key);
  }
  return key;
}

export function devSigner() {
  const account = privateKeyToAccount(seatKey());
  return { owner: account.address as Address, wallet: createWalletClient({ account, chain: monadTestnet, transport: http(RPC) }) };
}

export const devUrl = (seat: string) => `${location.origin}/home?dev=${seat}`;

export function leaveDev() {
  sessionStorage.removeItem(KEY);
  location.href = "/";
}

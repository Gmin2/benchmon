import { createWalletClient, http, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { RPC } from "./chain";

// dev mode: open the app with ?dev (or ?dev=b for a second player) to skip login.
// each seat gets a throwaway key kept in this browser, it owns a sponsored smart account like a real player.
// only in the vite dev server, a production build never turns it on.
const params = new URLSearchParams(location.search);
export const DEV = import.meta.env.DEV && params.has("dev");
export const SEAT = (params.get("dev") || "a").toLowerCase().replace(/[^a-z0-9]/g, "") || "a";

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

export function devUrl(seat: string | null) {
  const url = new URL(location.href);
  if (seat === null) url.searchParams.delete("dev");
  else url.searchParams.set("dev", seat);
  return url.toString();
}

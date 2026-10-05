import { join } from "node:path";
import { isAddress, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// process.env is the only source. locally pass the files with bun --env-file (see README), in a container
// the platform sets the vars. nothing here throws on import so scripts can use the read only bits.
const env = (name: string) => {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
};

const addr = (name: string, fallback: string) => (env(name) ?? fallback) as Address;
const key = (name: string) => env(name) as Hex | undefined;

// "0.01" or "0.01mon" is MON, "10000000000000000wei" is wei
export function parseAmount(v: string): bigint {
  const s = v.trim().toLowerCase().replace(/\s+/g, "");
  if (s.endsWith("wei")) return BigInt(s.slice(0, -3));
  return parseEther(s.endsWith("mon") ? s.slice(0, -3) : s);
}

const repoTmp = new URL("../../tmp/duels/", import.meta.url).pathname;

export const config = {
  // alchemy when a key is set, the public rpc caps a client at 15 requests a second
  rpcUrl: env("ALCHEMY_RPC") ?? (env("VITE_ALCHEMY_API_KEY") ? `https://monad-testnet.g.alchemy.com/v2/${env("VITE_ALCHEMY_API_KEY")}` : (env("RPC_URL") ?? "https://testnet-rpc.monad.xyz")),
  port: Number(env("PORT") ?? 8788),
  // one key per onchain role: judge posts verdicts, relayer reveals picks, house runs the markets
  judgeKey: key("JUDGE_KEY"),
  relayerKey: key("RELAYER_KEY"),
  houseKey: key("HOUSE_KEY"),
  // HOUSE=0 runs the backend without seeding markets, otherwise HOUSE may hold the house address as a check
  houseOn: env("HOUSE") !== "0",
  houseSeed: env("HOUSE_SEED") ?? "0.01",
  // only shown in /health, the keeper key is used by scripts/push-stats.ts and never by the server
  statsKeeper: env("STATS_KEEPER"),
  // fighters go through openrouter; kimi is the judge through moonshot directly (kimi bounty), or openrouter without a moonshot key
  openrouterKey: env("OPENROUTER_API_KEY") ?? "",
  moonshotKey: env("MOONSHOT_API_KEY") ?? "",
  moonshotBase: env("MOONSHOT_BASE") ?? "https://api.moonshot.ai/v1",
  judgeModel: env("JUDGE_MODEL") ?? "kimi-k3",
  // picks.json, profiles.json and the duel transcripts
  duelsDir: env("DUELS_DIR") ?? repoTmp,
  allowedOrigins: (env("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://localhost:5174").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean),
  // behind a proxy (azure ingress) the client ip is the last x-forwarded-for hop
  trustProxy: env("TRUST_PROXY") === "1",
  liveDuelMinStake: env("LIVE_DUEL_MIN_STAKE") ?? "0.01",
  liveDuelsPerDay: Number(env("LIVE_DUELS_PER_DAY") ?? 20),
  contracts: {
    cards: addr("CARDS", "0xD27730D0482746B1e0BD702429C2A9AB98d141Fb"),
    duel: addr("DUEL", "0xC110B9Ee0845Ed76D722Ccec3111302D56d1cA61"),
    backing: addr("BACKING", "0x966B8773B281589bFE3E83C7153a64B7E192a9F5"),
    market: addr("MARKET", "0x52CE235DCF1Afa5d4AF427BE9Df039c7797Fa35B"),
    statsFeed: addr("STATS_FEED", "0xB1A2Dc3fC1f20CA0e56Cc016fcc863133196D3d7"),
  },
};

export const file = (name: string) => join(config.duelsDir, name);

// everything the server needs, checked once at boot so a bad deploy dies with one clear message
export function checkServerConfig() {
  const bad: string[] = [];
  const role = (name: string, k: Hex | undefined, expect?: string) => {
    if (!k) return bad.push(`${name}_KEY is missing`);
    if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return bad.push(`${name}_KEY is not a 32 byte hex key`);
    // the plain address var (JUDGE, RELAYER, HOUSE) is optional, when set it has to match the key
    if (expect && isAddress(expect) && privateKeyToAccount(k).address.toLowerCase() !== expect.toLowerCase()) bad.push(`${name}_KEY does not belong to ${name}=${expect}`);
  };
  role("JUDGE", config.judgeKey, env("JUDGE"));
  role("RELAYER", config.relayerKey, env("RELAYER"));
  if (config.houseOn) role("HOUSE", config.houseKey, env("HOUSE"));
  if (!config.openrouterKey) bad.push("OPENROUTER_API_KEY is missing, live duels cannot run without it");
  for (const [k, v] of Object.entries(config.contracts)) if (!isAddress(v)) bad.push(`contract ${k} is not an address: ${v}`);
  if (!Number.isInteger(config.port) || config.port <= 0) bad.push(`PORT is not a port: ${env("PORT")}`);
  if (!Number.isInteger(config.liveDuelsPerDay) || config.liveDuelsPerDay < 0) bad.push("LIVE_DUELS_PER_DAY must be a whole number");
  try {
    parseAmount(config.liveDuelMinStake);
  } catch {
    bad.push(`LIVE_DUEL_MIN_STAKE is not an amount: ${config.liveDuelMinStake}`);
  }
  try {
    parseAmount(config.houseSeed);
  } catch {
    bad.push(`HOUSE_SEED is not an amount: ${config.houseSeed}`);
  }
  if (bad.length) {
    console.error(`backend config is not usable:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
}

import { formatEther, isAddress, parseEther, type Address } from "viem";
import { checkServerConfig, config, file, parseAmount } from "./config";
import { activeSigners, pub, signer } from "./chain";
import { duelAbi, matchMarketAbi } from "./abi";
import { watchLiveDuels, type LiveDuel } from "./watcher";
import { judgeLiveDuel } from "./live";
import { houseLoop } from "./house";
import { liveGuard } from "./guard";
import { rateLimiter } from "./ratelimit";
import { checkName, claim, loadProfiles, profileByName, profileOf } from "./profiles";
import { addPick, loadPicks, parsePick, relayLoop } from "./relay";
import { flushWrites } from "./store";
import { boundedSet, errMsg, life, loop } from "./util";

checkServerConfig();

const MAX_BODY = 16 * 1024;
const LOW_BALANCE = parseEther("0.05");

// cors only for the web origins we know; requests without an origin (curl, health checks) are not browsers
const anyOrigin = config.allowedOrigins.includes("*");
function corsFor(req: Request): Record<string, string> | null {
  const origin = req.headers.get("origin");
  const base = { "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
  if (!origin) return base;
  if (anyOrigin) return { ...base, "access-control-allow-origin": "*" };
  if (config.allowedOrigins.includes(origin.replace(/\/$/, ""))) return { ...base, "access-control-allow-origin": origin };
  return null;
}

// a general bucket for every route, and much smaller ones for the two routes that write
const limits = {
  all: rateLimiter({ burst: 120, perSec: 5 }),
  pick: rateLimiter({ burst: 10, perSec: 0.2 }),
  profile: rateLimiter({ burst: 5, perSec: 0.05 }),
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readBody(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) throw new HttpError(413, "body too large");
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "body too large");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// chain reads for /health are cached so a busy health checker cannot burn the rpc quota
let healthCache: { at: number; status: number; body: unknown } | undefined;
async function health() {
  const ttl = healthCache?.status === 200 ? 10_000 : 3_000;
  if (healthCache && Date.now() - healthCache.at < ttl) return healthCache;
  try {
    const roles = [signer("judge"), signer("relayer"), ...(config.houseOn ? [signer("house")] : [])];
    const watched: { role: string; address: Address }[] = roles.map((s) => ({ role: s.role, address: s.address }));
    if (config.statsKeeper && isAddress(config.statsKeeper)) watched.push({ role: "statsKeeper", address: config.statsKeeper });
    const [block, matches, onchainJudge, marketOwner, ...balances] = await Promise.all([
      pub.getBlockNumber(),
      pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "matchCount" }),
      pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "judge" }),
      pub.readContract({ address: config.contracts.market, abi: matchMarketAbi, functionName: "owner" }),
      ...watched.map((w) => pub.getBalance({ address: w.address })),
    ]);
    const signers = Object.fromEntries(
      watched.map((w, i) => [w.role, { address: w.address, balance: formatEther(balances[i]!), low: balances[i]! < LOW_BALANCE }]),
    );
    const isJudge = onchainJudge.toLowerCase() === signer("judge").address.toLowerCase();
    const isHouse = !config.houseOn || marketOwner.toLowerCase() === signer("house").address.toLowerCase();
    const warnings = [
      ...(isJudge ? [] : ["judge key is not the Duel judge"]),
      ...(isHouse ? [] : ["house key does not own MatchMarket"]),
      ...watched.filter((_, i) => balances[i]! < LOW_BALANCE).map((w) => `${w.role} is under ${formatEther(LOW_BALANCE)} MON`),
    ];
    healthCache = {
      at: Date.now(),
      status: 200,
      body: { ok: true, block: block.toString(), matches: matches.toString(), isJudge, isHouse, house: config.houseOn, signers, lowKeys: watched.some((_, i) => balances[i]! < LOW_BALANCE), warnings },
    };
  } catch (e) {
    healthCache = { at: Date.now(), status: 503, body: { ok: false, error: errMsg(e) } };
  }
  return healthCache;
}

function clientIp(req: Request, server: { requestIP(r: Request): { address: string } | null }) {
  if (config.trustProxy) {
    const xff = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (xff) return xff;
  }
  return server.requestIP(req)?.address ?? "unknown";
}

async function route(req: Request, url: URL, h: Record<string, string>): Promise<Response> {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: h });
  if (url.pathname === "/pick" && req.method === "POST") {
    const p = parsePick(await readBody(req));
    if (typeof p === "string") return json({ ok: false, error: p }, 400);
    const err = await addPick(p);
    return json(err ? { ok: false, error: err } : { ok: true }, err ? 400 : 200);
  }
  // player profiles: claim a username, look one up by name or address, check if a name is free
  if (url.pathname === "/profile" && req.method === "POST") {
    const r = await claim(await readBody(req));
    return typeof r === "string" ? json({ ok: false, error: r }, 400) : json({ ok: true, profile: r });
  }
  const prof = url.pathname.match(/^\/profile\/(@?[\w.]+)$/);
  if (prof) {
    const key = prof[1]!;
    const p = key.startsWith("@") ? profileByName(key.slice(1)) : profileOf(key);
    return p ? json(p) : json({ error: "no profile" }, 404);
  }
  if (url.pathname === "/profiles") {
    const list = (url.searchParams.get("addresses") ?? "").split(",").filter(Boolean).slice(0, 50);
    return json(list.map(profileOf).filter(Boolean));
  }
  const name = url.pathname.match(/^\/username\/([^/]+)$/);
  if (name) {
    const err = checkName(decodeURIComponent(name[1]!).toLowerCase(), url.searchParams.get("for") ?? undefined);
    return json({ free: !err, reason: err });
  }
  // the card stats the chainlink workflow reads, built by scripts/stats.ts
  if (url.pathname === "/stats") {
    const f = Bun.file(new URL("../data/stats.json", import.meta.url).pathname);
    if (!(await f.exists())) return json({ error: "no stats built yet" }, 404);
    return new Response(f, { headers: { ...h, "content-type": "application/json" } });
  }
  // the live duel transcript: prompt, both answers, timing, cost and the verdict reason
  const duel = url.pathname.match(/^\/duel\/(\d+)$/);
  if (duel) {
    const f = Bun.file(file(`${duel[1]}.json`));
    if (!(await f.exists())) return json({ error: "no transcript yet" }, 404);
    return new Response(f, { headers: { ...h, "content-type": "application/json" } });
  }
  if (url.pathname === "/health") {
    const r = await health();
    return json(r.body, r.status);
  }
  return new Response("not found", { status: 404, headers: h });
}

// loaded before the server takes requests, a write before the load would wipe the file
await loadPicks();
await loadProfiles();

const server = Bun.serve({
  port: config.port,
  maxRequestBodySize: MAX_BODY,
  async fetch(req, srv) {
    const url = new URL(req.url);
    const h = corsFor(req);
    if (!h) return new Response("origin not allowed", { status: 403 });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    const ip = clientIp(req, srv);
    const post = req.method === "POST";
    const limited = !limits.all(ip) || (post && url.pathname === "/pick" && !limits.pick(ip)) || (post && url.pathname === "/profile" && !limits.profile(ip));
    if (limited) return Response.json({ ok: false, error: "slow down" }, { status: 429, headers: { ...h, "retry-after": "5" } });
    try {
      return await route(req, url, h);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ ok: false, error: e.message }, { status: e.status, headers: h });
      console.error(`${req.method} ${url.pathname}: ${errMsg(e)}`);
      return Response.json({ ok: false, error: "server error" }, { status: 500, headers: h });
    }
  },
});

console.log(`backend on :${server.port}, judge ${signer("judge").address}, relayer ${signer("relayer").address}${config.houseOn ? `, house ${signer("house").address}` : ", house off"}, data in ${config.duelsDir}`);

// live duels below the min stake, or for a player past the daily cap, get no model calls. Duel then lets
// anyone settle the round by stats once VERDICT_TIMEOUT has passed
const guard = liveGuard({ minStake: parseAmount(config.liveDuelMinStake), perDay: config.liveDuelsPerDay });
const judging = new Set<string>();
// skipped by the guard, or given up after three tries: never spend model calls on these again
const left = boundedSet(2000);

// a model or the judge can fail for a moment, so try a few times before leaving it to settleLiveByStats
async function handle(d: LiveDuel) {
  const key = d.id.toString();
  if (judging.has(key) || left.has(key) || life.stopping) return;
  judging.add(key);
  try {
    let checked = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const m = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [d.id] });
        if (!m.awaitingVerdict) return;
        if (!checked) {
          checked = true;
          const why = guard.check(m);
          if (why) {
            left.add(key);
            console.log(`live duel ${d.id} left to stats: ${why}`);
            return;
          }
          console.log(`live duel ${d.id}: card ${d.cardA} vs ${d.cardB}, arena ${d.arena}, stake ${formatEther(m.stake)} MON`);
        }
        const r = await judgeLiveDuel(d, m);
        console.log(`match ${d.id} settled`, r);
        return;
      } catch (e) {
        console.error(`duel ${d.id} attempt ${attempt} failed: ${errMsg(e)}`);
        if (attempt < 3) await Bun.sleep(attempt * 5000);
      }
    }
    left.add(key);
  } finally {
    judging.delete(key);
  }
}

// duels that went live while the backend was down, or whose event the watcher missed, still wait for a verdict
async function catchUp(scan = 50n) {
  const count = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "matchCount" });
  for (let id = count - 1n; id >= 0n && id >= count - scan; id--) {
    if (judging.has(id.toString()) || left.has(id.toString())) continue;
    const m = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [id] });
    if (m.awaitingVerdict) handle({ id, cardA: m.cardA, cardB: m.cardB, arena: m.arena, block: 0n }).catch((e) => console.error(`duel ${id} failed: ${errMsg(e)}`));
  }
}

async function shutdown(sig: string) {
  if (life.stopping) return;
  life.stopping = true;
  console.log(`${sig}: stopping loops, waiting for pending txs and writes`);
  server.stop();
  const pending = Promise.all([flushWrites(), ...activeSigners().map((s) => s.idle())]);
  await Promise.race([pending, Bun.sleep(20_000)]);
  await flushWrites();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

watchLiveDuels(handle);
loop("catch up", catchUp, 60_000);
relayLoop();
if (config.houseOn) houseLoop();

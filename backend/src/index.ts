import { config } from "./config";
import { judge, pub } from "./chain";
import { duelAbi } from "./abi";
import { watchLiveDuels } from "./watcher";
import { judgeLiveDuel } from "./live";
import { addPick, loadPicks, parsePick, relayLoop } from "./relay";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/pick" && req.method === "POST") {
      const p = parsePick(await req.json().catch(() => null));
      if (typeof p === "string") return Response.json({ ok: false, error: p }, { status: 400, headers: cors });
      const err = await addPick(p);
      return Response.json(err ? { ok: false, error: err } : { ok: true }, { status: err ? 400 : 200, headers: cors });
    }
    // the card stats the chainlink workflow reads, built by scripts/stats.ts
    if (url.pathname === "/stats") {
      const f = Bun.file(new URL("../data/stats.json", import.meta.url).pathname);
      if (!(await f.exists())) return Response.json({ error: "no stats built yet" }, { status: 404, headers: cors });
      return new Response(f, { headers: { ...cors, "content-type": "application/json" } });
    }
    if (url.pathname === "/health") {
      const [block, matches, onchainJudge] = await Promise.all([
        pub.getBlockNumber(),
        pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "matchCount" }),
        pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "judge" }),
      ]);
      return Response.json({
        ok: true,
        block: block.toString(),
        matches: matches.toString(),
        judge: judge.address,
        isJudge: onchainJudge.toLowerCase() === judge.address.toLowerCase(),
      });
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`backend on :${server.port}, judge ${judge.address}`);

watchLiveDuels(async (d) => {
  console.log(`live duel ${d.id}: card ${d.cardA} vs ${d.cardB}, arena ${d.arena}, block ${d.block}`);
  const r = await judgeLiveDuel(d);
  console.log(`match ${d.id} settled`, r);
});

await loadPicks();
relayLoop();

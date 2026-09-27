import { config } from "./config";
import { judge, pub } from "./chain";
import { duelAbi } from "./abi";
import { watchLiveDuels } from "./watcher";
import { judgeLiveDuel } from "./live";

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
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

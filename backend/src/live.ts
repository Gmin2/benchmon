import { mkdir } from "node:fs/promises";
import { duelAbi } from "./abi";
import { pub } from "./chain";
import { config } from "./config";
import { runDuel } from "./duel";
import { chatModel, type Model } from "./models";
import { POOL_HASH } from "./prompts";
import { ROSTER } from "./roster";
import { settle } from "./settle";
import type { LiveDuel } from "./watcher";

function fighter(card: number): Model {
  const r = ROSTER[card];
  if (!r) throw new Error(`card ${card} has no model`);
  return chatModel({ baseUrl: "https://openrouter.ai/api/v1", apiKey: config.openrouterKey, model: r.openrouter, name: r.name, reasoning: r.reasoning });
}

// kimi judges. straight from moonshot when a key is set, otherwise kimi through openrouter
const judge = () =>
  config.moonshotKey
    ? chatModel({ baseUrl: config.moonshotBase, apiKey: config.moonshotKey, model: config.judgeModel, name: "kimi" })
    : chatModel({ baseUrl: "https://openrouter.ai/api/v1", apiKey: config.openrouterKey, model: "moonshotai/kimi-k3", name: "kimi" });

// runs the real duel, keeps the full transcript, and posts the verdict with the transcript hash
export async function judgeLiveDuel(d: LiveDuel) {
  const m = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [d.id] });
  const result = await runDuel(d.arena, m.seed, fighter(d.cardA), fighter(d.cardB), judge());
  const transcript = JSON.stringify({ match: d.id.toString(), poolHash: POOL_HASH, seed: m.seed, arena: d.arena, ...result });
  await mkdir(config.duelsDir, { recursive: true });
  await Bun.write(`${config.duelsDir}${d.id}.json`, transcript);
  console.log(`duel ${d.id}: ${result.prompt.id}, a ${result.a.model} "${result.a.text.slice(0, 60)}", b ${result.b.model} "${result.b.text.slice(0, 60)}" -> ${result.outcome} (${result.reason})`);
  return settle(d.id, { outcome: result.outcome, transcript });
}

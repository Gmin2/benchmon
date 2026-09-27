// runs one duel with real models off chain: bun scripts/try-duel.ts <arena> <cardA> <cardB> [seed]
import { config } from "../src/config";
import { runDuel } from "../src/duel";
import { chatModel } from "../src/models";
import { ROSTER } from "../src/roster";

const [arena, ca, cb, seed] = [Number(Bun.argv[2] ?? 5), Number(Bun.argv[3] ?? 0), Number(Bun.argv[4] ?? 3), (Bun.argv[5] ?? "0x00") as `0x${string}`];
const or = (id: string, name: string, reasoning?: Record<string, unknown>) => chatModel({ baseUrl: "https://openrouter.ai/api/v1", apiKey: config.openrouterKey, model: id, name, reasoning });
const r = await runDuel(arena, seed, or(ROSTER[ca]!.openrouter, ROSTER[ca]!.name, ROSTER[ca]!.reasoning), or(ROSTER[cb]!.openrouter, ROSTER[cb]!.name, ROSTER[cb]!.reasoning), or("moonshotai/kimi-k3", "kimi"));
console.log(`prompt: ${r.prompt.text}`);
console.log(`\na ${r.a.model} (${r.a.ms.toFixed(0)}ms, $${r.a.costUsd.toFixed(6)}):\n${r.a.text}`);
console.log(`\nb ${r.b.model} (${r.b.ms.toFixed(0)}ms, $${r.b.costUsd.toFixed(6)}):\n${r.b.text}`);
console.log(`\noutcome ${r.outcome} (${r.reason})`, r.judge ? `judge first order ${r.judge.first}, swapped order ${r.judge.second}` : "");

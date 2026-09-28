// measures output speed for every roster model: 3 calls on the same prompt, median completion tokens per second.
// writes data/speed.json. usage: bun --env-file=../.env --env-file=.env scripts/measure-speed.ts
import { config } from "../src/config";
import roster from "../src/roster.json";

const PROMPT = "List five facts about the planet Mars, one short sentence each.";

async function once(model: string, reasoning: Record<string, unknown>) {
  const t0 = performance.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${config.openrouterKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 1500, reasoning, messages: [{ role: "user", content: PROMPT }] }),
  });
  const s = (performance.now() - t0) / 1000;
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const j = (await res.json()) as { choices: { message: { content: string }; finish_reason: string }[]; usage: { completion_tokens: number; cost?: number } };
  return { tps: j.usage.completion_tokens / s, s, tokens: j.usage.completion_tokens, chars: j.choices[0]?.message.content?.length ?? 0, finish: j.choices[0]?.finish_reason, cost: j.usage.cost ?? 0 };
}

const out: Record<number, { tps: number; runs: number[] }> = {};
let spend = 0;
for (const r of roster) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    try {
      const x = await once(r.openrouter, r.reasoning);
      spend += x.cost;
      runs.push(x);
    } catch (e) {
      console.log(`${r.name}: ${(e as Error).message}`);
    }
  }
  const tps = runs.map((x) => x.tps).sort((a, b) => a - b);
  const med = tps[Math.floor(tps.length / 2)] ?? NaN;
  out[r.id] = { tps: med, runs: tps.map((t) => Math.round(t)) };
  const last = runs[runs.length - 1];
  console.log(`${String(r.id).padStart(2)} ${r.name.padEnd(20)} ${med.toFixed(0).padStart(4)} tok/s  runs ${out[r.id]!.runs.join(",")}  answer ${last?.chars ?? 0} chars, ${last?.finish}`);
}
await Bun.write(new URL("../data/speed.json", import.meta.url).pathname, JSON.stringify({ measuredAt: new Date().toISOString(), prompt: PROMPT, speed: out }, null, 2));
console.log(`spent $${spend.toFixed(4)}`);

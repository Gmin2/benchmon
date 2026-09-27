// asks every roster model and the judge one checkable question, prints answer, latency and cost
import { config } from "../src/config";
import { chatModel } from "../src/models";
import { ROSTER } from "../src/roster";

const q = Bun.argv[2] ?? "What is 17 * 23? Reply with the number only.";
const models = [
  ...Object.values(ROSTER).map((r) => ({ name: r.name, id: r.openrouter, reasoning: r.reasoning })),
  { name: "kimi (judge)", id: "moonshotai/kimi-k3", reasoning: undefined as Record<string, unknown> | undefined },
];
for (const m of models) {
  const model = chatModel({ baseUrl: "https://openrouter.ai/api/v1", apiKey: config.openrouterKey, model: m.id, name: m.name, reasoning: m.reasoning });
  try {
    const r = await model.ask(q);
    console.log(`${m.name.padEnd(14)} ${m.id.padEnd(32)} "${r.text.replace(/\s+/g, " ").slice(0, 70)}" (${r.text.length} chars, ${r.finish})  ${r.ms.toFixed(0)}ms  $${r.costUsd.toFixed(6)}`);
  } catch (e) {
    console.log(`${m.name.padEnd(14)} ${m.id.padEnd(32)} ERROR ${(e as Error).message.slice(0, 200)}`);
  }
}

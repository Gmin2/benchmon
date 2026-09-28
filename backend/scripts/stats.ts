// builds data/stats.json from live arena data, openrouter prices and data/speed.json. fails if any card lacks a value.
import { collectRaw, computeStats, STATS } from "../src/stats";
import roster from "../src/roster.json";

const speedFile = (await Bun.file(new URL("../data/speed.json", import.meta.url).pathname).json()) as { measuredAt: string; speed: Record<string, { tps: number }> };
const speed = Object.fromEntries(Object.entries(speedFile.speed).map(([id, v]) => [Number(id), v.tps]));
const { raw, missing, estimated, published } = await collectRaw(speed);
if (missing.length) throw new Error(`missing values: ${missing.join(", ")}`);
const stats = computeStats(raw);

const out = {
  builtAt: new Date().toISOString(),
  sources: {
    arena: { dataset: "lmarena-ai/leaderboard-dataset (cc-by-4.0)", published: published.arena, code: "text_style_control coding", math: "text_style_control math", reasoning: "text_style_control hard_prompts" },
    honesty: { dataset: "lmarena-ai/leaderboard-dataset text_factuality overall", published: published.factuality },
    cost: "openrouter /api/v1/models, usd per million tokens, 3 input to 1 output",
    speed: `measured by benchmon on openrouter, median of 5 runs, ${speedFile.measuredAt}`,
  },
  estimated,
  statOrder: STATS,
  cards: roster.map((r, i) => ({ id: r.id, name: r.name, lab: r.lab, stats: stats[i], power: stats[i]!.reduce((a, b) => a + b, 0), raw: raw[i] })),
};
await Bun.write(new URL("../data/stats.json", import.meta.url).pathname, JSON.stringify(out, null, 2));
for (const c of out.cards) console.log(`${String(c.id).padStart(2)} ${c.name.padEnd(20)} ${c.stats.join(",").padEnd(18)} power ${c.power}`);
const powers = out.cards.map((c) => c.power).sort((a, b) => b - a);
console.log(`power: max ${powers[0]}, min ${powers[powers.length - 1]}, top five sum ${powers.slice(0, 5).reduce((a, b) => a + b, 0)}, all fifteen avg ${Math.round(powers.reduce((a, b) => a + b, 0) / 15)}`);

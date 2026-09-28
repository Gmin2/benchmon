import { parquetReadObjects } from "hyparquet";
import roster from "./roster.json";

// turns public benchmark data into the six card stats. every stat is a 1 to 99 rank inside the roster,
// so the cards stay balanced against each other and move when the sources move.
export type Entry = (typeof roster)[number];
export type Raw = { code: number; math: number; reasoning: number; speed: number; cost: number; honesty: number };
export const STATS = ["code", "math", "reasoning", "speed", "cost", "honesty"] as const;

const ARENA = "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main";

async function arenaTable(config: string) {
  const res = await fetch(`${ARENA}/${config}/latest-00000-of-00001.parquet`);
  if (!res.ok) throw new Error(`arena ${config} ${res.status}`);
  const rows = (await parquetReadObjects({ file: await res.arrayBuffer() })) as { model_name: string; category: string; rating: number; leaderboard_publish_date: string }[];
  const at = (name: string, category: string) => rows.find((r) => r.model_name === name && r.category === category)?.rating;
  return { at, published: rows[0]?.leaderboard_publish_date ?? "" };
}

// usd per million tokens, weighted 3 input to 1 output like most price comparisons
async function openrouterPrices() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const j = (await res.json()) as { data: { id: string; pricing: { prompt: string; completion: string } }[] };
  return (id: string) => {
    const m = j.data.find((d) => d.id === id);
    if (!m) return undefined;
    return ((3 * Number(m.pricing.prompt) + Number(m.pricing.completion)) / 4) * 1e6;
  };
}

// rank inside the roster mapped to 1..99; higher raw is better unless lowerIsBetter
export function toStat(values: number[], lowerIsBetter = false): number[] {
  const n = values.length;
  return values.map((v) => {
    const below = values.filter((x) => (lowerIsBetter ? x > v : x < v)).length;
    const ties = values.filter((x) => x === v).length - 1;
    const pos = (below + ties / 2) / Math.max(1, n - 1);
    return Math.max(1, Math.min(99, Math.round(1 + pos * 98)));
  });
}

export async function collectRaw(speed: Record<number, number>) {
  const [sc, fact, price] = await Promise.all([arenaTable("text_style_control"), arenaTable("text_factuality"), openrouterPrices()]);
  const missing: string[] = [];
  const estimated: string[] = [];
  const raw = roster.map((r) => {
    const fallbacks = (r as { fallbacks?: Partial<Record<keyof Raw, string>> }).fallbacks ?? {};
    const need = (v: number | undefined, what: string) => {
      if (v === undefined || Number.isNaN(v)) missing.push(`${r.name} ${what}`);
      return v ?? NaN;
    };
    // a new model can be missing a category for a few days; a named fallback (its predecessor) fills it and is reported
    const arena = (table: typeof sc, stat: keyof Raw, category: string) => {
      const own = table.at(r.arena, category);
      if (own !== undefined) return own;
      const fb = fallbacks[stat];
      if (fb === undefined) return undefined;
      estimated.push(`${r.name} ${stat} from ${fb}`);
      return table.at(fb, category);
    };
    return {
      code: need(arena(sc, "code", "coding"), "arena coding"),
      math: need(arena(sc, "math", "math"), "arena math"),
      reasoning: need(arena(sc, "reasoning", "hard_prompts"), "arena hard_prompts"),
      speed: need(speed[r.id], "measured speed"),
      cost: need(price(r.openrouter), "openrouter price"),
      honesty: need(arena(fact, "honesty", "overall"), "arena factuality"),
    } satisfies Raw;
  });
  return { raw, missing, estimated, published: { arena: sc.published, factuality: fact.published } };
}

export function computeStats(raw: Raw[]) {
  const cols = STATS.map((k) => toStat(raw.map((r) => r[k]), k === "cost"));
  return raw.map((_, i) => STATS.map((_, j) => cols[j]![i]!) as [number, number, number, number, number, number]);
}

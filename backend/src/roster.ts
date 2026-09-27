// which real model each card id fights with. openrouter ids checked against /api/v1/models on sept 28 2026.
// reasoning per model, from live calls that day: claude opus 5.5 and gemini 3.8 flash refuse reasoning off
// ("reasoning is mandatory"), deepseek ignores effort low and burns the whole token budget, so it runs with
// reasoning off. every setting still has to produce a visible answer inside the same token budget.
export type Fighter = { name: string; openrouter: string; reasoning: Record<string, unknown> };

export const ROSTER: Record<number, Fighter> = {
  0: { name: "claude-opus", openrouter: "anthropic/claude-opus-5.5", reasoning: { effort: "low" } },
  1: { name: "deepseek", openrouter: "deepseek/deepseek-v4.1-flash", reasoning: { enabled: false } },
  2: { name: "gemini-flash", openrouter: "google/gemini-3.8-flash", reasoning: { effort: "low" } },
  3: { name: "llama", openrouter: "meta-llama/llama-4-maverick", reasoning: { enabled: false } },
  4: { name: "gpt-mini", openrouter: "openai/gpt-5.6-luna", reasoning: { enabled: false } },
};

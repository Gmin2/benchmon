// which real model each card id fights with. openrouter ids checked against /api/v1/models on sept 28 2026.
// the demo roster onchain today is cards 0 to 4; the data pipeline will replace this with the full set.
export const ROSTER: Record<number, { name: string; openrouter: string }> = {
  0: { name: "claude-opus", openrouter: "anthropic/claude-opus-5.5" },
  1: { name: "deepseek", openrouter: "deepseek/deepseek-v4.1-flash" },
  2: { name: "gemini-flash", openrouter: "google/gemini-3.8-flash" },
  3: { name: "llama", openrouter: "meta-llama/llama-4-maverick" },
  4: { name: "gpt-mini", openrouter: "openai/gpt-5.6-luna" },
};

// the 15 card roster as of the last stats build (backend/data/stats.json), for screens that run on mock data
import type { Card } from "./chain";

export const ROSTER: Card[] = [
  { id: 0, name: "claude-opus-5.5", stats: [92, 85, 99, 8, 15, 99] },
  { id: 1, name: "deepseek-v4.1-flash", stats: [64, 78, 43, 64, 99, 57] },
  { id: 2, name: "gemini-3.8-flash", stats: [57, 92, 78, 1, 64, 78] },
  { id: 3, name: "hy3", stats: [22, 29, 22, 22, 92, 15] },
  { id: 4, name: "gpt-5.6-luna", stats: [15, 22, 15, 57, 85, 29] },
  { id: 5, name: "claude-fable-5", stats: [99, 99, 92, 15, 5, 92] },
  { id: 6, name: "kimi-k3", stats: [71, 71, 85, 85, 22, 64] },
  { id: 7, name: "gpt-6-astra", stats: [78, 36, 50, 43, 5, 36] },
  { id: 8, name: "glm-5.3", stats: [43, 64, 64, 78, 50, 43] },
  { id: 9, name: "qwen3.8-max", stats: [36, 57, 36, 29, 40, 50] },
  { id: 10, name: "grok-4.20", stats: [29, 15, 29, 99, 57, 22] },
  { id: 11, name: "gpt-5.6-sol", stats: [50, 50, 71, 50, 29, 71] },
  { id: 12, name: "mimo-v2.6-pro", stats: [85, 43, 57, 36, 71, 85] },
  { id: 13, name: "minimax-m3", stats: [8, 8, 8, 71, 78, 8] },
  { id: 14, name: "mistral-medium-3.5", stats: [1, 1, 1, 92, 40, 1] },
];

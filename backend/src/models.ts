// a fighter or judge: sends one prompt, returns the text, latency and cost
export type Reply = { text: string; ms: number; costUsd: number; finish?: string };

export interface Model {
  name: string;
  ask(prompt: string, system?: string): Promise<Reply>;
}

type ChatOpts = {
  baseUrl: string;
  apiKey: string;
  model: string;
  name: string;
  inPerM?: number;
  outPerM?: number;
  // openrouter reasoning settings; fighters run with it off so every model answers under the same rules
  reasoning?: Record<string, unknown>;
};

// any openai compatible chat endpoint: openrouter for the fighters, moonshot for kimi
export function chatModel(o: ChatOpts): Model {
  return {
    name: o.name,
    async ask(prompt, system) {
      const t0 = performance.now();
      const res = await fetch(`${o.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${o.apiKey}`, "content-type": "application/json" },
        // a hung provider must not hold the duel past the verdict timeout
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          model: o.model,
          temperature: 0,
          // reasoning models spend hidden tokens before answering; some ignore effort low and use the whole budget
          max_tokens: 1500,
          ...(o.reasoning ? { reasoning: o.reasoning } : {}),
          messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
        }),
      });
      const ms = performance.now() - t0;
      if (!res.ok) throw new Error(`${o.name} ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = (await res.json()) as {
        choices: { message: { content: string }; finish_reason?: string }[];
        usage?: { prompt_tokens: number; completion_tokens: number; cost?: number };
      };
      const u = j.usage;
      const costUsd = u?.cost ?? (u ? (u.prompt_tokens * (o.inPerM ?? 0) + u.completion_tokens * (o.outPerM ?? 0)) / 1e6 : 0);
      return { text: j.choices[0]?.message.content?.trim() ?? "", ms, costUsd, finish: j.choices[0]?.finish_reason };
    },
  };
}

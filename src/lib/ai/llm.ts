// LLM provider abstraction.
// - "zai": managed model (used for the hosted demo; backend-only SDK)
// - "ollama": fully offline local model via Ollama (college deployment)
import ZAI from "z-ai-web-dev-sdk";
import { ensureZaiConfig } from "./zai-config";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  json?: boolean; // request strict JSON output
}

export async function chatComplete(
  messages: ChatTurn[],
  opts: ChatOptions = {}
): Promise<string> {
  const provider = (process.env.AI_PROVIDER || "zai").toLowerCase();

  if (provider === "ollama") {
    const url = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    const model = process.env.OLLAMA_MODEL || "gemma2:9b";
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: opts.json ? "json" : undefined,
        options: {
          temperature: opts.temperature ?? 0.7,
          num_predict: 500,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "";
    if (!content.trim()) throw new Error("Ollama returned an empty response");
    return content.trim();
  }

  // Default: managed demo model
  ensureZaiConfig();
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });
  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("LLM returned an empty response");
  return content.trim();
}

/** Extract the first JSON object from a model reply (handles code fences / chatter). */
export function extractJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json/gi, "```").trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidates = [fenced?.[1], cleaned].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      // try next candidate
    }
  }
  return null;
}

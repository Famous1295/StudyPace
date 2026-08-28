/** Server-only helpers that talk to the AI provider chosen by the signed-in user. */

import { firstModel, getProvider, type AIProviderId } from "@/lib/ai-providers";

export const NO_AI_KEY_MESSAGE =
  "Add your free OpenRouter API key in My profile → AI API key to use the AI features (openrouter.ai/keys).";


export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICreds {
  provider: AIProviderId;
  apiKey: string;
  model?: string | null;
}

/** OpenRouter's catalogue changes often, so resolve a model the key can actually use. */
const PREFERRED_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];
const modelCache = new Map<string, string>();

async function resolveModel(apiKey: string, fallback: string): Promise<string> {
  const cacheKey = apiKey.slice(-8);
  const cached = modelCache.get(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { data?: { id?: string }[] };
    const ids = (json.data ?? []).map((m) => m.id).filter(Boolean) as string[];
    const usable = (id: string) => !/whisper|tts|guard|embed|vision-only|image/i.test(id);
    const pick =
      PREFERRED_MODELS.find((m) => ids.includes(m)) ??
      ids.find((id) => id.endsWith(":free") && usable(id)) ??
      ids.find(usable);
    if (pick) modelCache.set(cacheKey, pick);
    return pick ?? fallback;
  } catch {
    return fallback;
  }
}

export async function callAI(messages: AIMessage[], creds?: AICreds): Promise<string> {
  if (!creds?.apiKey) throw new Error(NO_AI_KEY_MESSAGE);
  const info = getProvider(creds.provider);
  const endpoint = info.url;
  const apiKey = creds.apiKey;
  const model = await resolveModel(apiKey, firstModel(info));


  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Your saved AI API key was rejected. Check it in My profile.");
  }
  if (res.status === 429) throw new Error("AI rate limit reached — please try again in a minute.");
  if (res.status === 402) throw new Error("Your AI provider account is out of credit.");

  if (!res.ok) {
    const detail = await res.text();
    console.error("AI provider error", info.id, model, res.status, detail);
    let message = detail.slice(0, 300);
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } | string };
      const inner = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
      if (inner) message = inner;
    } catch {
      /* keep raw text */
    }
    if (res.status === 404 || /model/i.test(message)) {
      throw new Error(
        `${info.label} rejected the model "${model}": ${message}. Pick a different model in My profile → AI API key.`,
      );
    }
    throw new Error(`${info.label} error (${res.status}): ${message}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI service returned an empty response.");
  return content.trim();
}

/** Asks the model for JSON and parses it, tolerating ```json fences. */
export async function callAIJson<T>(messages: AIMessage[], creds?: AICreds): Promise<T> {
  const raw = await callAI(messages, creds);
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(slice) as T;
  } catch {
    throw new Error("The AI response could not be understood. Please try again.");
  }
}

export const SYSTEM_PROMPTS = {
  assignment:
    "You are an academic assignment coach for engineering students. Help the student plan and structure their assignment: outline, key sections, references to look for, and a realistic time split. Never write the full assignment for them — guide, do not ghost-write. Keep answers under 250 words, use short markdown bullets.",
  doubt:
    "You are a patient engineering tutor. Explain the student's doubt clearly from first principles, with one worked example or analogy. Keep it under 250 words and use short markdown bullets or numbered steps.",
  exam: "You are an exam-preparation and marks advisor for engineering students. Give concrete revision strategy, topic prioritisation and marks-improvement advice based on the context provided. Keep it under 250 words with short markdown bullets.",
} as const;

export type AICategory = keyof typeof SYSTEM_PROMPTS;

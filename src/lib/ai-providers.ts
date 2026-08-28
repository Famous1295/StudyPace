/** Studypace uses a single AI provider: OpenRouter — the model is picked automatically. */

export type AIProviderId = "openrouter";

export interface AIProviderInfo {
  id: AIProviderId;
  label: string;
  /** OpenAI-compatible chat-completions endpoint. */
  url: string;
  models: { id: string; label: string; free?: boolean }[];
  keyUrl: string;
  keyHint: string;
  freeTier: string;
}

/** Used only as a last-resort fallback — the real model is resolved from the key. */
export const AI_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export const OPENROUTER_PROVIDER: AIProviderInfo = {
  id: "openrouter",
  label: "OpenRouter",
  url: "https://openrouter.ai/api/v1/chat/completions",
  models: [{ id: AI_MODEL, label: "Auto (best free model)", free: true }],
  keyUrl: "https://openrouter.ai/keys",
  keyHint: "sk-or-v1-…",
  freeTier:
    "OpenRouter gives free access to many open models. Sign in at openrouter.ai, open Keys → “Create Key”, name it anything (no model needed — Studypace fetches and picks one automatically) and paste the key here.",
};

export const AI_PROVIDERS: AIProviderInfo[] = [OPENROUTER_PROVIDER];

export const AI_PROVIDER_IDS = ["openrouter"] as [AIProviderId, ...AIProviderId[]];

export function getProvider(_id?: string): AIProviderInfo {
  return OPENROUTER_PROVIDER;
}

export function firstModel(_info?: AIProviderInfo): string {
  return AI_MODEL;
}

export function defaultModel(_id?: string): string {
  return AI_MODEL;
}

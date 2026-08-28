import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_PROVIDER_IDS, AI_MODEL, getProvider, type AIProviderId } from "@/lib/ai-providers";

export interface AIKeyStatus {
  provider: AIProviderId | null;
  model: string | null;
  masked: string | null;
}

function mask(key: string) {
  return key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export const getMyAIKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AIKeyStatus> => {
    const { data } = await context.supabase
      .from("user_ai_keys")
      .select("provider, api_key, model")
      .maybeSingle();
    if (!data) return { provider: null, model: null, masked: null };
    const row = data as { provider: string; api_key: string; model: string | null };
    const info = getProvider(row.provider);
    return {
      provider: info.id,
      model: AI_MODEL,
      masked: mask(row.api_key),
    };
  });

export const saveMyAIKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        provider: z.enum(AI_PROVIDER_IDS),
        model: z.string().min(1).max(120),
        apiKey: z.string().min(15).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_ai_keys").upsert(
      {
        user_id: context.userId,
        provider: data.provider,
        model: data.model,
        api_key: data.apiKey.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const deleteMyAIKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_ai_keys")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

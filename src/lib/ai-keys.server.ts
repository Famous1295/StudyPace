import type { SupabaseClient } from "@supabase/supabase-js";
import type { AICreds } from "@/lib/ai.server";
import { AI_MODEL, getProvider, type AIProviderId } from "@/lib/ai-providers";

/** Reads the signed-in user's own AI key (RLS scopes it to their row). */
export async function loadUserAICreds(
  supabase: SupabaseClient<never>,
): Promise<AICreds | undefined> {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        maybeSingle: () => Promise<{
          data: { provider: string; api_key: string; model: string | null } | null;
        }>;
      };
    };
  };
  try {
    const { data } = await client
      .from("user_ai_keys")
      .select("provider, api_key, model")
      .maybeSingle();
    if (!data?.api_key) return undefined;
    const info = getProvider(data.provider);
    return {
      provider: info.id as AIProviderId,
      apiKey: data.api_key,
      model: AI_MODEL,
    };
  } catch {
    return undefined;
  }
}

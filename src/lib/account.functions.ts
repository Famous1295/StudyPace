import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the signed-in user's account and all owned data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: guestRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "guest")
      .maybeSingle();
    if (guestRole) throw new Error("The demo account cannot be deleted.");

    const { disconnectTelegramForUser } = await import("@/lib/telegram.server");
    await disconnectTelegramForUser(context.userId);

    const { disconnectTwilioForUser } = await import("@/lib/twilio.server");
    await disconnectTwilioForUser(context.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

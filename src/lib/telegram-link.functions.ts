import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Disconnects the signed-in user's Telegram chat and issues a fresh link code. */
export const disconnectMyTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { unlinkTelegramForUser } = await import("@/lib/telegram.server");
    return unlinkTelegramForUser(context.userId, "app");
  });

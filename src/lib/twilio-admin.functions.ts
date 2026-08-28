import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  message: z.string().min(1).max(3000),
  userIds: z.array(z.string().uuid()).max(500),
});

export interface TwilioRecipient {
  id: string;
  full_name: string | null;
  email: string | null;
  connected: boolean;
}

export const adminListTwilioRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TwilioRecipient[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, twilio_chat_id")
      .order("full_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id as string,
      full_name: (p.full_name as string | null) ?? null,
      email: (p.email as string | null) ?? null,
      connected: p.twilio_chat_id != null,
    }));
  });

export const adminSendTwilio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTwilioMessage } = await import("@/lib/twilio.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, twilio_chat_id")
      .not("twilio_chat_id", "is", null);
    if (data.userIds.length) query = query.in("id", data.userIds);

    const { data: rows, error } = await query.limit(1000);
    if (error) throw new Error(error.message);

    let sent = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      const chatId = row.twilio_chat_id as string | null;
      if (!chatId) continue;
      const res = await sendTwilioMessage(chatId, data.message);
      if (res.sent) sent++;
      else failed++;
    }

    await writeAudit(
      context.supabase,
      context.userId,
      "Twilio Broadcast",
      data.userIds.length ? `${data.userIds.length} selected user(s)` : "All connected users",
      `Sent: ${sent}, failed: ${failed}`,
    );

    return { sent, failed, total: (rows ?? []).length };
  });

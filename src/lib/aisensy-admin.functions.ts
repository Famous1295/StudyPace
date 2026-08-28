import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  message: z.string().min(1).max(3000),
  userIds: z.array(z.string().uuid()).max(500),
});

export interface AiSensyRecipient {
  id: string;
  full_name: string | null;
  email: string | null;
  connected: boolean;
}

export const adminListAiSensyRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiSensyRecipient[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, aisensy_chat_id")
      .order("full_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id as string,
      full_name: (p.full_name as string | null) ?? null,
      email: (p.email as string | null) ?? null,
      connected: p.aisensy_chat_id != null,
    }));
  });

export const adminSendAiSensy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendAiSensyMessage } = await import("@/lib/aisensy.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, aisensy_chat_id")
      .not("aisensy_chat_id", "is", null);
    if (data.userIds.length) query = query.in("id", data.userIds);

    const { data: rows, error } = await query.limit(1000);
    if (error) throw new Error(error.message);

    let sent = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      const phone = row.aisensy_chat_id as string | null;
      if (!phone) continue;
      const res = await sendAiSensyMessage(phone, row.full_name ?? "", [data.message]);
      if (res.sent) sent++;
      else failed++;
    }

    await writeAudit(
      context.supabase,
      context.userId,
      "AiSensy Broadcast",
      data.userIds.length ? `${data.userIds.length} selected user(s)` : "All connected users",
      `Sent: ${sent}, failed: ${failed}`,
    );

    return { sent, failed, total: (rows ?? []).length };
  });

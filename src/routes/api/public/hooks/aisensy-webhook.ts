import { createFileRoute } from "@tanstack/react-router";
import { sendAiSensyMessage } from "@/lib/aisensy.server";

async function handle(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // AiSensy webhook payload format is not documented publicly; accept generic JSON and log it.
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: true, ignored: true });
  }

  console.log("AiSensy webhook payload:", JSON.stringify(payload));

  // Best-effort extraction: try common WhatsApp Cloud API-style fields.
  const entries =
    (payload.entry as Array<Record<string, unknown>>) ??
    (Array.isArray(payload.messages) ? [{ changes: [{ value: { messages: payload.messages } }] }] : []);

  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
    for (const change of changes) {
      const value = (change.value as Record<string, unknown>) ?? {};
      const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
      const metadata = (value.metadata as Record<string, string>) ?? {};
      const displayPhone = metadata.display_phone_number ?? "";

      for (const msg of messages) {
        const from = ((msg.from ?? msg["wa_id"]) as string) ?? "";
        const text = ((msg.text as Record<string, string>)?.body ?? (msg.body as string)) ?? "";
        if (!from || !text) continue;

        const phone = from.startsWith("+") ? from : `+${from}`;
        const body = String(text).trim();

        // Activation code flow
        const candidate = body.replace(/[^A-Za-z0-9]/g, "");
        const code = candidate.length === 8 ? candidate.toUpperCase() : "";

        if (!code) {
          await sendAiSensyMessage(
            phone,
            "there",
            [
              "Welcome to Studypace WhatsApp reminders 👋",
              "Reply with your 8-character link code from My profile → WhatsApp reminders to connect.",
            ],
          );
          continue;
        }

        const { data, error } = await supabaseAdmin
          .from("profiles")
          .update({ aisensy_chat_id: phone, aisensy_opt_in: true })
          .eq("aisensy_link_code", code)
          .select("full_name")
          .maybeSingle();

        if (error) {
          console.error("AiSensy link failed:", error.message);
          continue;
        }

        if (!data) {
          await sendAiSensyMessage(phone, "there", ["That code didn't match any account. Please check the code in My profile → WhatsApp reminders."]);
          continue;
        }

        await sendAiSensyMessage(
          phone,
          data.full_name ?? "there",
          [
            "You're connected ✅",
            "You'll receive deadline reminders here. For full task management, use the Studypace app or Telegram bot.",
          ],
        );
      }
    }
  }

  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/hooks/aisensy-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handle(request);
        } catch (err) {
          console.error("aisensy-webhook error:", err instanceof Error ? err.stack ?? err.message : err);
          return Response.json({ ok: true, error: err instanceof Error ? err.message : "unknown" });
        }
      },
    },
  },
});

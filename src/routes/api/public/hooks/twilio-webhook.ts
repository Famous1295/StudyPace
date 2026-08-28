import { createFileRoute } from "@tanstack/react-router";

function menuText(name?: string | null) {
  return `${name ? `Hi ${name}` : "Hi"} 👋 *Studypace menu*\n\nReply with a number or word:\n\n*1* 🏠 Home — this week's tasks\n*2* ➕ Add task\n*3* ❓ Help / menu\n\nAlso works: *done N*, *delete N*, *cancel*.`;
}


async function handle(request: Request) {
  const { sendTwilioMessage } = await import("@/lib/twilio.server");

  const twilioKey = process.env["TWILIO_API_KEY"];
  if (!twilioKey) return Response.json({ ok: true, error: "not_configured" });

  const form = await request.formData();
  const from = (form.get("From") as string | null) ?? "";
  const body = ((form.get("Body") as string | null) ?? "").trim();
  const chatId = from; // e.g. whatsapp:+1234567890

  if (!chatId || !body) return Response.json({ ok: true, ignored: true });

  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: linked } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("twilio_chat_id", chatId)
    .maybeSingle();

  const raw = body;
  const lower = raw.toLowerCase();

  if (linked) {
    const {
      cancelFlow,
      continueAddTask,
      getSession,
      startAddTask,
      sendHome,
      handleHomeReply,
    } = await import("@/lib/twilio-tasks.server");

    if (/^cancel$/i.test(raw)) {
      await cancelFlow(chatId);
      return Response.json({ ok: true });
    }

    if (/^home$/i.test(raw) || /^\/$/.test(raw)) {
      await sendHome(chatId, linked.id);
      return Response.json({ ok: true });
    }

    if (/^add$/i.test(raw) || /^addtask$/i.test(raw) || /^\/add$/i.test(raw)) {
      await startAddTask(chatId, linked.id);
      return Response.json({ ok: true });
    }

    if (/^(help|start|menu|hi|hello|\/start|\/help|\/menu)$/i.test(raw)) {
      await sendTwilioMessage(chatId, menuText(linked.full_name));
      return Response.json({ ok: true });
    }

    const session = await getSession(chatId);
    if (session?.step?.startsWith("task_")) {
      await continueAddTask(chatId, linked.id, session.step, session.draft ?? {}, raw);
      return Response.json({ ok: true });
    }

    // Numbered menu shortcuts (no active flow)
    if (/^1$/.test(raw)) {
      await sendHome(chatId, linked.id);
      return Response.json({ ok: true });
    }
    if (/^2$/.test(raw)) {
      await startAddTask(chatId, linked.id);
      return Response.json({ ok: true });
    }
    if (/^3$/.test(raw)) {
      await sendTwilioMessage(chatId, menuText(linked.full_name));
      return Response.json({ ok: true });
    }

    if (/^(done|delete)\s*\d+/i.test(raw)) {
      await handleHomeReply(chatId, linked.id, raw);
      return Response.json({ ok: true });
    }

    await sendTwilioMessage(chatId, menuText(linked.full_name));
    return Response.json({ ok: true });
  }


  // Unlinked: treat as activation code
  const isStart = /^start\b/i.test(raw);
  const afterStart = raw.replace(/^start\b\s*/i, "").trim();
  const candidate = (isStart ? afterStart : raw).replace(/[^A-Za-z0-9]/g, "");
  const code = candidate.length === 8 ? candidate.toUpperCase() : "";

  if (!code) {
    await sendTwilioMessage(
      chatId,
      isStart
        ? "Welcome! 👋\n\nPlease send your 8-character activation code.\n\nYou'll find it in the app under My profile → WhatsApp reminders."
        : "That doesn't look like an activation code. Send the 8-character code shown in My profile → WhatsApp reminders.",
    );
    return Response.json({ ok: true });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ twilio_chat_id: chatId, twilio_opt_in: true })
    .eq("twilio_link_code", code)
    .select("full_name")
    .maybeSingle();

  if (error) {
    console.error("Twilio link failed:", error.message);
    await sendTwilioMessage(chatId, "Something went wrong on our side. Please try again in a minute.");
    return Response.json({ ok: true, linked: false });
  }

  if (!data) {
    await sendTwilioMessage(
      chatId,
      "That code didn't match any account. Open My profile → WhatsApp reminders in the app, copy the 8-character code, and send it again.",
    );
    return Response.json({ ok: true, linked: false });
  }

  await sendTwilioMessage(
    chatId,
    `You're connected, ${data.full_name ?? "there"}! ✅\n\nI'll message you here about upcoming deadlines.\n\n${menuText(data.full_name)}`,
  );

  return Response.json({ ok: true, linked: true });
}

export const Route = createFileRoute("/api/public/hooks/twilio-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handle(request);
        } catch (err) {
          console.error("twilio-webhook error:", err instanceof Error ? err.stack ?? err.message : err);
          return Response.json({
            ok: true,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      },
    },
  },
});

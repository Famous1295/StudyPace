import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handle(request: Request) {
  const { sendTelegramMessage, sha256Base64Url } = await import("@/lib/telegram.server");

  const telegramKey = process.env["TELEGRAM_API_KEY"];
  if (!telegramKey) return Response.json({ ok: true, error: "not_configured" });

  const expected = await sha256Base64Url(`telegram-webhook:${telegramKey}`);
  const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

  const update = (await request.json()) as {
    message?: { chat?: { id: number }; text?: string };
    callback_query?: {
      id: string;
      data?: string;
      message?: { message_id: number; chat?: { id: number } };
    };
  };
  const cb = update.callback_query;
  const chatId = update.message?.chat?.id ?? cb?.message?.chat?.id;
  const raw = (update.message?.text ?? "").trim();
  if (!chatId) return Response.json({ ok: true, ignored: true });

  // --- linked-user commands (add task conversation) ---
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: linked } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (linked && cb) {
    const { handleCallback } = await import("@/lib/telegram-tasks.server");
    await handleCallback({
      chatId,
      userId: linked.id,
      messageId: cb.message?.message_id ?? 0,
      callbackId: cb.id,
      data: cb.data ?? "noop",
    });
    return Response.json({ ok: true });
  }

  if (linked) {
    const {
      cancelFlow,
      continueAddTask,
      getSession,
      startAddTask,
    } = await import("@/lib/telegram-tasks.server");

    if (/^\/cancel\b/i.test(raw)) {
      await cancelFlow(chatId);
      return Response.json({ ok: true });
    }
    if (/^\/(home|week|tasks)\b/i.test(raw)) {
      const { sendHome } = await import("@/lib/telegram-tasks.server");
      await sendHome(chatId, linked.id, linked.full_name);
      return Response.json({ ok: true });
    }
    if (/^\/(addtask|add)\b/i.test(raw)) {
      await startAddTask(chatId, linked.id);
      return Response.json({ ok: true });
    }
    if (/^\/(disconnect|unlink|stop)\b/i.test(raw)) {
      await sendTelegramMessage(
        chatId,
        "Disconnect this chat from your Studypace account?\n\nYou'll stop getting reminders and will need a <b>new activation code</b> to reconnect.",
        [
          [{ text: "✅ Yes, disconnect", callback_data: "flow:disconnect_yes" }],
          [{ text: "✖ Keep connected", callback_data: "flow:home" }],
        ],
      );
      return Response.json({ ok: true });
    }
    if (/^\/help\b/i.test(raw) || /^\/start\b/i.test(raw)) {
      await sendTelegramMessage(
        chatId,
        `You're connected, ${linked.full_name ?? "there"}! ✅\n\n<b>Menu</b>\n/addtask — add a new task\n/home — this week's tasks\n/disconnect — unlink this chat\n/cancel — stop the current step`,
        [
          [{ text: "👉 Add a task now", callback_data: "flow:addtask" }],
          [{ text: "🏠 Home", callback_data: "flow:home" }],
          [{ text: "🔌 Disconnect", callback_data: "flow:disconnect" }],
        ],
      );
      return Response.json({ ok: true });
    }


    const session = await getSession(chatId);
    if (session?.step?.startsWith("task_")) {
      await continueAddTask(chatId, linked.id, session.step, session.draft ?? {}, raw);
      return Response.json({ ok: true });
    }

    await sendTelegramMessage(
      chatId,
      "I can add tasks for you, or show this week's plan 👇\n\nSend /home any time.",
      [
        [{ text: "👉 Add a task now", callback_data: "flow:addtask" }],
        [{ text: "🏠 Home", callback_data: "flow:home" }],
      ],
    );
    return Response.json({ ok: true });
  }

  const isStart = /^\/start\b/i.test(raw);
  const afterStart = raw.replace(/^\/start\b\s*/i, "").trim();
  const candidate = (isStart ? afterStart : raw).replace(/[^A-Za-z0-9]/g, "");
  const code = candidate.length === 8 ? candidate.toUpperCase() : "";

  if (!code) {
    await sendTelegramMessage(
      chatId,
      isStart
        ? "Welcome! 👋\n\nPlease send me your <b>8-character activation code</b>.\n\nYou'll find it in the app under <b>My profile → Telegram reminders</b>. Just type the code here and I'll connect this chat."
        : "That doesn't look like an activation code. Send the <b>8-character code</b> shown in <b>My profile → Telegram reminders</b>.",
    );
    return Response.json({ ok: true });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ telegram_chat_id: chatId, telegram_opt_in: true })
    .eq("telegram_link_code", code)
    .select("full_name")
    .maybeSingle();

  if (error) {
    console.error("Telegram link failed:", error.message);
    await sendTelegramMessage(chatId, "Something went wrong on our side. Please try again in a minute.");
    return Response.json({ ok: true, linked: false });
  }

  if (!data) {
    await sendTelegramMessage(
      chatId,
      "That code didn't match any account. Open <b>My profile → Telegram reminders</b> in the app, copy the 8-character code, and send it again.",
    );
    return Response.json({ ok: true, linked: false });
  }

  await sendTelegramMessage(
    chatId,
    `You're connected, ${data.full_name ?? "there"}! ✅\n\nI'll message you here about upcoming deadlines. Send /home any time to see this week's tasks.`,
    [
      [{ text: "👉 Add a task now", callback_data: "flow:addtask" }],
      [{ text: "🏠 Home", callback_data: "flow:home" }],
    ],
  );
  return Response.json({ ok: true, linked: true });
}

export const Route = createFileRoute("/api/public/hooks/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handle(request);
        } catch (err) {
          console.error("telegram-webhook error:", err instanceof Error ? err.stack ?? err.message : err);
          return Response.json({
            ok: true,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      },
    },
  },
});

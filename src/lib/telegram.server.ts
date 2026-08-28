const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export const TELEGRAM_BOT_USERNAME = "Smart_workload_balancer_bot";

export function telegramWebhookSecret(apiKey: string, hash: (s: string) => Promise<string>) {
  return hash(`telegram-webhook:${apiKey}`);
}

/** base64url SHA-256 — Web Crypto so it works in the edge runtime. */
export async function sha256Base64Url(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface InlineButton {
  text: string;
  callback_data: string;
}
export type InlineKeyboard = InlineButton[][];

async function callTelegram(method: string, payload: Record<string, unknown>) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const telegramKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey || !telegramKey) return { sent: false, detail: "telegram_not_connected" };

  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Telegram ${method} failed [${res.status}]: ${body}`);
    return { sent: false, detail: `${res.status}: ${body.slice(0, 300)}` };
  }
  const json = (await res.json()) as { ok?: boolean; description?: string };
  if (!json.ok) return { sent: false, detail: json.description ?? "telegram_error" };
  return { sent: true, detail: null as string | null };
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

/** Replaces an existing message (used to redraw the calendar in place). */
export async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  return callTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export async function answerCallbackQuery(id: string, text?: string) {
  return callTelegram("answerCallbackQuery", {
    callback_query_id: id,
    ...(text ? { text } : {}),
  });
}

/** Big tappable button shown under reminders and greetings. */
export const ADD_TASK_KEYBOARD: InlineKeyboard = [
  [{ text: "👉 Add a task now", callback_data: "flow:addtask" }],
  [{ text: "🏠 Home", callback_data: "flow:home" }],
];

export interface ReminderTask {
  title: string;
  type: string;
  deadline_date: string;
  subject: string | null;
  est_hours?: number | null;
}

const escHtml = (v: string) =>
  v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function renderReminder(name: string, tasks: ReminderTask[]) {
  const lines = tasks
    .map(
      (t) =>
        `• <b>${escHtml(t.title)}</b> (${escHtml(t.type)}${t.subject ? ` · ${escHtml(t.subject)}` : ""}) — due ${t.deadline_date}`,
    )
    .join("\n");
  return `Hi ${escHtml(name || "there")} 👋\n\nDeadlines coming up:\n\n${lines}\n\nOpen the app to plan your week.`;
}

/**
 * Daily update focused on TOMORROW's targets, with today's and later deadlines
 * as context. Sent once per day by the scheduled reminder job.
 */
export function renderDailyUpdate(
  name: string,
  tasks: ReminderTask[],
  dates: { today: string; tomorrow: string },
) {
  const line = (t: ReminderTask) =>
    `• <b>${escHtml(t.title)}</b> (${escHtml(t.type)}${t.subject ? ` · ${escHtml(t.subject)}` : ""})${
      t.est_hours ? ` · ~${t.est_hours}h` : ""
    }`;

  const overdue = tasks.filter((t) => t.deadline_date < dates.today);
  const today = tasks.filter((t) => t.deadline_date === dates.today);
  const tomorrow = tasks.filter((t) => t.deadline_date === dates.tomorrow);
  const later = tasks.filter((t) => t.deadline_date > dates.tomorrow);

  const blocks: string[] = [];
  if (overdue.length) blocks.push(`⚠️ <b>Overdue</b>\n${overdue.map(line).join("\n")}`);
  if (today.length) blocks.push(`📌 <b>Due today</b>\n${today.map(line).join("\n")}`);
  blocks.push(
    tomorrow.length
      ? `🎯 <b>Tomorrow's targets (${dates.tomorrow})</b>\n${tomorrow.map(line).join("\n")}`
      : `🎯 <b>Tomorrow (${dates.tomorrow})</b>\nNothing due — a great slot to get ahead. 💪`,
  );
  if (later.length) blocks.push(`🗓 <b>Coming up</b>\n${later.map(line).join("\n")}`);

  const hours = tomorrow.reduce((s, t) => s + (t.est_hours ?? 0), 0);
  const footer = hours ? `\n\n<i>Plan ~${hours}h for tomorrow.</i>` : "";

  return `Good day ${escHtml(name || "there")} 👋\n<b>Your daily Studypace update</b>\n\n${blocks.join("\n\n")}${footer}`;
}

/** Random 8-character activation code. */
export function newLinkCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

/**
 * Disconnects a user's Telegram chat and issues a brand-new activation code so
 * they must re-link from scratch. Works from the app or from the bot itself.
 */
export async function unlinkTelegramForUser(userId: string, source: "app" | "bot") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", userId)
    .maybeSingle();

  const chatId = (profile?.telegram_chat_id as number | null) ?? null;
  const code = newLinkCode();

  await supabaseAdmin
    .from("profiles")
    .update({ telegram_chat_id: null, telegram_opt_in: false, telegram_link_code: code })
    .eq("id", userId);

  if (chatId) {
    await sendTelegramMessage(
      chatId,
      source === "bot"
        ? `✅ <b>Disconnected.</b> 👋\n\nThis chat is no longer linked to your Studypace account and reminders are off.\n\nTo reconnect, press /start and send me the new <b>8-character activation code</b> from the website (<b>My profile → Telegram reminders</b>).`
        : `✅ <b>Disconnected.</b> 👋\n\nThis chat was unlinked from the app.\n\nTo reconnect, press /start and send me the new <b>8-character activation code</b> shown on the website under <b>My profile → Telegram reminders</b>.`,
    );
  }

  return { disconnected: Boolean(chatId), code };
}

/**
 * Unlinks a user's Telegram chat and tells the bot user they must send a fresh
 * activation code before reminders can resume. Safe to call for users who were
 * never linked.
 */
export async function disconnectTelegramForUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", userId)
    .maybeSingle();

  const chatId = (profile?.telegram_chat_id as number | null) ?? null;
  if (chatId) {
    await sendTelegramMessage(
      chatId,
      "This chat has been disconnected because the linked account was deleted. 👋\n\nIf you create a new account, send me the new <b>8-character activation code</b> from <b>My profile → Telegram reminders</b> to reconnect.",
    );
  }

  await supabaseAdmin
    .from("profiles")
    .update({ telegram_chat_id: null, telegram_opt_in: false })
    .eq("id", userId);

  return { disconnected: Boolean(chatId) };
}


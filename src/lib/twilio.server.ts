const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export function isWhatsAppChatId(raw: string) {
  return raw.startsWith("whatsapp:");
}

export function whatsappNumber(raw: string) {
  return raw.startsWith("whatsapp:") ? raw : `whatsapp:${raw}`;
}

export interface TwilioMessageResult {
  sent: boolean;
  detail: string | null;
}

async function getFromNumber(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("notification_settings")
    .select("twilio_whatsapp_from")
    .maybeSingle();
  return (data?.twilio_whatsapp_from as string | null) ?? null;
}

async function callTwilio(form: Record<string, string>): Promise<TwilioMessageResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  if (!lovableKey || !twilioKey) return { sent: false, detail: "twilio_not_connected" };

  const from = await getFromNumber();
  if (!from) return { sent: false, detail: "missing_twilio_from_number" };

  const body = new URLSearchParams({ ...form, From: whatsappNumber(from) });

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Twilio message failed [${res.status}]: ${text}`);
    return { sent: false, detail: `${res.status}: ${text.slice(0, 300)}` };
  }

  const json = (await res.json()) as { error_code?: string | null; error_message?: string | null };
  if (json.error_code) return { sent: false, detail: json.error_message ?? String(json.error_code) };
  return { sent: true, detail: null };
}

export async function sendTwilioMessage(chatId: string, text: string): Promise<TwilioMessageResult> {
  return callTwilio({ To: whatsappNumber(chatId), Body: text });
}

export function renderReminder(
  name: string,
  tasks: { title: string; type: string; deadline_date: string; subject: string | null }[],
) {
  const lines = tasks
    .map((t) => `• *${t.title}* (${t.type}${t.subject ? ` · ${t.subject}` : ""}) — due ${t.deadline_date}`)
    .join("\n");
  return `Hi ${name || "there"} 👋\n\nDeadlines coming up:\n\n${lines}\n\nOpen the app to plan your week.\n\nReply *add* to add a task or *home* to see this week.`;
}

export async function disconnectTwilioForUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("twilio_chat_id")
    .eq("id", userId)
    .maybeSingle();

  const chatId = (profile?.twilio_chat_id as string | null) ?? null;
  if (chatId) {
    await sendTwilioMessage(
      chatId,
      "This chat has been disconnected because the linked account was deleted. 👋\n\nIf you create a new account, send me the new 8-character activation code from My profile → WhatsApp reminders to reconnect.",
    );
  }

  await supabaseAdmin
    .from("profiles")
    .update({ twilio_chat_id: null, twilio_opt_in: false })
    .eq("id", userId);

  return { disconnected: Boolean(chatId) };
}

const AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

export interface AiSensyMessageResult {
  sent: boolean;
  detail: string | null;
}

interface AiSensyPayload {
  apiKey: string;
  campaignName: string;
  destination: string;
  userName: string;
  source?: string;
  templateParams?: string[];
  tags?: string[];
}

async function getSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("notification_settings")
    .select("aisensy_api_key, aisensy_campaign_name")
    .maybeSingle();
  return {
    apiKey: (data?.aisensy_api_key as string | null) ?? null,
    campaignName: (data?.aisensy_campaign_name as string | null) ?? null,
  };
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/[^0-9+]/g, "");
  if (!digits) return raw;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export async function sendAiSensyMessage(
  phone: string,
  userName: string,
  params: string[],
): Promise<AiSensyMessageResult> {
  const { apiKey, campaignName } = await getSettings();
  if (!apiKey || !campaignName) {
    return { sent: false, detail: "aisensy_not_configured" };
  }

  const payload: AiSensyPayload = {
    apiKey,
    campaignName,
    destination: normalizePhone(phone),
    userName: userName || "Studypace user",
    source: "Studypace",
    templateParams: params,
  };

  try {
    const res = await fetch(AISENSY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`AiSensy message failed [${res.status}]: ${text}`);
      return { sent: false, detail: `${res.status}: ${text.slice(0, 300)}` };
    }
    return { sent: true, detail: text.slice(0, 300) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AiSensy send error:", msg);
    return { sent: false, detail: msg };
  }
}

export function renderReminder(
  name: string,
  tasks: { title: string; type: string; deadline_date: string; subject: string | null }[],
) {
  const summary = tasks.map((t) => `${t.title} (${t.type}${t.subject ? ` · ${t.subject}` : ""}) due ${t.deadline_date}`).join(" | ");
  return [name || "there", summary];
}

export async function disconnectAiSensyForUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("profiles")
    .update({ aisensy_chat_id: null, aisensy_opt_in: false })
    .eq("id", userId);
  return { disconnected: true };
}

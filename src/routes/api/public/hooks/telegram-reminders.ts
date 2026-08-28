import { createFileRoute } from "@tanstack/react-router";
import { ADD_TASK_KEYBOARD, renderDailyUpdate, sendTelegramMessage } from "@/lib/telegram.server";

const HORIZON_DAYS = 3;
const LOOKBACK_DAYS = 7;

function isoShift(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = isoShift(0);
  const tomorrow = isoShift(1);
  const untilDate = isoShift(HORIZON_DAYS);
  const fromDate = isoShift(-LOOKBACK_DAYS);

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, telegram_chat_id")
    .eq("telegram_opt_in", true)
    .not("telegram_chat_id", "is", null)
    .limit(300);

  let sent = 0;
  let skipped = 0;

  for (const p of profiles ?? []) {
    const chatId = p.telegram_chat_id as number | null;
    if (!chatId) {
      skipped++;
      continue;
    }

    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, title, type, deadline_date, est_hours, subjects(name)")
      .eq("user_id", p.id)
      .eq("is_completed", false)
      .gte("deadline_date", fromDate)
      .lte("deadline_date", untilDate)
      .order("deadline_date", { ascending: true })
      .limit(30);

    const list = (tasks ?? []) as unknown as {
      id: string;
      title: string;
      type: string;
      deadline_date: string;
      est_hours: number | null;
      subjects: { name: string } | null;
    }[];

    if (!list.length) {
      skipped++;
      continue;
    }

    // One daily update per user per day.
    const { data: alreadyRows } = await supabaseAdmin
      .from("reminder_log")
      .select("task_id")
      .eq("user_id", p.id)
      .eq("channel", "telegram")
      .eq("sent_for_date", today)
      .limit(1);
    if ((alreadyRows ?? []).length) {
      skipped++;
      continue;
    }

    const res = await sendTelegramMessage(
      chatId,
      renderDailyUpdate(
        p.full_name ?? "",
        list.map((t) => ({
          title: t.title,
          type: t.type,
          deadline_date: t.deadline_date,
          est_hours: t.est_hours,
          subject: t.subjects?.name ?? null,
        })),
        { today, tomorrow },
      ),
      ADD_TASK_KEYBOARD,
    );

    await supabaseAdmin.from("reminder_log").insert(
      list.map((t) => ({
        user_id: p.id,
        task_id: t.id,
        channel: "telegram",
        sent_for_date: today,
        status: res.sent ? "sent" : "failed",
        detail: res.detail,
      })),
    );
    if (res.sent) sent++;
  }

  return { ok: true, date: today, notified: sent, skipped };
}

export const Route = createFileRoute("/api/public/hooks/telegram-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return Response.json(await run());
      },
    },
  },
});

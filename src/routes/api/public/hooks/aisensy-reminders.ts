import { createFileRoute } from "@tanstack/react-router";
import { renderReminder, sendAiSensyMessage } from "@/lib/aisensy.server";

const HORIZON_DAYS = 3;

async function run() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + HORIZON_DAYS);
  const untilDate = until.toISOString().slice(0, 10);

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, aisensy_chat_id")
    .eq("aisensy_opt_in", true)
    .not("aisensy_chat_id", "is", null)
    .limit(300);

  let sent = 0;
  let skipped = 0;

  for (const p of profiles ?? []) {
    const phone = p.aisensy_chat_id as string | null;
    if (!phone) {
      skipped++;
      continue;
    }

    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, title, type, deadline_date, subjects(name)")
      .eq("user_id", p.id)
      .eq("is_completed", false)
      .gte("deadline_date", today)
      .lte("deadline_date", untilDate)
      .order("deadline_date", { ascending: true })
      .limit(20);

    const list = ((tasks ?? []) as unknown as {
      id: string;
      title: string;
      type: string;
      deadline_date: string;
      subjects: { name: string } | null;
    }[]);

    if (!list.length) {
      skipped++;
      continue;
    }

    const { data: alreadyRows } = await supabaseAdmin
      .from("reminder_log")
      .select("task_id")
      .eq("user_id", p.id)
      .eq("channel", "aisensy")
      .eq("sent_for_date", today);
    const already = new Set((alreadyRows ?? []).map((r) => r.task_id));
    const pending = list.filter((t) => !already.has(t.id));
    if (!pending.length) {
      skipped++;
      continue;
    }

    const params = renderReminder(
      p.full_name ?? "",
      pending.map((t) => ({
        title: t.title,
        type: t.type,
        deadline_date: t.deadline_date,
        subject: t.subjects?.name ?? null,
      })),
    );

    const res = await sendAiSensyMessage(phone, p.full_name ?? "", params);

    await supabaseAdmin.from("reminder_log").insert(
      pending.map((t) => ({
        user_id: p.id,
        task_id: t.id,
        channel: "aisensy",
        sent_for_date: today,
        status: res.sent ? "sent" : "failed",
        detail: res.detail,
      })),
    );
    if (res.sent) sent++;
  }

  return { ok: true, date: today, notified: sent, skipped };
}

export const Route = createFileRoute("/api/public/hooks/aisensy-reminders")({
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

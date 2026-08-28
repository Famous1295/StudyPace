import { createFileRoute } from "@tanstack/react-router";
import { renderDigest, sendDigestEmail, weekStart } from "@/lib/weekly-digest.server";

const BATCH = 100;

async function run() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const start = weekStart();
  const endDate = new Date(`${start}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const end = endDate.toISOString().slice(0, 10);

  // Gmail sends from the connected Google account; a display name is enough.
  const from = "Studypace";

  const { data: sentRows } = await supabaseAdmin
    .from("weekly_digest_log")
    .select("user_id")
    .eq("week_start", start);
  const already = new Set((sentRows ?? []).map((r) => r.user_id));

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .eq("weekly_email_opt_in", true)
    .not("email", "is", null)
    .limit(BATCH * 3);

  let sent = 0;
  let skipped = 0;

  for (const p of profiles ?? []) {
    if (sent >= BATCH) break;
    if (already.has(p.id) || !p.email) {
      skipped++;
      continue;
    }

    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("title, type, deadline_date, est_hours, subjects(name)")
      .eq("user_id", p.id)
      .eq("is_completed", false)
      .gte("deadline_date", start)
      .lte("deadline_date", end)
      .order("deadline_date", { ascending: true })
      .limit(50);

    const list = ((tasks ?? []) as unknown as {
      title: string;
      type: string;
      deadline_date: string;
      est_hours: number | null;
      subjects: { name: string } | null;
    }[]).map((t) => ({
      title: t.title,
      type: t.type,
      deadline_date: t.deadline_date,
      est_hours: t.est_hours,
      subject: t.subjects?.name ?? null,
    }));

    const { html, text } = renderDigest(p.full_name ?? "", list, start, end);

    let status = "sent";
    let detail: string | null = null;
    try {
      const res = await sendDigestEmail({
        to: p.email,
        from,
        subject: `This week's deadlines (${start} → ${end})`,
        html,
        text,
      });
      if (!res.sent) {
        status = "failed";
        detail = res.detail;
      }
    } catch (err) {
      status = "failed";
      detail = err instanceof Error ? err.message : "unknown error";
    }

    await supabaseAdmin
      .from("weekly_digest_log")
      .insert({ user_id: p.id, week_start: start, status, detail });
    sent++;
  }

  return { ok: true, week_start: start, processed: sent, skipped };
}

export const Route = createFileRoute("/api/public/hooks/weekly-digest")({
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
        const result = await run();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

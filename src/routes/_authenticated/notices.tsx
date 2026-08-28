import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAnnouncements, useSubjectDeadlines } from "@/lib/faculty";

export const Route = createFileRoute("/_authenticated/notices")({
  head: () => ({
    meta: [
      { title: "Class notices — Studypace" },
      {
        name: "description",
        content:
          "Faculty-published deadlines and announcements for the subjects in your branch and semester.",
      },
      { property: "og:title", content: "Class notices — Studypace" },
      {
        property: "og:description",
        content: "Faculty deadlines and announcements for your class.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NoticesPage,
});

function NoticesPage() {
  const { data: deadlines = [], isLoading: loadingDeadlines } = useSubjectDeadlines();
  const { data: announcements = [], isLoading: loadingNotices } = useAnnouncements();

  return (
    <AppShell title="Class notices">
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        Everything your faculty has published for your branch and semester. Add anything relevant
        to your own task list to include it in your panic score.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
            Faculty deadlines
          </h2>
          {loadingDeadlines ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : deadlines.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No deadlines published yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {deadlines.map((d) => (
                <li key={d.id} className="px-4 py-3">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.subjects?.name ?? "Subject"} · <span className="capitalize">{d.type}</span> ·
                    due {d.deadline_date} · ~{d.est_hours}h
                  </p>
                  {d.notes && <p className="mt-1 text-sm text-muted-foreground">{d.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Announcements</h2>
          {loadingNotices ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : announcements.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {announcements.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.subjects?.name ?? "Subject"} · {a.author_name ?? "Faculty"} ·{" "}
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-sm">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

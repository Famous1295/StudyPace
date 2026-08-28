import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllTasks } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin/tasks")({
  head: () => ({
    meta: [
      { title: "Task oversight — Studypace admin" },
      {
        name: "description",
        content:
          "See every task added across Studypace, who created it, and which ones are completed.",
      },
      { property: "og:title", content: "Task oversight — Studypace admin" },
      {
        property: "og:description",
        content: "Every student task, its owner and completion status in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminTasksPage,
});

const TYPE_LABEL: Record<string, string> = {
  exam: "Exam",
  assignment: "Assignment",
  project: "Project",
  lab: "Lab",
};

function AdminTasksPage() {
  const { data: tasks = [], isLoading } = useAllTasks();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (status === "done" && !t.is_completed) return false;
      if (status === "open" && t.is_completed) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.owner_name.toLowerCase().includes(q) ||
        (t.owner_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, status]);

  const done = tasks.filter((t) => t.is_completed).length;

  return (
    <AdminShell title="Task oversight">
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        Every task created in the app, who added it, and whether it has been completed.
      </p>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Total tasks" value={tasks.length} />
        <Stat label="Completed" value={done} />
        <Stat label="Still open" value={tasks.length - done} />
      </div>

      <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap">
        <Input
          placeholder="Search by task, student name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open only</SelectItem>
            <SelectItem value="done">Completed only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 lg:hidden">
        {isLoading && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No tasks match this filter.
          </div>
        )}
        {rows.map((t) => (
          <div key={t.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium">{t.title}</p>
              {t.is_completed ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" /> Done
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Circle className="size-4" /> Open
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {TYPE_LABEL[t.type] ?? t.type} · due {new Date(t.deadline_date).toLocaleDateString()} ·{" "}
              {t.est_hours}h
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t.owner_name} · {t.owner_email ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.branch ?? "—"}
              {t.semester ? ` · Sem ${t.semester}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Added by</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Hours</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  No tasks match this filter.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABEL[t.type] ?? t.type} · added{" "}
                      {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.owner_name}</p>
                    <p className="text-xs text-muted-foreground">{t.owner_email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.branch ?? "—"}
                    {t.semester ? ` · Sem ${t.semester}` : ""}
                  </td>
                  <td className="px-4 py-3">{new Date(t.deadline_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{t.est_hours}h</td>
                  <td className="px-4 py-3">
                    {t.is_completed ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Circle className="size-4" /> Open
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

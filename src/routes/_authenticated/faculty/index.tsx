import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { useClassOverview, useMyTaughtSubjects, useSubjectTasks } from "@/lib/faculty";

export const Route = createFileRoute("/_authenticated/faculty/")({
  head: () => ({
    meta: [
      { title: "Class analytics — Faculty portal" },
      {
        name: "description",
        content:
          "Anonymised, class-wide workload and panic-score trends for the subjects you teach.",
      },
      { property: "og:title", content: "Class analytics — Faculty portal" },
      {
        property: "og:description",
        content: "Anonymised class-wide workload trends for faculty.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacultyAnalytics,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function FacultyAnalytics() {
  const { data: rows = [], isLoading, error } = useClassOverview();
  const { data: subjects = [] } = useMyTaughtSubjects();

  const students = rows.reduce((a, r) => a + Number(r.student_count), 0);
  const overloaded = rows.reduce((a, r) => a + Number(r.overloaded_students), 0);
  const totalTasks = rows.reduce((a, r) => a + Number(r.total_tasks), 0);
  const doneTasks = rows.reduce((a, r) => a + Number(r.completed_tasks), 0);

  return (
    <AppShell title="Class analytics">
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        Faculty see aggregated, anonymised figures only — never an individual student&apos;s tasks,
        marks or panic score.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students in your classes" value={students} />
        <Stat label="Currently overloaded" value={overloaded} />
        <Stat label="Tasks logged" value={totalTasks} />
        <Stat
          label="Completion rate"
          value={totalTasks ? `${Math.round((doneTasks / totalTasks) * 100)}%` : "—"}
        />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
          Class-wide workload
        </h2>
        {error ? (
          <p className="px-4 py-6 text-sm text-destructive">
            Could not load class analytics. You may not be assigned to any subject yet.
          </p>
        ) : isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No class data yet. An administrator needs to assign you to a subject.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2">Branch</th>
                  <th className="px-4 py-2">Semester</th>
                  <th className="px-4 py-2">Students</th>
                  <th className="px-4 py-2">Avg panic score</th>
                  <th className="px-4 py-2">Overloaded</th>
                  <th className="px-4 py-2">Completion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const total = Number(r.total_tasks);
                  return (
                    <tr key={`${r.branch_id}-${r.semester}-${i}`} className="border-b border-border">
                      <td className="px-4 py-2">{r.branch_name ?? "Unassigned"}</td>
                      <td className="px-4 py-2">{r.semester ?? "—"}</td>
                      <td className="px-4 py-2">{r.student_count}</td>
                      <td className="px-4 py-2 font-medium">{Number(r.avg_panic).toFixed(2)}</td>
                      <td className="px-4 py-2">{r.overloaded_students}</td>
                      <td className="px-4 py-2">
                        {total
                          ? `${Math.round((Number(r.completed_tasks) / total) * 100)}%`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Subjects you teach</h2>
        {subjects.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            None assigned yet — ask an administrator to assign your subjects.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {subjects.map((s) => (
              <li
                key={s.id}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {s.name} {s.code ? `(${s.code})` : ""}
                {s.semester ? ` · Sem ${s.semester}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SubjectTaskFeed />
    </AppShell>
  );
}

function SubjectTaskFeed() {
  const { data: rows = [], isLoading, error } = useSubjectTasks();
  const [subject, setSubject] = useState("all");
  const [source, setSource] = useState<"all" | "student" | "faculty">("all");

  const subjectOptions = [...new Map(rows.map((r) => [r.subject_id, r])).values()];
  const filtered = rows.filter(
    (r) =>
      (subject === "all" || r.subject_id === subject) &&
      (source === "all" || r.source === source),
  );

  return (
    <section className="mt-6 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Tasks in your subjects</h2>
          <p className="text-xs text-muted-foreground">
            Student-created tasks matched to your subjects, plus deadlines you published.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="all">All subjects</option>
            {subjectOptions.map((s) => (
              <option key={s.subject_id} value={s.subject_id}>
                {s.subject_name}
                {s.subject_code ? ` (${s.subject_code})` : ""}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "all" | "student" | "faculty")}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="all">Added by anyone</option>
            <option value="student">Added by students</option>
            <option value="faculty">Added by faculty</option>
          </select>
        </div>
      </div>

      {error ? (
        <p className="px-4 py-6 text-sm text-destructive">Could not load subject tasks.</p>
      ) : isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No tasks found for your subjects yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2">Task</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Added by</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.source}-${r.subject_id}-${i}`} className="border-b border-border">
                  <td className="px-4 py-2 font-medium">{r.title}</td>
                  <td className="px-4 py-2">
                    {r.subject_name}
                    {r.semester ? ` · Sem ${r.semester}` : ""}
                  </td>
                  <td className="px-4 py-2 capitalize">{r.type}</td>
                  <td className="px-4 py-2">{r.deadline_date}</td>
                  <td className="px-4 py-2">
                    {r.source === "faculty" ? "Faculty" : (r.student_name ?? "Student")}
                  </td>
                  <td className="px-4 py-2">
                    {r.source === "faculty" ? (
                      <span className="text-muted-foreground">Published</span>
                    ) : r.is_completed ? (
                      <span className="font-medium text-primary">Completed</span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

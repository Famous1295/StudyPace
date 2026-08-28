import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, useBranches } from "@/lib/admin";
import { computeWeeklyPanic, parseDate, type Task } from "@/lib/panic";

const TYPE_COLORS = ["#0D9488", "#F59E0B", "#6366F1", "#EF4444"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "System Analytics — Studypace Admin" },
      {
        name: "description",
        content: "Anonymised platform-wide workload, branch and task-type analytics.",
      },
      { property: "og:title", content: "System Analytics — Studypace Admin" },
      {
        property: "og:description",
        content: "Anonymised platform-wide workload, branch and task-type analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AnalyticsPage() {
  const users = useAdminUsers();
  const branches = useBranches();
  const tasksQuery = useQuery({
    queryKey: ["admin-all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const list = users.data ?? [];
  const allTasks = tasksQuery.data ?? [];
  const activeTasks = allTasks.filter((t) => !t.is_completed);

  const perBranch = (branches.data ?? []).map((b) => ({
    name: b.code,
    students: list.filter((u) => u.branch_id === b.id && u.role === "student").length,
  }));

  const byUser = new Map<string, Task[]>();
  for (const t of activeTasks) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);

  const weekTotals = new Map<string, { sum: number; n: number }>();
  let overloaded = 0;
  for (const [, userTasks] of byUser) {
    const weeks = computeWeeklyPanic(userTasks);
    if (weeks[0]?.status === "overloaded") overloaded += 1;
    for (const w of weeks) {
      const cur = weekTotals.get(w.weekStart) ?? { sum: 0, n: 0 };
      weekTotals.set(w.weekStart, { sum: cur.sum + w.score, n: cur.n + 1 });
    }
  }
  const avgSeries = [...weekTotals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, v]) => ({
      week: new Date(week).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      score: Math.round((v.sum / Math.max(v.n, 1)) * 100) / 100,
    }));

  const typeCounts = new Map<string, number>();
  for (const t of allTasks) typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
  const typeData = [...typeCounts.entries()].map(([name, value]) => ({ name, value }));

  const dayCounts = new Array(7).fill(0) as number[];
  for (const t of activeTasks) {
    const d = parseDate(t.deadline_date).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
  }
  const total = dayCounts.reduce((a, b) => a + b, 0);
  const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
  const others = (total - (dayCounts[maxDay] ?? 0)) / 6;
  const clashPct =
    others > 0 ? Math.round((((dayCounts[maxDay] ?? 0) - others) / others) * 100) : 0;

  const studentCount = Math.max(list.filter((u) => u.role === "student").length, 1);
  const overloadedPct = Math.round((overloaded / studentCount) * 100);

  return (
    <AdminShell title="System Analytics">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat
          label="Students overloaded this week"
          value={`${overloadedPct}%`}
          sub="Aggregate only — no names shown"
        />
        <Stat
          label="Most common deadline clash day"
          value={total > 0 ? `${DAY_NAMES[maxDay]}s` : "—"}
          sub={total > 0 ? `${clashPct}% more clashes than other days` : "No active deadlines"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Students per branch">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perBranch}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="students" fill="#0D9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Average panic score per week">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={avgSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Task type distribution">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {typeData.map((entry, i) => (
                    <Cell key={entry.name} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

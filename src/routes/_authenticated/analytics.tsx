import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AIKeyGate } from "@/components/AIKeyGate";
import { AIAnswer, AIBadge } from "@/components/AIAnswer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTasks } from "@/lib/tasks";
import { useMySubjects } from "@/lib/subjects";
import { correlation, percentOf, subjectPerformance, useMarks } from "@/lib/marks";
import { exportCSV, exportTasksPDF, tasksToRows } from "@/lib/export";
import { buildAIContext } from "@/lib/ai-context";
import { explainPanicScore } from "@/lib/ai.functions";
import {
  classify,
  parseDate,
  startOfToday,
  STATUS_COLOR,
  TYPE_WEIGHTS,
  upcomingWeeks,
  type TaskType,
} from "@/lib/panic";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Studypace" },
      {
        name: "description",
        content:
          "Subject-wise workload split, panic score trends and how your marks track against your workload.",
      },
      { property: "og:title", content: "Analytics — Studypace" },
      {
        property: "og:description",
        content: "Visualise workload distribution, panic trends and marks correlation.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const PIE_COLORS = [
  "var(--color-primary)",
  "var(--color-busy)",
  "var(--color-safe)",
  "var(--color-overloaded)",
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

function AnalyticsPage() {
  const { data: tasks = [] } = useTasks();
  const { data: subjects = [] } = useMySubjects();
  const { data: marks = [] } = useMarks();
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string | null | undefined) =>
    subjects.find((s) => s.id === id)?.name ?? "Unassigned";

  const today = startOfToday();
  const active = useMemo(
    () => tasks.filter((t) => !t.is_completed && parseDate(t.deadline_date) >= today),
    [tasks, today],
  );

  const subjectSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of active) {
      map.set(nameOf(t.subject_id), (map.get(nameOf(t.subject_id)) ?? 0) + Number(t.est_hours));
    }
    return [...map.entries()].map(([name, hours]) => ({ name, hours }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, subjects]);

  const typeSplit = useMemo(() => {
    const map = new Map<TaskType, number>();
    for (const t of active) map.set(t.type, (map.get(t.type) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [active]);

  const trend = useMemo(
    () =>
      upcomingWeeks(tasks, 8).map((w) => ({
        week: w.weekStart.slice(5),
        score: w.score,
        hours: w.tasks.reduce((sum, t) => sum + Number(t.est_hours), 0),
      })),
    [tasks],
  );

  const performance = useMemo(() => subjectPerformance(marks), [marks]);

  const marksVsLoad = useMemo(() => {
    return performance.map((p) => {
      const subjectId = subjects.find((s) => s.name === p.subject)?.id ?? null;
      const load = tasks
        .filter((t) => t.subject_id === subjectId)
        .reduce((sum, t) => sum + (TYPE_WEIGHTS[t.type] ?? 1) * Number(t.est_hours), 0);
      return { subject: p.subject, average: p.average, load };
    });
  }, [performance, subjects, tasks]);

  const corr = useMemo(
    () =>
      correlation(
        marksVsLoad.map((m) => m.load),
        marksVsLoad.map((m) => m.average),
      ),
    [marksVsLoad],
  );

  async function explain() {
    setBusy(true);
    try {
      const res = await explainPanicScore({ data: buildAIContext(tasks, subjects, marks) });
      setExplanation(res.answer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not explain the score.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Analytics"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportCSV(tasksToRows(tasks, nameOf), "tasks.csv");
              toast.success("CSV downloaded.");
            }}
          >
            <Download className="size-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportTasksPDF(tasks, nameOf, "Semester report");
              toast.success("PDF downloaded.");
            }}
          >
            <FileText className="size-4" /> PDF report
          </Button>
        </div>
      }
    >
      <AIKeyGate />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject-wise workload (hours)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {subjectSplit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active tasks yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjectSplit}
                    dataKey="hours"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {subjectSplit.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task type mix</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {typeSplit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active tasks yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeSplit}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {typeSplit.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Panic score trend (next 8 weeks)</CardTitle>
            <Button size="sm" variant="outline" onClick={explain} disabled={busy}>
              <Sparkles className="size-4" /> {busy ? "Thinking…" : "Explain my score"}
            </Button>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="week" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="var(--color-busy)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
          {explanation && (
            <CardContent className="border-t border-border pt-4">
              <AIBadge label="Score explainer" />
              <AIAnswer text={explanation} className="mt-2" />
            </CardContent>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Marks vs workload</CardTitle>
          </CardHeader>
          <CardContent>
            {marksVsLoad.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add some marks to see how workload tracks against performance.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Correlation between weighted workload and average marks:{" "}
                  <span className="font-semibold text-foreground">{corr}</span>{" "}
                  {corr <= -0.3
                    ? "— heavier subjects are pulling your marks down."
                    : corr >= 0.3
                      ? "— you score better where you put in more work."
                      : "— no strong relationship yet."}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2">Subject</th>
                        <th className="py-2">Average</th>
                        <th className="py-2">Weighted load</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marksVsLoad.map((row) => (
                        <tr key={row.subject} className="border-t border-border">
                          <td className="py-2">{row.subject}</td>
                          <td className="py-2">{row.average}%</td>
                          <td className="py-2">{row.load}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent results</CardTitle>
          </CardHeader>
          <CardContent>
            {marks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No marks recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {marks.slice(0, 8).map((m) => (
                  <li key={m.id} className="flex items-center justify-between border-b border-border pb-2">
                    <span>
                      {m.subject_name} · <span className="text-muted-foreground">{m.exam_name}</span>
                    </span>
                    <span className="font-semibold">{percentOf(m)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Weeks at a glance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {trend.map((w) => (
              <span
                key={w.week}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: `color-mix(in oklab, ${STATUS_COLOR[classify(w.score)]} 18%, transparent)`,
                  color: STATUS_COLOR[classify(w.score)],
                }}
              >
                {w.week} · {w.score}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

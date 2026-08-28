import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TaskModal } from "@/components/TaskModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClashBadge,
  PriorityBadge,
  StatusBadge,
  TypeBadge,
  UrgencyDot,
} from "@/components/badges";
import { syncPanicScores, useTasks } from "@/lib/tasks";
import {
  clashCounts,
  daysRemaining,
  findClashes,
  parseDate,
  priorityLabel,
  rankTasks,
  startOfToday,
  STATUS_COLOR,
  toISODate,
  upcomingWeeks,
  weekStart,
  type Task,
} from "@/lib/panic";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Studypace" },
      {
        name: "description",
        content: "See your weekly panic score, upcoming deadlines and workload at a glance.",
      },
      { property: "og:title", content: "Dashboard — Studypace" },
      {
        property: "og:description",
        content: "Weekly panic score, upcoming deadlines and semester workload for students.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (tasks.length) void syncPanicScores(tasks);
  }, [tasks]);

  const weeks = useMemo(() => upcomingWeeks(tasks, 6), [tasks]);
  const ranked = useMemo(() => rankTasks(tasks), [tasks]);

  const currentWeek = weeks[0]!;
  const nextWeek = weeks[1]!;
  const clashes = useMemo(() => findClashes(tasks), [tasks]);
  const clashMap = useMemo(() => clashCounts(tasks), [tasks]);
  const today = startOfToday();
  const currentWeekKey = toISODate(weekStart(today));

  const activeTasks = tasks.filter(
    (t) => !t.is_completed && parseDate(t.deadline_date) >= today,
  );
  const dueThisWeek = activeTasks.filter(
    (t) => toISODate(weekStart(parseDate(t.deadline_date))) === currentWeekKey,
  );
  const completed = tasks.filter((t) => t.is_completed);
  const upcoming = [...activeTasks]
    .sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
    .slice(0, 5);

  const chartData = weeks.map((w) => ({
    label: weekLabel(w.weekStart),
    hours: w.hours,
    status: w.status,
    score: w.score,
  }));

  return (
    <AppShell
      title="Dashboard"
      actions={
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="size-4" /> Add Task
        </Button>
      }
    >
      {currentWeek.status === "overloaded" && (
        <div className="mb-3 rounded-xl border border-overloaded/40 bg-overloaded/10 px-4 py-3 text-sm font-medium text-overloaded">
          🔴 This week ({weekRangeLabel(currentWeek.weekStart)}) is overloaded! Score:{" "}
          {currentWeek.score.toFixed(1)} — {currentWeek.tasks.length} tasks competing for your time.
        </div>
      )}
      {nextWeek.status === "overloaded" && (
        <div className="mb-3 rounded-xl border border-overloaded/40 bg-overloaded/10 px-4 py-3 text-sm font-medium text-overloaded">
          🔴 Next week ({weekRangeLabel(nextWeek.weekStart)}) is overloaded! Score:{" "}
          {nextWeek.score.toFixed(1)}
        </div>
      )}
      {(currentWeek.status === "overloaded" || nextWeek.status === "overloaded") && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/planner">Rebalance my workload</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/analytics">Explain my panic score</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Active Tasks" value={activeTasks.length} />
        <Metric label="Tasks Due This Week" value={dueThisWeek.length} />
        <Metric
          label="Current Week Panic Score"
          value={currentWeek.score.toFixed(2)}
          extra={<StatusBadge status={currentWeek.status} />}
        />
        <Metric label="Tasks Completed This Semester" value={completed.length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Workload — next 6 weeks</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number, _n, item) => [
                    `${value} h · score ${(item?.payload as { score: number }).score}`,
                    "Workload",
                  ]}
                />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLOR[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No upcoming tasks yet.{" "}
                <button className="text-primary underline" onClick={() => setModalOpen(true)}>
                  Add your first one
                </button>
                .
              </p>
            )}
            {upcoming.map((task: Task) => {
              const days = daysRemaining(task.deadline_date);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <UrgencyDot days={days} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <TypeBadge type={task.type} />
                      <ClashBadge count={clashMap[task.id] ?? 0} />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {days} day{days === 1 ? "" : "s"}
                  </span>
                </div>
              );
            })}
            <Link to="/tasks" className="block pt-1 text-sm text-primary hover:underline">
              View all tasks →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Suggested order — what to do first</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ranked.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming tasks to prioritise.</p>
          )}
          {ranked.slice(0, 6).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="w-6 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                #{task.rank}
              </span>
              <UrgencyDot days={task.days} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
              <TypeBadge type={task.type} />
              <PriorityBadge label={priorityLabel(task.rank, ranked.length)} />
              <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">
                {task.days} day{task.days === 1 ? "" : "s"} left
              </span>
            </div>
          ))}
          {ranked.length > 1 && (
            <p className="pt-1 text-xs text-muted-foreground">
              Ranked by deadline urgency, task weight, estimated hours and same-day clashes. #1 is
              what to start now; the last one can wait.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">

        <CardHeader>
          <CardTitle className="text-base">Deadline Clashes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clashes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No clashes — none of your upcoming deadlines fall on the same day.
            </p>
          )}
          {clashes.map((clash) => (
            <div key={clash.date} className="rounded-lg border border-overloaded/30 bg-overloaded/5 px-3 py-2">
              <p className="text-sm font-semibold text-overloaded">
                {parseDate(clash.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}{" "}
                — {clash.tasks.length} tasks due
              </p>
              <ul className="mt-1 space-y-1">
                {clash.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 text-sm">
                    <span className="truncate">{task.title}</span>
                    <TypeBadge type={task.type} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <TaskModal open={modalOpen} onOpenChange={setModalOpen} />
    </AppShell>
  );
}

function Metric({
  label,
  value,
  extra,
}: {
  label: string;
  value: string | number;
  extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-3xl font-bold">{value}</p>
          {extra}
        </div>
      </CardContent>
    </Card>
  );
}

function weekRangeLabel(iso: string) {
  const start = parseDate(iso);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)}–${fmt(end)}`;
}

function weekLabel(iso: string) {
  const d = parseDate(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

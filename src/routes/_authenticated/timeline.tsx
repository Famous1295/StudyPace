import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { ClashBadge, TypeBadge, UrgencyDot } from "@/components/badges";
import { StatusBadge } from "@/components/badges";
import { Card } from "@/components/ui/card";
import { useTasks } from "@/lib/tasks";
import {
  clashCounts,
  classify,
  daysRemaining,
  individualScore,
  parseDate,
  startOfToday,
  toISODate,
  weekStart,
  type Task,
} from "@/lib/panic";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — Studypace" },
      {
        name: "description",
        content: "A week-by-week vertical timeline of every upcoming academic deadline.",
      },
      { property: "og:title", content: "Timeline — Studypace" },
      {
        property: "og:description",
        content: "See your semester deadlines in chronological order, grouped by week.",
      },
    ],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  const { data: tasks = [], isLoading } = useTasks();

  const clashMap = useMemo(() => clashCounts(tasks), [tasks]);

  const groups = useMemo(() => {
    const today = startOfToday();
    const upcoming = tasks
      .filter((t) => !t.is_completed && parseDate(t.deadline_date) >= today)
      .sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
    const map = new Map<string, Task[]>();
    for (const task of upcoming) {
      const key = toISODate(weekStart(parseDate(task.deadline_date)));
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return [...map.entries()].map(([week, items]) => ({
      week,
      items,
      status: classify(items.reduce((sum, t) => sum + individualScore(t), 0)),
    }));
  }, [tasks]);

  return (
    <AppShell title="Timeline">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing scheduled ahead. Enjoy the calm.</p>
      )}

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.week}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Week of {parseDate(group.week).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <StatusBadge status={group.status} />
              <div className="h-px flex-1 bg-border" />
            </div>

            <Card className="p-0">
              <ol className="relative ml-5 border-l border-border py-2">
                {group.items.map((task) => {
                  const days = daysRemaining(task.deadline_date);
                  return (
                    <li key={task.id} className="relative py-3 pl-6 pr-4">
                      <span className="absolute -left-[5px] top-5">
                        <UrgencyDot days={days} />
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {parseDate(task.deadline_date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="font-medium">{task.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <TypeBadge type={task.type} />
                        <ClashBadge count={clashMap[task.id] ?? 0} />
                        <span className="text-xs text-muted-foreground">
                          {days} day{days === 1 ? "" : "s"} remaining
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

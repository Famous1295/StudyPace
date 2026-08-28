import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TaskModal } from "@/components/TaskModal";
import { ClashBadge, PriorityBadge, TypeBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTaskMutations, useTasks } from "@/lib/tasks";
import {
  clashCounts,
  daysRemaining,
  individualScore,
  parseDate,
  priorityLabel,
  rankTasks,
  type Task,
  type TaskType,
} from "@/lib/panic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "All tasks — Studypace" },
      {
        name: "description",
        content: "Every exam, assignment, lab and project with its score contribution.",
      },
      { property: "og:title", content: "All tasks — Studypace" },
      {
        property: "og:description",
        content: "Filter, complete and edit your academic tasks in one table.",
      },
    ],
  }),
  component: TasksPage,
});

const FILTERS: (TaskType | "all")[] = ["all", "exam", "assignment", "lab", "project"];

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const { remove, toggle } = useTaskMutations();
  const [filter, setFilter] = useState<TaskType | "all">("all");
  const [sortBy, setSortBy] = useState<"priority" | "deadline">("priority");
  const [editing, setEditing] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const clashMap = useMemo(() => clashCounts(tasks), [tasks]);
  const ranked = useMemo(() => rankTasks(tasks), [tasks]);
  const rankMap = useMemo(
    () => Object.fromEntries(ranked.map((t) => [t.id, t.rank] as const)),
    [ranked],
  );

  const rows = useMemo(() => {
    const list = tasks.filter((t) => filter === "all" || t.type === filter);
    if (sortBy === "deadline")
      return [...list].sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
    return [...list].sort(
      (a, b) =>
        (rankMap[a.id] ?? Infinity) - (rankMap[b.id] ?? Infinity) ||
        a.deadline_date.localeCompare(b.deadline_date),
    );
  }, [tasks, filter, sortBy, rankMap]);


  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <AppShell
      title="Tasks"
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as "priority" | "deadline")}
          >
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Do-first order</SelectItem>
              <SelectItem value="deadline">Deadline</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as TaskType | "all")}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] capitalize sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f} value={f} className="capitalize">
                  {f === "all" ? "All types" : f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button className="w-full sm:w-auto" onClick={openNew}>
            <Plus className="size-4" /> Add Task
          </Button>
        </div>
      }
    >
      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && rows.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">No tasks yet.</Card>
        )}
        {rows.map((task) => {
          const days = daysRemaining(task.deadline_date);
          const rank = rankMap[task.id];
          return (
            <Card key={task.id} className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-1 shrink-0"
                  checked={task.is_completed}
                  onCheckedChange={(checked) =>
                    toggle.mutate({ id: task.id, is_completed: checked === true })
                  }
                  aria-label="Mark complete"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "break-words font-medium",
                      task.is_completed && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <TypeBadge type={task.type} />
                    {rank ? <PriorityBadge label={priorityLabel(rank, ranked.length)} /> : null}
                    <ClashBadge count={clashMap[task.id] ?? 0} />
                    <span>{parseDate(task.deadline_date).toLocaleDateString()}</span>
                    <span>· {days} days left</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit task"
                    onClick={() => {
                      setEditing(task);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete task"
                    onClick={() => remove.mutate(task.id)}
                  >
                    <Trash2 className="size-4 text-overloaded" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Done</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Days left</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-muted-foreground">
                  No tasks yet.
                </td>
              </tr>
            )}

            {rows.map((task) => {
              const days = daysRemaining(task.deadline_date);
              const counted = !task.is_completed;
              const rank = rankMap[task.id];
              return (
                <tr key={task.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={task.is_completed}
                      onCheckedChange={(checked) =>
                        toggle.mutate({ id: task.id, is_completed: checked === true })
                      }
                      aria-label="Mark complete"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {rank ? (
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">#{rank}</span>
                        <PriorityBadge label={priorityLabel(rank, ranked.length)} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td
                    className={cn(
                      "px-4 py-3 font-medium",
                      task.is_completed && "text-muted-foreground line-through",
                    )}
                  >
                    <span className="mr-2">{task.title}</span>
                    <ClashBadge count={clashMap[task.id] ?? 0} />
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={task.type} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {parseDate(task.deadline_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{days}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {counted ? individualScore(task).toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit task"
                        onClick={() => {
                          setEditing(task);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete task"
                        onClick={() => remove.mutate(task.id)}
                      >
                        <Trash2 className="size-4 text-overloaded" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <TaskModal open={modalOpen} onOpenChange={setModalOpen} task={editing} />
    </AppShell>
  );
}

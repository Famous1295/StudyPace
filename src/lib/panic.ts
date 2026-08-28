export type TaskType = "exam" | "assignment" | "lab" | "project";

export const TYPE_WEIGHTS: Record<TaskType, number> = {
  exam: 3,
  assignment: 2,
  project: 2,
  lab: 1,
};

export interface Task {
  id: string;
  user_id: string;
  title: string;
  type: TaskType;
  weight: number;
  deadline_date: string;
  est_hours: number;
  is_completed: boolean;
  created_at: string;
  subject_id?: string | null;

}

export type PanicStatus = "safe" | "busy" | "overloaded";

export const STATUS_LABEL: Record<PanicStatus, string> = {
  safe: "Safe",
  busy: "Busy",
  overloaded: "Overloaded",
};

export function classify(score: number): PanicStatus {
  if (score < 5) return "safe";
  if (score < 10) return "busy";
  return "overloaded";
}

/** Groups incomplete, non-past tasks by deadline date; any date with 2+ tasks is a clash. */
export function findClashes(tasks: Task[]): { date: string; tasks: Task[] }[] {
  const today = startOfToday();
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.is_completed) continue;
    if (parseDate(task.deadline_date) < today) continue;
    map.set(task.deadline_date, [...(map.get(task.deadline_date) ?? []), task]);
  }
  return [...map.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([date, items]) => ({ date, tasks: items }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Map of task id -> number of OTHER tasks sharing its deadline. */
export function clashCounts(tasks: Task[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const group of findClashes(tasks)) {
    for (const task of group.tasks) out[task.id] = group.tasks.length - 1;
  }
  return out;
}


/** Local (timezone-safe) parse of a yyyy-mm-dd date string. */
export function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysRemaining(deadline: string, from: Date = startOfToday()): number {
  const diff = Math.ceil((parseDate(deadline).getTime() - from.getTime()) / 86_400_000);
  return Math.max(1, diff);
}

export function individualScore(task: Pick<Task, "weight" | "deadline_date">): number {
  return task.weight / daysRemaining(task.deadline_date);
}

/** Monday-based start of the week containing `date`, as yyyy-mm-dd. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

export function toISODate(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export interface WeekBucket {
  weekStart: string;
  score: number;
  status: PanicStatus;
  hours: number;
  tasks: Task[];
}

/** Groups active, non-past tasks into Monday-start weeks with panic scores. */
export function computeWeeklyPanic(tasks: Task[]): WeekBucket[] {
  const today = startOfToday();
  const active = tasks.filter((t) => !t.is_completed && parseDate(t.deadline_date) >= today);
  const buckets = new Map<string, WeekBucket>();

  for (const task of active) {
    const key = toISODate(weekStart(parseDate(task.deadline_date)));
    const bucket = buckets.get(key) ?? {
      weekStart: key,
      score: 0,
      status: "safe" as PanicStatus,
      hours: 0,
      tasks: [],
    };
    bucket.score += individualScore(task);
    bucket.hours += task.est_hours ?? 0;
    bucket.tasks.push(task);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((b) => ({ ...b, score: Math.round(b.score * 100) / 100, status: classify(b.score) }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** The next `count` weeks starting from the current week, filled with bucket data. */
export function upcomingWeeks(tasks: Task[], count = 6): WeekBucket[] {
  const buckets = computeWeeklyPanic(tasks);
  const byKey = new Map(buckets.map((b) => [b.weekStart, b]));
  const start = weekStart(startOfToday());
  const out: WeekBucket[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    const key = toISODate(d);
    out.push(byKey.get(key) ?? { weekStart: key, score: 0, status: "safe", hours: 0, tasks: [] });
  }
  return out;
}

export const STATUS_COLOR: Record<PanicStatus, string> = {
  safe: "#10B981",
  busy: "#F59E0B",
  overloaded: "#EF4444",
};

/**
 * Priority engine — decides what to do first.
 * priority = (weight × urgency) + effort pressure + clash penalty
 *   urgency        = 10 / days remaining (closer deadline ⇒ far more urgent)
 *   effort pressure= estimated hours / days remaining (can you still fit it in?)
 *   clash penalty  = +1.5 per other task sharing the same deadline
 * Higher priority ⇒ do it sooner.
 */
export interface RankedTask extends Task {
  rank: number;
  priority: number;
  days: number;
  clashes: number;
}

export function rankTasks(tasks: Task[]): RankedTask[] {
  const clashes = clashCounts(tasks);
  // Every open task is ranked — overdue ones included, so nothing shows a blank order.
  return tasks
    .filter((t) => !t.is_completed)
    .map((task) => {
      const days = daysRemaining(task.deadline_date);
      const priority =
        (task.weight * 10) / days + (task.est_hours ?? 0) / days + (clashes[task.id] ?? 0) * 1.5;
      return {
        ...task,
        days,
        clashes: clashes[task.id] ?? 0,
        priority: Math.round(priority * 100) / 100,
        rank: 0,
      };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.deadline_date.localeCompare(b.deadline_date) ||
        b.weight - a.weight,
    )
    .map((task, i) => ({ ...task, rank: i + 1 }));
}

export function priorityLabel(rank: number, total: number): string {
  if (total === 0) return "";
  if (rank === 1) return "Do first";
  if (rank === total && total > 1) return "Do last";
  if (rank <= Math.ceil(total / 3)) return "High";
  if (rank <= Math.ceil((total * 2) / 3)) return "Medium";
  return "Low";
}


import { daysRemaining, parseDate, startOfToday, upcomingWeeks, type Task } from "@/lib/panic";
import { percentOf, type Mark } from "@/lib/marks";
import type { StudentSubject } from "@/lib/subjects";

export interface AIContext {
  tasks: {
    title: string;
    type: string;
    deadline_date: string;
    est_hours: number;
    days: number;
    subject: string | null;
  }[];
  weeks: { weekStart: string; score: number; hours: number }[];
  marks?: { subject: string; exam: string; percent: number }[];
}

/** Compact snapshot of the student's workload sent to the AI features. */
export function buildAIContext(
  tasks: Task[],
  subjects: StudentSubject[],
  marks: Mark[] = [],
): AIContext {
  const today = startOfToday();
  const nameOf = (id: string | null | undefined) =>
    subjects.find((s) => s.id === id)?.name ?? null;

  const active = tasks
    .filter((t) => !t.is_completed && parseDate(t.deadline_date) >= today)
    .slice(0, 40);

  return {
    tasks: active.map((t) => ({
      title: t.title,
      type: t.type,
      deadline_date: t.deadline_date,
      est_hours: Number(t.est_hours),
      days: daysRemaining(t.deadline_date),
      subject: nameOf(t.subject_id),
    })),
    weeks: upcomingWeeks(tasks, 6).map((w) => ({
      weekStart: w.weekStart,
      score: w.score,
      hours: w.tasks.reduce((sum, t) => sum + Number(t.est_hours), 0),
    })),
    marks: marks.slice(0, 40).map((m) => ({
      subject: m.subject_name,
      exam: m.exam_name,
      percent: percentOf(m),
    })),
  };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  classify,
  daysRemaining,
  findClashes,
  parseDate,
  startOfToday,
  toISODate,
  upcomingWeeks,
  weekStart,
  type Task,
} from "@/lib/panic";

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationsQueryKey = ["notifications"];

export function useNotifications() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,kind,link,is_read,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: notificationsQueryKey });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { error } = await supabase.from("notifications").delete().eq("user_id", auth.user.id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  return { markAllRead, markRead, clear };
}

interface PendingNotification {
  title: string;
  body: string;
  kind: string;
  link: string;
  dedupe_key: string;
}

/** Deadline, overload and clash alerts derived from the current task list. */
export function buildNotifications(tasks: Task[]): PendingNotification[] {
  const out: PendingNotification[] = [];
  const today = startOfToday();
  const todayKey = toISODate(today);

  for (const task of tasks) {
    if (task.is_completed) continue;
    const due = parseDate(task.deadline_date);
    if (due < today) continue;
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (days === 1 || days === 0) {
      out.push({
        title: days === 0 ? `Due today: ${task.title}` : `Due tomorrow: ${task.title}`,
        body: `${task.type} • ${task.est_hours}h estimated • ${task.deadline_date}`,
        kind: days === 0 ? "urgent" : "reminder",
        link: "/tasks",
        dedupe_key: `deadline:${task.id}:${task.deadline_date}:${days}`,
      });
    }
  }

  const week = upcomingWeeks(tasks, 1)[0];
  if (week && classify(week.score) === "overloaded") {
    out.push({
      title: "This week is overloaded",
      body: `Panic score ${week.score} across ${week.tasks.length} tasks. Consider rebalancing.`,
      kind: "urgent",
      link: "/planner",
      dedupe_key: `overload:${toISODate(weekStart(today))}`,
    });
  }

  for (const clash of findClashes(tasks)) {
    if (daysRemaining(clash.date) > 14) continue;
    out.push({
      title: `Deadline clash on ${clash.date}`,
      body: clash.tasks.map((t) => t.title).join(" • "),
      kind: "warning",
      link: "/timeline",
      dedupe_key: `clash:${clash.date}:${clash.tasks.length}`,
    });
  }

  return out.map((n) => ({ ...n, dedupe_key: `${n.dedupe_key}:${todayKey.slice(0, 7)}` }));
}

/** Writes any newly-relevant notifications; duplicates are ignored by the unique key. */
export async function syncNotifications(tasks: Task[]) {
  const pending = buildNotifications(tasks);
  if (!pending.length) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase
    .from("notifications")
    .upsert(
      pending.map((n) => ({ ...n, user_id: auth.user!.id })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    );
}

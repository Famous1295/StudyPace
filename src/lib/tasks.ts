import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assertNotGuest } from "@/lib/guest";
import { supabase } from "@/integrations/supabase/client";
import {
  computeWeeklyPanic,
  TYPE_WEIGHTS,
  type Task,
  type TaskType,
} from "@/lib/panic";

export const tasksQueryKey = ["tasks"];

export function useTasks() {
  const qc = useQueryClient();

  // Tasks can also be created/edited/deleted from the Telegram bot — keep the
  // table in sync with the database without a manual refresh.
  useEffect(() => {
    // Unique name per mount: reusing one name returns an already-subscribed
    // channel, and adding listeners to it throws.
    const channel = supabase
      .channel(`tasks-sync-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: tasksQueryKey });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: tasksQueryKey,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("deadline_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    refetchOnWindowFocus: true,
  });
}

/** Persists the recalculated weekly panic scores for the signed-in user. */
export async function syncPanicScores(tasks: Task[]) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;
  const rows = computeWeeklyPanic(tasks).map((b) => ({
    user_id: userId,
    week_start_date: b.weekStart,
    score: b.score,
    status: b.status,
    calculated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  await supabase.from("panic_scores").upsert(rows, { onConflict: "user_id,week_start_date" });
}

export interface TaskInput {
  title: string;
  type: TaskType;
  deadline_date: string;
  est_hours: number;
  subject_id: string | null;
}

export function useSaveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string | undefined; input: TaskInput }) => {
      assertNotGuest();
      const payload = { ...input, weight: TYPE_WEIGHTS[input.type] };
      if (id) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("tasks").insert({ ...payload, user_id: auth.user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksQueryKey }),
  });
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      assertNotGuest();
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksQueryKey }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete task."),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      assertNotGuest();
      const { data, error } = await supabase
        .from("tasks")
        .update({ is_completed })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Task could not be updated.");
    },
    onMutate: async ({ id, is_completed }) => {
      await qc.cancelQueries({ queryKey: tasksQueryKey });
      const previous = qc.getQueryData<Task[]>(tasksQueryKey);
      qc.setQueryData<Task[]>(tasksQueryKey, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, is_completed } : t)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tasksQueryKey, ctx.previous);
      toast.error(err instanceof Error ? err.message : "Could not update task.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksQueryKey }),
  });
  return { remove, toggle };
}


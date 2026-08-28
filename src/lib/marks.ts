import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertNotGuest } from "@/lib/guest";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface Mark {
  id: string;
  user_id: string;
  subject_id: string | null;
  subject_name: string;
  exam_name: string;
  score: number;
  max_score: number;
  exam_date: string;
  created_at: string;
}

export interface MarkInput {
  subject_id: string | null;
  subject_name: string;
  exam_name: string;
  score: number;
  max_score: number;
  exam_date: string;
}

export const marksQueryKey = ["marks"];

export function useMarks() {
  return useQuery({
    queryKey: marksQueryKey,
    queryFn: async (): Promise<Mark[]> => {
      const { data, error } = await supabase
        .from("marks")
        .select("*")
        .order("exam_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        score: Number(row.score),
        max_score: Number(row.max_score),
      })) as Mark[];
    },
  });
}

export function useMarkMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: marksQueryKey });

  const create = useMutation({
    mutationFn: async (input: MarkInput) => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("marks").insert({ ...input, user_id: auth.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Marks recorded.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save marks."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      assertNotGuest();
      const { error } = await supabase.from("marks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete."),
  });

  return { create, remove };
}

export interface SubjectPerformance {
  subject: string;
  average: number;
  count: number;
  band: "weak" | "watch" | "strong";
}

export const WEAK_THRESHOLD = 50;
export const WATCH_THRESHOLD = 65;

export function percentOf(mark: Mark): number {
  if (!mark.max_score) return 0;
  return Math.round((mark.score / mark.max_score) * 1000) / 10;
}

/** Average percentage per subject, banded so weak subjects surface first. */
export function subjectPerformance(marks: Mark[]): SubjectPerformance[] {
  const groups = new Map<string, number[]>();
  for (const mark of marks) {
    const list = groups.get(mark.subject_name) ?? [];
    list.push(percentOf(mark));
    groups.set(mark.subject_name, list);
  }
  return [...groups.entries()]
    .map(([subject, values]) => {
      const average =
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
      const band: SubjectPerformance["band"] =
        average < WEAK_THRESHOLD ? "weak" : average < WATCH_THRESHOLD ? "watch" : "strong";
      return { subject, average, count: values.length, band };
    })
    .sort((a, b) => a.average - b.average);
}

/** Pearson correlation between two equal-length series; 0 when undefined. */
export function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = (xs[i] as number) - mx;
    const b = (ys[i] as number) - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return 0;
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
}

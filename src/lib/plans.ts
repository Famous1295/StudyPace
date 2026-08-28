import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertNotGuest } from "@/lib/guest";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface PlanDay {
  date: string;
  focus: string;
  hours: number;
}

export interface StudyPlan {
  id: string;
  title: string;
  subject_name: string | null;
  exam_date: string | null;
  source: string;
  notes: string | null;
  plan: PlanDay[];
  created_at: string;
}

export const plansQueryKey = ["study-plans"];

function normalisePlan(value: unknown): PlanDay[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => ({
      date: String(d["date"] ?? ""),
      focus: String(d["focus"] ?? ""),
      hours: Number(d["hours"] ?? 0),
    }));
}

export function useStudyPlans() {
  return useQuery({
    queryKey: plansQueryKey,
    queryFn: async (): Promise<StudyPlan[]> => {
      const { data, error } = await supabase
        .from("study_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        subject_name: row.subject_name,
        exam_date: row.exam_date,
        source: row.source,
        notes: row.notes,
        plan: normalisePlan(row.plan),
        created_at: row.created_at,
      }));
    },
  });
}

export interface StudyPlanInput {
  title: string;
  subject_name: string | null;
  exam_date: string | null;
  source: "ai" | "manual";
  notes: string | null;
  plan: PlanDay[];
}

export function usePlanMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: plansQueryKey });

  const save = useMutation({
    mutationFn: async (input: StudyPlanInput) => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("study_plans")
        .insert({ ...input, plan: input.plan as unknown as never, user_id: auth.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Study plan saved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the plan."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      assertNotGuest();
      const { error } = await supabase.from("study_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  return { save, remove };
}

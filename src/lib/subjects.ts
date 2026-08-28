import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertNotGuest } from "@/lib/guest";
import { supabase } from "@/integrations/supabase/client";
import { tasksQueryKey } from "@/lib/tasks";

export interface StudentSubject {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  created_at: string;
}

export const subjectsQueryKey = ["student-subjects"];

export function useMySubjects() {
  return useQuery({
    queryKey: subjectsQueryKey,
    queryFn: async (): Promise<StudentSubject[]> => {
      const { data, error } = await supabase
        .from("student_subjects")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StudentSubject[];
    },
  });
}

/** Platform-wide master subjects, used as suggestions when students add their own. */
export function useMasterSubjectSuggestions() {
  return useQuery({
    queryKey: ["master-subject-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id,name,code")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: subjectsQueryKey });
    void qc.invalidateQueries({ queryKey: tasksQueryKey });
  };

  const create = useMutation({
    mutationFn: async (input: { name: string; code: string | null }) => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("student_subjects")
        .insert({ ...input, user_id: auth.user.id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, name, code }: { id: string; name: string; code: string | null }) => {
      assertNotGuest();
      const { error } = await supabase
        .from("student_subjects")
        .update({ name, code })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      assertNotGuest();
      const { error } = await supabase.from("student_subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

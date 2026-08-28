import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useMyRole, type AppRole } from "@/lib/admin";

/* ---------------- role helpers ---------------- */

export function useIsGuest() {
  const { data: role } = useMyRole();
  return role === "guest";
}

/** Roles that are allowed to use the student workspace (tasks, marks, AI, groups). */
export const STUDENT_WORKSPACE_ROLES: AppRole[] = ["student", "guest", "admin"];

export interface ClassOverviewRow {
  branch_id: string | null;
  branch_name: string | null;
  semester: number | null;
  student_count: number;
  avg_panic: number;
  overloaded_students: number;
  total_tasks: number;
  completed_tasks: number;
}

export function useClassOverview(enabled = true) {
  return useQuery({
    queryKey: ["class-overview"],
    enabled,
    queryFn: async (): Promise<ClassOverviewRow[]> => {
      const { data, error } = await supabase.rpc("class_workload_overview");
      if (error) throw error;
      return (data ?? []) as ClassOverviewRow[];
    },
  });
}

/* ---------------- subject task feed (students + faculty) ---------------- */

export interface SubjectTaskRow {
  source: "student" | "faculty";
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  semester: number | null;
  title: string;
  type: string;
  deadline_date: string;
  est_hours: number;
  is_completed: boolean;
  student_name: string | null;
  created_at: string;
}

export function useSubjectTasks(enabled = true) {
  return useQuery({
    queryKey: ["faculty-subject-tasks"],
    enabled,
    queryFn: async (): Promise<SubjectTaskRow[]> => {
      const { data, error } = await supabase.rpc("faculty_subject_tasks");
      if (error) throw error;
      return (data ?? []) as SubjectTaskRow[];
    },
  });
}

/* ---------------- faculty ↔ subject assignments ---------------- */

export interface AssignedSubject {
  id: string;
  subject_id: string;
  name: string;
  code: string;
  semester: number | null;
  branch_id: string | null;
}

export function useMyTaughtSubjects() {
  return useQuery({
    queryKey: ["my-taught-subjects"],
    queryFn: async (): Promise<AssignedSubject[]> => {
      const { data, error } = await supabase
        .from("faculty_subjects")
        .select("id, subject_id, subjects(name, code, semester, branch_id)");
      if (error) throw error;
      return (data ?? []).map((row) => {
        const s = row.subjects as unknown as {
          name: string;
          code: string;
          semester: number | null;
          branch_id: string | null;
        } | null;
        return {
          id: row.id,
          subject_id: row.subject_id,
          name: s?.name ?? "Subject",
          code: s?.code ?? "",
          semester: s?.semester ?? null,
          branch_id: s?.branch_id ?? null,
        };
      });
    },
  });
}

/** Admin view: every faculty→subject assignment. */
export function useAllFacultyAssignments() {
  return useQuery({
    queryKey: ["faculty-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faculty_subjects")
        .select("id, faculty_id, subject_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFacultyAssignmentMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["faculty-assignments"] });
    void qc.invalidateQueries({ queryKey: ["my-taught-subjects"] });
    void qc.invalidateQueries({ queryKey: ["audit-log"] });
  };

  const assign = useMutation({
    mutationFn: async (input: { faculty_id: string; subject_id: string; label?: string }) => {
      const { error } = await supabase
        .from("faculty_subjects")
        .insert({ faculty_id: input.faculty_id, subject_id: input.subject_id });
      if (error) throw error;
      await logAudit("Faculty Subject Assigned", input.label ?? input.subject_id);
    },
    onSuccess: invalidate,
  });

  const unassign = useMutation({
    mutationFn: async (input: { id: string; label?: string }) => {
      const { error } = await supabase.from("faculty_subjects").delete().eq("id", input.id);
      if (error) throw error;
      await logAudit("Faculty Subject Unassigned", input.label ?? input.id);
    },
    onSuccess: invalidate,
  });

  return { assign, unassign };
}

/* ---------------- subject deadlines (faculty-set) ---------------- */

export interface SubjectDeadline {
  id: string;
  subject_id: string;
  created_by: string;
  title: string;
  type: string;
  deadline_date: string;
  est_hours: number;
  notes: string | null;
  created_at: string;
  subjects?: { name: string; code: string } | null;
}

export const deadlinesQueryKey = ["subject-deadlines"];

export function useSubjectDeadlines() {
  return useQuery({
    queryKey: deadlinesQueryKey,
    queryFn: async (): Promise<SubjectDeadline[]> => {
      const { data, error } = await supabase
        .from("subject_deadlines")
        .select("*, subjects(name, code)")
        .order("deadline_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SubjectDeadline[];
    },
  });
}

export function useDeadlineMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: deadlinesQueryKey });

  const save = useMutation({
    mutationFn: async (input: {
      id?: string;
      subject_id: string;
      title: string;
      type: string;
      deadline_date: string;
      est_hours: number;
      notes: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const payload = {
        subject_id: input.subject_id,
        title: input.title,
        type: input.type,
        deadline_date: input.deadline_date,
        est_hours: input.est_hours,
        notes: input.notes,
        created_by: auth.user.id,
      };
      if (input.id) {
        const { error } = await supabase
          .from("subject_deadlines")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subject_deadlines").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subject_deadlines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

/* ---------------- announcements ---------------- */

export interface Announcement {
  id: string;
  subject_id: string;
  created_by: string;
  author_name: string | null;
  title: string;
  message: string;
  created_at: string;
  subjects?: { name: string; code: string } | null;
}

export const announcementsQueryKey = ["announcements"];

export function useAnnouncements() {
  return useQuery({
    queryKey: announcementsQueryKey,
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, subjects(name, code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Announcement[];
    },
  });
}

export function useAnnouncementMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: announcementsQueryKey });

  const create = useMutation({
    mutationFn: async (input: { subject_id: string; title: string; message: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      const { error } = await supabase.from("announcements").insert({
        ...input,
        created_by: auth.user.id,
        author_name: profile?.full_name ?? auth.user.email ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, remove };
}

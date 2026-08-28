import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "faculty" | "student" | "guest";

export interface Branch {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  branch_id: string | null;
  semester: number | null;
}

export interface AdminUser {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  semester: number | null;
  branch: string | null;
  branch_id: string | null;
  status: string;
  created_at: string;
  role: AppRole;
}

export interface AuditEntry {
  id: string;
  admin_id: string;
  admin_name: string | null;
  action_type: string;
  target: string | null;
  details: string | null;
  created_at: string;
}

export interface NotificationSettings {
  id: boolean;
  whatsapp_enabled: boolean;
  email_digest_enabled: boolean;
  daily_reminder_time: string;
  weekly_digest_day: number;
  weekly_digest_time: string;
  twilio_whatsapp_from: string | null;
  aisensy_api_key: string | null;
  aisensy_campaign_name: string | null;
}

/* ---------------- role ---------------- */

export async function fetchMyRole(): Promise<AppRole | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("faculty")) return "faculty";
  return roles[0] ?? "student";
}

export function useMyRole() {
  return useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole, staleTime: 60_000 });
}

/* ---------------- audit ---------------- */

export async function logAudit(action_type: string, target?: string, details?: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  await supabase.from("audit_log").insert({
    admin_id: auth.user.id,
    admin_name: profile?.full_name ?? auth.user.email ?? null,
    action_type,
    target: target ?? null,
    details: details ?? null,
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit-log"],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
  });
}

/* ---------------- branches ---------------- */

export function useBranches(activeOnly = false) {
  return useQuery({
    queryKey: ["branches", activeOnly],
    queryFn: async (): Promise<Branch[]> => {
      let q = supabase.from("branches").select("*").order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });
}

export function useBranchMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["branches"] });
    qc.invalidateQueries({ queryKey: ["audit-log"] });
  };

  const save = useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      code: string;
      description: string | null;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from("branches")
          .update({ name: input.name, code: input.code, description: input.description })
          .eq("id", input.id);
        if (error) throw error;
        await logAudit("Branch Updated", input.code, input.name);
      } else {
        const { error } = await supabase
          .from("branches")
          .insert({ name: input.name, code: input.code, description: input.description });
        if (error) throw error;
        await logAudit("Branch Created", input.code, input.name);
      }
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async (branch: Branch) => {
      const { error } = await supabase
        .from("branches")
        .update({ is_active: !branch.is_active })
        .eq("id", branch.id);
      if (error) throw error;
      await logAudit(branch.is_active ? "Branch Deactivated" : "Branch Activated", branch.code);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (branch: Branch) => {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branch.id);
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Cannot delete — ${count} student${count === 1 ? " is" : "s are"} assigned to this branch. Deactivate instead.`,
        );
      }
      const { error } = await supabase.from("branches").delete().eq("id", branch.id);
      if (error) throw error;
      await logAudit("Branch Deleted", branch.code, branch.name);
    },
    onSuccess: invalidate,
  });

  return { save, toggleActive, remove };
}

export function useBranchStudentCounts() {
  return useQuery({
    queryKey: ["branch-student-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("profiles").select("branch_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.branch_id) counts[row.branch_id] = (counts[row.branch_id] ?? 0) + 1;
      }
      return counts;
    },
  });
}

/* ---------------- semesters ---------------- */

export function useSemesterSettings() {
  return useQuery({
    queryKey: ["semester-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semester_settings")
        .select("*")
        .order("semester");
      if (error) throw error;
      return (data ?? []) as { semester: number; is_active: boolean }[];
    },
  });
}

export function useToggleSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ semester, is_active }: { semester: number; is_active: boolean }) => {
      const { error } = await supabase
        .from("semester_settings")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("semester", semester);
      if (error) throw error;
      await logAudit(
        is_active ? "Semester Enabled" : "Semester Disabled",
        `Semester ${semester}`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["semester-settings"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });
}

/* ---------------- subjects ---------------- */

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async (): Promise<Subject[]> => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("semester")
        .order("code");
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });
}

export function useSubjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["subjects"] });
    qc.invalidateQueries({ queryKey: ["audit-log"] });
  };

  const save = useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      code: string;
      branch_id: string | null;
      semester: number | null;
    }) => {
      const payload = {
        name: input.name,
        code: input.code,
        branch_id: input.branch_id,
        semester: input.semester,
      };
      if (input.id) {
        const { error } = await supabase.from("subjects").update(payload).eq("id", input.id);
        if (error) throw error;
        await logAudit("Subject Updated", input.code, input.name);
      } else {
        const { error } = await supabase.from("subjects").insert(payload);
        if (error) throw error;
        await logAudit("Subject Created", input.code, input.name);
      }
    },
    onSuccess: invalidate,
  });

  const bulkImport = useMutation({
    mutationFn: async (rows: Subject[] | Omit<Subject, "id">[]) => {
      const { error } = await supabase.from("subjects").insert(rows as never);
      if (error) throw error;
      await logAudit("Subjects Bulk Imported", `${rows.length} subjects`);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (subject: Subject) => {
      const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
      if (error) throw error;
      await logAudit("Subject Deleted", subject.code, subject.name);
    },
    onSuccess: invalidate,
  });

  return { save, bulkImport, remove };
}

/* ---------------- users ---------------- */

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      const roleMap = new Map<string, AppRole>();
      for (const r of roles ?? []) {
        const role = r.role as AppRole;
        const current = roleMap.get(r.user_id);
        if (!current || role === "admin" || (role === "faculty" && current === "student")) {
          roleMap.set(r.user_id, role);
        }
      }
      return (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        username: p.username ?? null,
        email: p.email ?? null,
        semester: p.semester,
        branch: p.branch,
        branch_id: p.branch_id ?? null,
        status: p.status ?? "active",
        created_at: p.created_at,
        role: roleMap.get(p.id) ?? "student",
      }));
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      full_name: string;
      username?: string | null;
      email: string;
      semester: number | null;
      branch_id: string | null;
      role: AppRole;
    }) => {
      const { data: branch } = input.branch_id
        ? await supabase.from("branches").select("name").eq("id", input.branch_id).maybeSingle()
        : { data: null };
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: input.full_name,
          email: input.email,
          semester: input.semester,
          branch_id: input.branch_id,
          branch: branch?.name ?? null,
        })
        .eq("id", input.id);
      if (error) throw error;
      const username = input.username?.trim().toLowerCase();
      if (username) {
        const { error: usernameError } = await supabase.rpc("admin_set_username", {
          _user_id: input.id,
          _username: username,
        });
        if (usernameError) throw usernameError;
      }
      await supabase.from("user_roles").delete().eq("user_id", input.id);
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: input.id, role: input.role });
      if (roleError) throw roleError;
      await logAudit("User Updated", input.email, `Role: ${input.role}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });
}

export function useToggleSuspend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user: AdminUser) => {
      const next = user.status === "suspended" ? "active" : "suspended";
      const { error } = await supabase.from("profiles").update({ status: next }).eq("id", user.id);
      if (error) throw error;
      await logAudit(
        next === "suspended" ? "User Suspended" : "User Reactivated",
        user.email ?? user.id,
        "Reason: none provided",
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });
}

/* ---------------- notification settings ---------------- */

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: async (): Promise<NotificationSettings | null> => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationSettings) ?? null;
    },
  });
}

export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<NotificationSettings, "id">) => {
      const { error } = await supabase
        .from("notification_settings")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (error) throw error;
      await logAudit(
        "Notification Settings Changed",
        "Platform",
        `WhatsApp: ${input.whatsapp_enabled ? "on" : "off"}, Email digest: ${
          input.email_digest_enabled ? "on" : "off"
        }, Daily: ${input.daily_reminder_time}, Weekly: day ${input.weekly_digest_day} ${input.weekly_digest_time}, AiSensy campaign: ${input.aisensy_campaign_name ?? "not set"}`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-settings"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });
}

/* ---------------- all tasks (admin oversight) ---------------- */

export interface AdminTask {
  id: string;
  title: string;
  type: string;
  deadline_date: string;
  est_hours: number;
  is_completed: boolean;
  created_at: string;
  user_id: string;
  owner_name: string;
  owner_email: string | null;
  branch: string | null;
  semester: number | null;
}

export function useAllTasks() {
  return useQuery({
    queryKey: ["admin-all-tasks"],
    queryFn: async (): Promise<AdminTask[]> => {
      const [{ data: tasks, error }, { data: profiles }] = await Promise.all([
        supabase.from("tasks").select("*").order("deadline_date", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email, branch, semester"),
      ]);
      if (error) throw error;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (tasks ?? []).map((t) => {
        const p = byId.get(t.user_id);
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          deadline_date: t.deadline_date,
          est_hours: t.est_hours,
          is_completed: t.is_completed,
          created_at: t.created_at,
          user_id: t.user_id,
          owner_name: p?.full_name ?? p?.email ?? "Unknown user",
          owner_email: p?.email ?? null,
          branch: p?.branch ?? null,
          semester: p?.semester ?? null,
        };
      });
    },
  });
}

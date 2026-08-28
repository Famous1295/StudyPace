import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertNotGuest } from "@/lib/guest";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface GroupMember {
  id: string;
  project_id: string;
  display_name: string;
  email: string | null;
  user_id: string | null;
  username: string | null;
  status: string;
}


export interface GroupItem {
  id: string;
  project_id: string;
  title: string;
  est_hours: number;
  is_done: boolean;
  assignee_id: string | null;
}

export interface GroupProject {
  id: string;
  name: string;
  description: string | null;
  deadline_date: string | null;
  owner_id: string;
  members: GroupMember[];
  items: GroupItem[];
}

export const groupsQueryKey = ["group-projects"];

export function useGroupProjects() {
  return useQuery({
    queryKey: groupsQueryKey,
    queryFn: async (): Promise<GroupProject[]> => {
      const { data: projects, error } = await supabase
        .from("group_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (projects ?? []).map((p) => p.id);
      if (!ids.length) return [];

      const [{ data: members }, { data: items }] = await Promise.all([
        supabase.from("group_members").select("*").in("project_id", ids),
        supabase.from("group_items").select("*").in("project_id", ids),
      ]);

      const { data: auth } = await supabase.auth.getUser();
      const myId = auth.user?.id ?? null;

      return (projects ?? [])
        .map((p) => ({
          ...p,
          members: ((members ?? []) as GroupMember[]).filter((m) => m.project_id === p.id),
          items: ((items ?? []) as GroupItem[]).filter((i) => i.project_id === p.id),
        }))
        // Projects I've only been invited to live in the invites section until accepted.
        .filter(
          (p) =>
            p.owner_id === myId ||
            p.members.some((m) => m.user_id === myId && m.status === "accepted"),
        );

    },
  });
}

export function useGroupMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: groupsQueryKey });
  const fail = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : "Something went wrong.");

  const createProject = useMutation({
    mutationFn: async (input: {
      name: string;
      description: string | null;
      deadline_date: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("group_projects")
        .insert({ ...input, owner_id: auth.user.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: memberError } = await supabase.from("group_members").insert({
        project_id: data.id,
        display_name: auth.user.email?.split("@")[0] ?? "Me",
        email: auth.user.email ?? null,
        user_id: auth.user.id,
      });
      if (memberError) throw memberError;
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Project created.");
    },
    onError: fail,
  });

  const removeProject = useMutation({
    mutationFn: async (id: string) => {
      assertNotGuest();
      const { error } = await supabase.from("group_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: fail,
  });

  const addMember = useMutation({
    mutationFn: async (input: { project_id: string; username: string }) => {
      assertNotGuest();
      const { error } = await supabase.rpc("invite_group_member", {
        _project_id: input.project_id,
        _username: input.username.trim().toLowerCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Invite sent.");
    },
    onError: fail,
  });


  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      assertNotGuest();
      const { error } = await supabase.from("group_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: fail,
  });

  const addItem = useMutation({
    mutationFn: async (input: {
      project_id: string;
      title: string;
      est_hours: number;
      assignee_id: string | null;
    }) => {
      const { error } = await supabase.from("group_items").insert(input);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: fail,
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      assignee_id?: string | null;
      is_done?: boolean;
    }) => {
      const { error } = await supabase.from("group_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: fail,
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      assertNotGuest();
      const { error } = await supabase.from("group_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: fail,
  });

  return {
    createProject,
    removeProject,
    addMember,
    removeMember,
    addItem,
    updateItem,
    removeItem,
  };
}

export interface MemberLoad {
  member: GroupMember | null;
  hours: number;
  share: number;
}

/** Hours per member plus the share of the project's total, for fair-split checks. */
export function memberLoads(project: GroupProject): MemberLoad[] {
  const total = project.items.reduce((sum, i) => sum + Number(i.est_hours), 0) || 1;
  const rows: MemberLoad[] = project.members
    .filter((m) => m.status === "accepted")
    .map((member) => {

    const hours = project.items
      .filter((i) => i.assignee_id === member.id)
      .reduce((sum, i) => sum + Number(i.est_hours), 0);
    return { member, hours, share: Math.round((hours / total) * 100) };
  });
  const unassigned = project.items
    .filter((i) => !i.assignee_id)
    .reduce((sum, i) => sum + Number(i.est_hours), 0);
  if (unassigned > 0) {
    rows.push({ member: null, hours: unassigned, share: Math.round((unassigned / total) * 100) });
  }
  return rows.sort((a, b) => b.hours - a.hours);
}

/** Suggests who should take the next piece of work to even out the split. */
export function suggestBalance(project: GroupProject): string | null {
  const loads = memberLoads(project).filter((l) => l.member);
  if (loads.length < 2) return null;
  const highest = loads[0]!;
  const lowest = loads[loads.length - 1]!;
  const gap = highest.hours - lowest.hours;
  if (gap < 2) return "Workload is evenly split across the team.";
  return `${highest.member!.display_name} is carrying ${gap}h more than ${lowest.member!.display_name}. Move a task across to even it out.`;
}

// ---------------------------------------------------------------- invitations

export interface GroupInvite {
  member_id: string;
  project_id: string;
  project_name: string;
  deadline_date: string | null;
  invited_by_name: string | null;
  created_at: string;
}

export const invitesQueryKey = ["group-invites"];

export function useMyGroupInvites() {
  return useQuery({
    queryKey: invitesQueryKey,
    queryFn: async (): Promise<GroupInvite[]> => {
      const { data, error } = await supabase.rpc("my_group_invites");
      if (error) throw error;
      return (data ?? []) as GroupInvite[];
    },
    refetchInterval: 60_000,
  });
}

export function useRespondToInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, accept }: { memberId: string; accept: boolean }) => {
      assertNotGuest();
      const { error } = await supabase.rpc("respond_group_invite", {
        _member_id: memberId,
        _accept: accept,
      });
      if (error) throw error;
      return accept;
    },
    onSuccess: (accept) => {
      void qc.invalidateQueries({ queryKey: invitesQueryKey });
      void qc.invalidateQueries({ queryKey: groupsQueryKey });
      toast.success(accept ? "You joined the project." : "Invite declined.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not respond."),
  });
}

// ---------------------------------------------------------------- group chat

export interface GroupMessage {
  id: string;
  project_id: string;
  user_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export function useGroupMessages(projectId: string) {
  return useQuery({
    queryKey: ["group-messages", projectId],
    queryFn: async (): Promise<GroupMessage[]> => {
      const { data, error } = await supabase
        .from("group_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as GroupMessage[];
    },
    refetchInterval: 10_000,
  });
}

export function useSendGroupMessage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", auth.user.id)
        .maybeSingle();
      const { error } = await supabase.from("group_messages").insert({
        project_id: projectId,
        user_id: auth.user.id,
        author_name: profile?.full_name ?? profile?.username ?? "Member",
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["group-messages", projectId] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Message not sent."),
  });
}

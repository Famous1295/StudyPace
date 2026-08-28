import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assertNotGuest } from "@/lib/guest";
import { supabase } from "@/integrations/supabase/client";

export interface SupportTicket {
  id: string;
  user_id: string;
  category: string;
  topic: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "solved";
  admin_reply: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface SupportTicketWithUser extends SupportTicket {
  user_name: string | null;
  user_email: string | null;
}

/** Help menu: category -> submenu topics. */
export const HELP_MENU: { category: string; topics: string[] }[] = [
  {
    category: "Account & access",
    topics: ["Cannot sign in", "Change email or phone", "Delete my account", "Role or branch is wrong"],
  },
  {
    category: "Tasks & deadlines",
    topics: ["Task not saving", "Wrong panic score", "Deadline clash issue", "Missing subject"],
  },
  {
    category: "Reminders",
    topics: ["Telegram not connected", "Not receiving emails", "Wrong reminder timing"],
  },
  {
    category: "AI assistant",
    topics: ["Assistant not responding", "My API key isn't used", "Study plan quality"],
  },
  {
    category: "Marks & analytics",
    topics: ["Marks not showing", "Analytics look wrong", "Export / PDF issue"],
  },
  { category: "Other", topics: ["Feature request", "Report a bug", "General question"] },
];

export const myTicketsKey = ["support-tickets", "mine"];
export const allTicketsKey = ["support-tickets", "all"];

export function useMyTickets() {
  return useQuery({
    queryKey: myTicketsKey,
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupportTicket[];
    },
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { category: string; topic: string; subject: string; message: string }) => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("support_tickets").insert({
        user_id: auth.user.id,
        category: input.category,
        topic: input.topic,
        subject: input.subject,
        message: input.message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: myTicketsKey });
      toast.success("Your request has been sent to the admin team.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the request."),
  });
}

/* ------------------------ admin ------------------------ */

export function useAllTickets() {
  return useQuery({
    queryKey: allTicketsKey,
    queryFn: async (): Promise<SupportTicketWithUser[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as SupportTicket[];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      let profiles: { id: string; full_name: string | null; email: string | null }[] = [];
      if (ids.length) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        profiles = p ?? [];
      }
      const byId = new Map(profiles.map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        user_name: byId.get(r.user_id)?.full_name ?? null,
        user_email: byId.get(r.user_id)?.email ?? null,
      }));
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: SupportTicket["status"]; admin_reply?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("support_tickets")
        .update({
          status: input.status,
          admin_reply: input.admin_reply ?? null,
          resolved_by: input.status === "solved" ? auth.user?.id ?? null : null,
          resolved_at: input.status === "solved" ? new Date().toISOString() : null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: allTicketsKey });
      toast.success("Query updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update the query."),
  });
}

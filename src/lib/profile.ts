import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertNotGuest } from "@/lib/guest";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface MyProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  tour_completed_at: string | null;
  semester: number | null;
  branch: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  weekly_email_opt_in: boolean;
  telegram_opt_in: boolean;
  telegram_chat_id: number | null;
  telegram_link_code: string | null;
  twilio_chat_id: string | null;
  twilio_link_code: string | null;
  twilio_opt_in: boolean;
  aisensy_chat_id: string | null;
  aisensy_link_code: string | null;
  aisensy_opt_in: boolean;
}

export const TELEGRAM_BOT_USERNAME = "Smart_workload_balancer_bot";

export const profileQueryKey = ["my-profile"];

/** E.164, e.g. +919876543210 */
export const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

const profileSelect = "id, full_name, username, tour_completed_at, semester, branch, email, phone, whatsapp_opt_in, weekly_email_opt_in, telegram_opt_in, telegram_chat_id, telegram_link_code, twilio_chat_id, twilio_link_code, twilio_opt_in, aisensy_chat_id, aisensy_link_code, aisensy_opt_in";

export function useMyProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MyProfile | null) ?? null;
    },
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Pick<MyProfile, "full_name" | "username" | "phone" | "whatsapp_opt_in" | "weekly_email_opt_in" | "telegram_opt_in" | "twilio_opt_in" | "aisensy_opt_in">>) => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(input).eq("id", auth.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileQueryKey });
      toast.success("Settings saved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save settings."),
  });
}

export function useRefreshTwilioCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { error } = await supabase
        .from("profiles")
        .update({ twilio_link_code: code, twilio_chat_id: null, twilio_opt_in: false })
        .eq("id", auth.user.id);
      if (error) throw error;
      return code;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileQueryKey });
      toast.success("WhatsApp code refreshed.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not refresh code."),
  });
}

export function useRefreshAiSensyCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { error } = await supabase
        .from("profiles")
        .update({ aisensy_link_code: code, aisensy_chat_id: null, aisensy_opt_in: false })
        .eq("id", auth.user.id);
      if (error) throw error;
      return code;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileQueryKey });
      toast.success("WhatsApp code refreshed.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not refresh code."),
  });
}

export interface ReminderLogRow {
  id: string;
  task_id: string;
  channel: string;
  status: string;
  detail: string | null;
  sent_for_date: string;
  created_at: string;
}

export function useMyReminders() {
  return useQuery({
    queryKey: ["my-reminders"],
    queryFn: async (): Promise<ReminderLogRow[]> => {
      const { data, error } = await supabase
        .from("reminder_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as ReminderLogRow[];
    },
  });
}

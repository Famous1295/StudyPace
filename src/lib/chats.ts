import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertNotGuest } from "@/lib/guest";
import { supabase } from "@/integrations/supabase/client";

export interface AIChat {
  id: string;
  category: string;
  question: string;
  answer: string;
  created_at: string;
}

export const chatsQueryKey = ["ai-chats"];

export function useAIChats() {
  return useQuery({
    queryKey: chatsQueryKey,
    queryFn: async (): Promise<AIChat[]> => {
      const { data, error } = await supabase
        .from("ai_chats")
        .select("id,category,question,answer,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AIChat[];
    },
  });
}

export function useSaveChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { category: string; question: string; answer: string }) => {
      assertNotGuest();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { error } = await supabase.from("ai_chats").insert({ ...input, user_id: auth.user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatsQueryKey }),
  });
}

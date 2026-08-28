import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export type UsernameState = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

/** Debounced availability check against the database. */
export function useUsernameAvailability(username: string, enabled = true) {
  const [state, setState] = useState<UsernameState>("idle");

  useEffect(() => {
    if (!enabled || !username) {
      setState("idle");
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setState("invalid");
      return;
    }
    setState("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", { _username: username });
      if (cancelled) return;
      if (error) setState("error");
      else setState(data ? "available" : "taken");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, enabled]);

  return state;
}

/** Turns a username or email into the email address Supabase auth expects. */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const value = identifier.trim();
  if (!value) return null;
  if (value.includes("@")) return value;
  const { data, error } = await supabase.rpc("resolve_login_email", { _identifier: value });
  if (error) return null;
  return (data as string | null) ?? null;
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/adminportal")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Studypace" },
      {
        name: "description",
        content:
          "Secure administrator sign-in for managing users, branches, subjects and analytics.",
      },
      { property: "og:title", content: "Admin Portal — Studypace" },
      {
        property: "og:description",
        content: "Administrator-only sign-in for the Studypace console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPortal,
});

function AdminPortal() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Invalid administrator credentials.");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError("Could not verify your session. Try again.");
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        await supabase.auth.signOut();
        setError("This account does not have administrator access.");
        return;
      }
      navigate({ to: "/admin", replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-md rounded-xl border-t-4 border-admin bg-card p-8 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-admin" />
          <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrator sign-in for Studypace.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Admin email</Label>
            <Input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : "Sign in to Admin Console"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Student or faculty?{" "}
          <a href="/auth" className="font-medium text-primary hover:underline">
            Use the main sign-in
          </a>
        </p>
      </div>
    </div>
  );
}

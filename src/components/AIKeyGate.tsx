import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { getMyAIKey } from "@/lib/ai-keys.functions";
import { Button } from "@/components/ui/button";

export function useAIKey() {
  return useQuery({
    queryKey: ["my-ai-key"],
    queryFn: () => getMyAIKey(),
    staleTime: 60_000,
  });
}

/** Shown above AI features when the user has not saved their own API key yet. */
export function AIKeyGate() {
  const { data, isLoading } = useAIKey();
  if (isLoading || data?.masked) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Add your free OpenRouter API key to unlock AI features</p>
          <p className="text-xs text-muted-foreground">
            Studypace uses your own OpenRouter key — it's free, the model is picked automatically, and
            setup takes a minute.
          </p>

        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/profile" hash="ai-key">
          Add key
        </Link>
      </Button>
    </div>
  );
}

import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** Minimal markdown renderer for AI replies: headings, bullets and bold. */
export function AIAnswer({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className={cn("space-y-1.5 text-sm leading-relaxed", className)}>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (/^#{1,6}\s/.test(line)) {
          return (
            <p key={i} className="pt-1 font-semibold">
              {inline(line.replace(/^#{1,6}\s/, ""))}
            </p>
          );
        }
        if (/^([-*•]|\d+\.)\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-muted-foreground">•</span>
              <p>{inline(line.replace(/^([-*•]|\d+\.)\s/, ""))}</p>
            </div>
          );
        }
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

export function AIBadge({ label = "AI generated" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      <Sparkles className="size-3" /> {label}
    </span>
  );
}

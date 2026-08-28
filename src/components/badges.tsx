import { cn } from "@/lib/utils";
import { STATUS_LABEL, type PanicStatus, type TaskType } from "@/lib/panic";

const STATUS_CLASS: Record<PanicStatus, string> = {
  safe: "bg-safe/15 text-safe",
  busy: "bg-busy/15 text-busy",
  overloaded: "bg-overloaded/15 text-overloaded",
};

export function StatusBadge({ status }: { status: PanicStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const TYPE_CLASS: Record<TaskType, string> = {
  exam: "bg-overloaded/15 text-overloaded",
  assignment: "bg-primary/15 text-primary",
  project: "bg-busy/15 text-busy",
  lab: "bg-muted text-muted-foreground",
};

export function TypeBadge({ type }: { type: TaskType }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        TYPE_CLASS[type],
      )}
    >
      {type}
    </span>
  );
}

export function urgencyOf(days: number): PanicStatus {
  if (days <= 3) return "overloaded";
  if (days <= 7) return "busy";
  return "safe";
}

const DOT_CLASS: Record<PanicStatus, string> = {
  safe: "bg-safe",
  busy: "bg-busy",
  overloaded: "bg-overloaded",
};

export function UrgencyDot({ days, className }: { days: number; className?: string }) {
  return <span className={cn("size-2.5 shrink-0 rounded-full", DOT_CLASS[urgencyOf(days)], className)} />;
}

export function ClashBadge({ count, className }: { count: number; className?: string }) {
  if (count < 1) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-overloaded/15 px-2 py-0.5 text-[11px] font-semibold text-overloaded",
        className,
      )}
    >
      ⚠️ Clashes with {count} other task{count === 1 ? "" : "s"}
    </span>
  );
}

const PRIORITY_CLASS: Record<string, string> = {
  "Do first": "bg-overloaded/15 text-overloaded",
  High: "bg-overloaded/10 text-overloaded",
  Medium: "bg-busy/15 text-busy",
  Low: "bg-safe/15 text-safe",
  "Do last": "bg-muted text-muted-foreground",
};

export function PriorityBadge({ label, className }: { label: string; className?: string }) {
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
        PRIORITY_CLASS[label] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}


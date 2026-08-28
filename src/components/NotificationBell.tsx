import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationActions, useNotifications, syncNotifications } from "@/lib/notifications";
import { useTasks } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const KIND_CLASS: Record<string, string> = {
  urgent: "bg-overloaded",
  warning: "bg-busy",
  reminder: "bg-primary",
};

export function NotificationBell() {
  const { data: tasks = [] } = useTasks();
  const { data: notifications = [] } = useNotifications();
  const { markAllRead, markRead, clear } = useNotificationActions();

  useEffect(() => {
    if (tasks.length) void syncNotifications(tasks);
  }, [tasks]);

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-overloaded text-[10px] font-bold text-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={!unread}
            >
              Mark read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => clear.mutate()}
              disabled={!notifications.length}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                to={n.link ?? "/dashboard"}
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                className={cn(
                  "flex gap-2 border-b border-border px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted",
                  !n.is_read && "bg-muted/50",
                )}
              >
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_CLASS[n.kind] ?? "bg-muted-foreground")}
                />
                <span>
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body && (
                    <span className="block text-xs text-muted-foreground">{n.body}</span>
                  )}
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

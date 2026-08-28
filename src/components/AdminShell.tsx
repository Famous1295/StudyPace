import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  LifeBuoy,
  ScrollText,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/branches", label: "Branch & Courses", icon: GraduationCap },
  { to: "/admin/subjects", label: "Subject Master List", icon: BookOpen },
  { to: "/admin/faculty", label: "Faculty Assignments", icon: ShieldCheck },
  { to: "/admin/tasks", label: "Task Oversight", icon: ListChecks },


  { to: "/admin/support", label: "Support Queries", icon: LifeBuoy },
  { to: "/admin/telegram", label: "Telegram Broadcast", icon: Send },
  { to: "/admin/twilio", label: "WhatsApp Broadcast", icon: Send },
  { to: "/admin/analytics", label: "System Analytics", icon: BarChart3 },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
] as const;

export function AdminShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, ...rest }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: "exact" in rest ? rest.exact : false }}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-admin text-admin-foreground hover:bg-admin" }}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-1">
      <Link
        to="/dashboard"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <GraduationCap className="size-4" /> Student view
      </Link>
      <button
        onClick={signOut}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2">
      <ShieldCheck className="size-5 text-admin" />
      <div>
        <p className="text-base font-bold text-sidebar-foreground">Admin Console</p>
        <p className="text-xs text-sidebar-foreground/60">Studypace</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r-4 border-admin bg-sidebar p-5 md:flex">
        <div>
          <div className="mb-8">{brand}</div>
          {nav}
        </div>
        {footer}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col justify-between border-r-4 border-admin bg-sidebar p-5">
            <div>
              <div className="mb-8 flex items-center justify-between">
                {brand}
                <button onClick={() => setOpen(false)} className="text-sidebar-foreground">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </div>
            {footer}
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-3 py-3 sm:gap-3 md:flex md:flex-wrap md:justify-between md:px-8 md:py-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
            <span className="hidden shrink-0 rounded-full bg-admin px-2 py-0.5 text-xs font-semibold text-admin-foreground sm:inline">
              Admin
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 justify-self-end md:order-3 md:gap-2">
            <ThemeToggle />
          </div>
          {actions && (
            <div className="col-span-2 flex w-full flex-wrap items-center gap-2 md:order-2 md:col-auto md:w-auto">
              {actions}
            </div>
          )}
        </header>
        <main className="px-3 py-5 sm:px-4 md:px-8 md:py-6">{children}</main>
      </div>
    </div>
  );
}

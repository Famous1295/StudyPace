import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarClock,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Compass,
  Sparkles,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/lib/theme";
import { HelpMenu } from "@/components/HelpMenu";
import logo from "@/assets/studypace-logo.png";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { NotificationBell } from "@/components/NotificationBell";
import { useMyRole } from "@/lib/admin";
import { GuestModeDialog, notifyGuestBlocked, setGuestFlag } from "@/lib/guest";
import { TourGuide } from "@/components/TourGuide";
import { InstallAppButton } from "@/components/InstallAppButton";
import { startTour } from "@/lib/tour";
import { useEffect } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const STUDENT_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/marks", label: "Marks", icon: GraduationCap },
    ],
  },
  {
    label: "Plan & do",
    items: [
      { to: "/tasks", label: "Tasks", icon: ListChecks },
      { to: "/timeline", label: "Timeline", icon: CalendarClock },
      { to: "/planner", label: "Planner", icon: CalendarClock },
      { to: "/groups", label: "Group projects", icon: Users },
    ],
  },
  {
    label: "Study",
    items: [
      { to: "/subjects", label: "Subjects", icon: BookOpen },
      { to: "/assistant", label: "AI assistant", icon: Sparkles },
      { to: "/notices", label: "Class notices", icon: BellRing },
    ],
  },
];

const FACULTY_NAV: NavGroup[] = [
  {
    label: "Teaching",
    items: [
      { to: "/faculty", label: "Class analytics", icon: BarChart3 },
      { to: "/faculty/deadlines", label: "Subject deadlines", icon: CalendarClock },
      { to: "/faculty/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
];

export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: role } = useMyRole();
  useEffect(() => {
    setGuestFlag(role === "guest");
  }, [role]);
  const groups = role === "faculty" ? FACULTY_NAV : STUDENT_NAV;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
            {group.label}
          </p>
          {group.items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/faculty" }}
              onClick={() => setOpen(false)}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
              }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/50 text-current transition-colors group-hover:bg-sidebar-accent">
                <Icon className="size-4" />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <img
        src={logo}
        alt="Studypace logo"
        width={36}
        height={36}
        className="size-9 rounded-xl"
      />
      <div>
        <p className="text-lg font-bold leading-tight text-sidebar-foreground">Studypace</p>
        <p className="text-xs text-sidebar-foreground/50">Pace your semester</p>
      </div>
    </div>
  );

  const menuButton = (
    <button
      onClick={() => {
        setOpen(false);
        setMenuOpen(true);
      }}
      className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
    >
      <Menu className="size-4" /> Menu
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-sidebar-border/50 bg-sidebar p-5 md:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-7">{brand}</div>
          {nav}
        </div>
        <div className="pt-4">{menuButton}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col justify-between bg-sidebar p-5">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mb-7 flex items-center justify-between">
                {brand}
                <button onClick={() => setOpen(false)} className="text-sidebar-foreground">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </div>
            <div className="pt-4">{menuButton}</div>
          </aside>
        </div>
      )}

      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md pb-6">
            <DrawerHeader className="text-left">
              <DrawerTitle>Quick menu</DrawerTitle>
              <DrawerDescription>Account, help and guided tour.</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-1 px-4">
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <UserCircle className="size-4" /> My profile
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  startTour();
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <Compass className="size-4" /> Take the tour
              </button>
              <HelpMenu className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-accent" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

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
          </div>
          <div className="flex shrink-0 items-center gap-1 justify-self-end md:order-3 md:gap-2">
            <InstallAppButton />
            <ThemeToggle />
            <NotificationBell />
          </div>
          {actions && (
            <div className="col-span-2 flex w-full flex-wrap items-center gap-2 md:order-2 md:col-auto md:w-auto">
              {actions}
            </div>
          )}
        </header>
        <main className="px-3 py-5 sm:px-4 md:px-8 md:py-6">
          {role === "guest" && (
            <div className="mb-5 rounded-lg border border-busy/40 bg-busy/10 px-4 py-3 text-sm">
              <span className="font-semibold">Guest demo — read only.</span> Explore the sample
              semester freely. To add or change anything,{" "}
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={notifyGuestBlocked}
              >
                create an account or log in
              </button>
              .
            </div>
          )}
          {children}
        </main>
        <GuestModeDialog />
        <TourGuide />
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { useAdminUsers } from "@/lib/admin";
import { computeWeeklyPanic, type Task } from "@/lib/panic";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Studypace" },
      {
        name: "description",
        content: "Platform overview: users by role, active tasks and overload rate.",
      },
      { property: "og:title", content: "Admin Dashboard — Studypace" },
      { property: "og:description", content: "Platform overview for administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AdminDashboard() {
  const users = useAdminUsers();
  const tasks = useQuery({
    queryKey: ["admin-all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return (data ?? []) as (Task & { user_id: string })[];
    },
  });

  const list = users.data ?? [];
  const byRole = {
    student: list.filter((u) => u.role === "student").length,
    faculty: list.filter((u) => u.role === "faculty").length,
    admin: list.filter((u) => u.role === "admin").length,
  };

  const allTasks = tasks.data ?? [];
  const activeTasks = allTasks.filter((t) => !t.is_completed);

  const byUser = new Map<string, Task[]>();
  for (const t of activeTasks) {
    byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);
  }
  let overloaded = 0;
  for (const [, userTasks] of byUser) {
    const current = computeWeeklyPanic(userTasks)[0];
    if (current?.status === "overloaded") overloaded += 1;
  }
  const studentCount = Math.max(byRole.student, 1);
  const overloadedPct = Math.round((overloaded / studentCount) * 100);

  const recent = [...list].slice(0, 10);

  return (
    <AdminShell title="Admin Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Registered users"
          value={String(list.length)}
          sub={`${byRole.student} Students · ${byRole.faculty} Faculty · ${byRole.admin} Admins`}
        />
        <Stat label="Active tasks (platform)" value={String(activeTasks.length)} />
        <Stat
          label="Students overloaded this week"
          value={`${overloadedPct}%`}
          sub="Aggregate only — no names shown"
        />
        <Stat label="Total tasks logged" value={String(allTasks.length)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/admin/users">Add User</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/branches">Add Branch</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/audit-log">View Audit Log</Link>
        </Button>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Recent signups</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-2">{u.full_name ?? "—"}</td>
                  <td className="py-2">{u.email ?? "—"}</td>
                  <td className="py-2 capitalize">{u.role}</td>
                  <td className="py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-muted-foreground">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

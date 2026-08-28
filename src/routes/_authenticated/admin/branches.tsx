import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useBranchMutations,
  useBranchStudentCounts,
  useBranches,
  useSemesterSettings,
  useToggleSemester,
  type Branch,
} from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin/branches")({
  head: () => ({
    meta: [
      { title: "Branch & Course Management — Admin" },
      {
        name: "description",
        content: "Maintain the platform-wide branch list and active semesters for registration.",
      },
      { property: "og:title", content: "Branch & Course Management — Admin" },
      { property: "og:description", content: "Manage branches and semester availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BranchesPage,
});

function BranchesPage() {
  const branches = useBranches();
  const counts = useBranchStudentCounts();
  const { save, toggleActive, remove } = useBranchMutations();
  const semesters = useSemesterSettings();
  const toggleSemester = useToggleSemester();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  function openForm(branch?: Branch) {
    setEditing(branch ?? null);
    setForm({
      name: branch?.name ?? "",
      code: branch?.code ?? "",
      description: branch?.description ?? "",
    });
    setOpen(true);
  }

  return (
    <AdminShell
      title="Branch & Course Management"
      actions={<Button onClick={() => openForm()}>+ Add Branch</Button>}
    >
      <div className="space-y-3 md:hidden">
        {(branches.data ?? []).length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No branches yet.
          </div>
        )}
        {(branches.data ?? []).map((b) => (
          <div key={b.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{b.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.code} · {counts.data?.[b.id] ?? 0} students
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" aria-label="Edit branch" onClick={() => openForm(b)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete branch"
                  onClick={() =>
                    remove.mutate(b, {
                      onSuccess: () => toast.success("Branch deleted"),
                      onError: (e: Error) => toast.error(e.message),
                    })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Switch
                checked={b.is_active}
                onCheckedChange={() => toggleActive.mutate(b)}
                aria-label="Toggle branch active"
              />
              <span className="text-xs text-muted-foreground">{b.is_active ? "Active" : "Inactive"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Branch name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Total students</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(branches.data ?? []).map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3">{b.code}</td>
                <td className="px-4 py-3">{counts.data?.[b.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={() => toggleActive.mutate(b)}
                      aria-label="Toggle branch active"
                    />
                    <span className="text-xs text-muted-foreground">
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label="Edit branch" onClick={() => openForm(b)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete branch"
                      onClick={() =>
                        remove.mutate(b, {
                          onSuccess: () => toast.success("Branch deleted"),
                          onError: (e: Error) => toast.error(e.message),
                        })
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(branches.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  No branches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Semester availability</h2>
        <p className="text-sm text-muted-foreground">
          Disabled semesters no longer appear as options on the registration page.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {(semesters.data ?? []).map((s) => (
            <div
              key={s.semester}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm font-medium">Semester {s.semester}</span>
              <Switch
                checked={s.is_active}
                aria-label={`Toggle semester ${s.semester}`}
                onCheckedChange={(v) =>
                  toggleSemester.mutate({ semester: s.semester, is_active: v })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit branch" : "Add branch"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                {
                  ...(editing ? { id: editing.id } : {}),
                  name: form.name.trim(),
                  code: form.code.trim().toUpperCase(),
                  description: form.description.trim() || null,
                },
                {
                  onSuccess: () => {
                    toast.success(editing ? "Branch updated" : "Branch added");
                    setOpen(false);
                  },
                  onError: (e: Error) => toast.error(e.message),
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="b-name">Branch name</Label>
              <Input
                id="b-name"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-code">Branch code</Label>
              <Input
                id="b-code"
                required
                maxLength={10}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-desc">Description (optional)</Label>
              <Input
                id="b-desc"
                maxLength={300}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

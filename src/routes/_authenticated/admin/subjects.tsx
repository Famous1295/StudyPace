import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches, useSubjectMutations, useSubjects, type Subject } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin/subjects")({
  head: () => ({
    meta: [
      { title: "Subject Master List — Admin" },
      {
        name: "description",
        content: "Maintain the platform-wide subject reference list with codes, branch and semester.",
      },
      { property: "og:title", content: "Subject Master List — Admin" },
      { property: "og:description", content: "Keep subject codes consistent across the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const subjects = useSubjects();
  const branches = useBranches();
  const { save, remove, bulkImport } = useSubjectMutations();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    branch_id: null as string | null,
    semester: null as number | null,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");

  const branchName = useMemo(() => {
    const map = new Map((branches.data ?? []).map((b) => [b.id, b.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [branches.data]);

  function openForm(subject?: Subject) {
    setEditing(subject ?? null);
    setForm({
      name: subject?.name ?? "",
      code: subject?.code ?? "",
      branch_id: subject?.branch_id ?? null,
      semester: subject?.semester ?? null,
    });
    setOpen(true);
  }

  function runImport() {
    const byName = new Map((branches.data ?? []).map((b) => [b.name.toLowerCase(), b.id]));
    const byCode = new Map((branches.data ?? []).map((b) => [b.code.toLowerCase(), b.id]));
    const rows: Omit<Subject, "id">[] = [];
    for (const line of csv.split("\n")) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2 || !parts[0]) continue;
      const key = (parts[2] ?? "").toLowerCase();
      rows.push({
        name: parts[0],
        code: parts[1] ?? "",
        branch_id: byName.get(key) ?? byCode.get(key) ?? null,
        semester: parts[3] ? Number(parts[3]) : null,
      });
    }
    if (rows.length === 0) {
      toast.error("Nothing to import — use: Name, Code, Branch, Semester");
      return;
    }
    bulkImport.mutate(rows, {
      onSuccess: () => {
        toast.success(`Imported ${rows.length} subjects`);
        setImportOpen(false);
        setCsv("");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <AdminShell
      title="Subject Master List"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Bulk import
          </Button>
          <Button onClick={() => openForm()}>+ Add Subject</Button>
        </div>
      }
    >
      <div className="space-y-3 md:hidden">
        {(subjects.data ?? []).length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No subjects yet.
          </div>
        )}
        {(subjects.data ?? []).map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{s.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.code || "—"} · {branchName(s.branch_id)}
                  {s.semester ? ` · Sem ${s.semester}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" aria-label="Edit subject" onClick={() => openForm(s)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete subject"
                  onClick={() =>
                    remove.mutate(s, {
                      onSuccess: () => toast.success("Subject deleted"),
                      onError: (e: Error) => toast.error(e.message),
                    })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Subject name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(subjects.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.code}</td>
                <td className="px-4 py-3">{branchName(s.branch_id)}</td>
                <td className="px-4 py-3">{s.semester ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label="Edit subject" onClick={() => openForm(s)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete subject"
                      onClick={() =>
                        remove.mutate(s, {
                          onSuccess: () => toast.success("Subject deleted"),
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
            {(subjects.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  No subjects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit subject" : "Add subject"}</DialogTitle>
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
                  branch_id: form.branch_id,
                  semester: form.semester,
                },
                {
                  onSuccess: () => {
                    toast.success(editing ? "Subject updated" : "Subject added");
                    setOpen(false);
                  },
                  onError: (e: Error) => toast.error(e.message),
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="s-name">Subject name</Label>
              <Input
                id="s-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-code">Code</Label>
              <Input
                id="s-code"
                required
                maxLength={20}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                  value={form.branch_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, branch_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(branches.data ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semester</Label>
                <Select
                  value={form.semester ? String(form.semester) : "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, semester: v === "none" ? null : Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import subjects</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            One subject per line: Name, Code, Branch, Semester
          </p>
          <Textarea
            rows={8}
            value={csv}
            placeholder={"Database Management Systems, CS702, Computer Engineering, 7"}
            onChange={(e) => setCsv(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runImport} disabled={bulkImport.isPending}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

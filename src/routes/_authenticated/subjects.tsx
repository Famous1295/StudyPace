import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useMasterSubjectSuggestions,
  useMySubjects,
  useSubjectMutations,
  type StudentSubject,
} from "@/lib/subjects";
import { useTasks } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({
    meta: [
      { title: "My subjects — Studypace" },
      {
        name: "description",
        content: "Add, edit and remove the subjects you are studying this semester.",
      },
      { property: "og:title", content: "My subjects — Studypace" },
      {
        property: "og:description",
        content: "Keep your subject list tidy so every task is tagged to the right course.",
      },
    ],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const { data: subjects = [], isLoading } = useMySubjects();
  const { data: master = [] } = useMasterSubjectSuggestions();
  const { data: tasks = [] } = useTasks();
  const { create, update, remove } = useSubjectMutations();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [pendingDelete, setPendingDelete] = useState<StudentSubject | null>(null);

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.subject_id) counts[task.subject_id] = (counts[task.subject_id] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a subject name.");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), code: code.trim() || null });
      setName("");
      setCode("");
      toast.success("Subject added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the subject.");
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) {
      toast.error("Subject name cannot be empty.");
      return;
    }
    try {
      await update.mutateAsync({ id, name: editName.trim(), code: editCode.trim() || null });
      setEditingId(null);
      toast.success("Subject updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the subject.");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success("Subject deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the subject.");
    } finally {
      setPendingDelete(null);
    }
  }

  const linked = pendingDelete ? (taskCounts[pendingDelete.id] ?? 0) : 0;

  return (
    <AppShell title="Subjects">
      <Card className="p-5">
        <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="subject-name">Subject name</Label>
            <Input
              id="subject-name"
              list="master-subjects"
              value={name}
              maxLength={100}
              placeholder="Database Management Systems"
              onChange={(e) => {
                setName(e.target.value);
                const match = master.find((m) => m.name === e.target.value);
                if (match?.code) setCode(match.code);
              }}
            />
            <datalist id="master-subjects">
              {master.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.code ?? ""}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject-code">Code</Label>
            <Input
              id="subject-code"
              value={code}
              maxLength={20}
              placeholder="CS702"
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            <Plus className="size-4" /> Add subject
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Suggestions come from the college master list — you can still add your own.
        </p>
      </Card>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Linked tasks</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && subjects.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                  No subjects yet — add your first one above.
                </td>
              </tr>
            )}
            {subjects.map((subject) => (
              <tr key={subject.id} className="border-b border-border last:border-0">
                {editingId === subject.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </td>
                    <td className="px-4 py-2">
                      <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {taskCounts[subject.id] ?? 0}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Save subject"
                          onClick={() => handleSaveEdit(subject.id)}
                        >
                          <Check className="size-4 text-safe" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Cancel edit"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{subject.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{subject.code ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {taskCounts[subject.id] ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit subject"
                          onClick={() => {
                            setEditingId(subject.id);
                            setEditName(subject.name);
                            setEditCode(subject.code ?? "");
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete subject"
                          onClick={() => setPendingDelete(subject)}
                        >
                          <Trash2 className="size-4 text-overloaded" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {linked > 0
                ? `This subject has ${linked} task${linked === 1 ? "" : "s"} linked. Deleting it will unlink those tasks.`
                : "This subject will be removed from your list."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

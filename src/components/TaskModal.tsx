import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Task, TaskType } from "@/lib/panic";
import { useSaveTask } from "@/lib/tasks";
import { useMySubjects } from "@/lib/subjects";
import { Link } from "@tanstack/react-router";

const TYPES: TaskType[] = ["exam", "assignment", "lab", "project"];

export function TaskModal({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
}) {
  const save = useSaveTask();
  const { data: subjects = [] } = useMySubjects();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("assignment");
  const [deadline, setDeadline] = useState("");
  const [hours, setHours] = useState("2");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(task?.title ?? "");
    setType(task?.type ?? "assignment");
    setDeadline(task?.deadline_date ?? "");
    setHours(String(task?.est_hours ?? 2));
    setSubjectId(task?.subject_id ?? "");
  }, [open, task]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const h = Number(hours);
    if (!title.trim()) return setError("Please enter a task title.");
    if (!deadline) return setError("Please pick a deadline date.");
    if (subjects.length > 0 && !subjectId) return setError("Please pick a subject.");
    if (!Number.isFinite(h) || h < 1 || h > 40)
      return setError("Estimated hours must be between 1 and 40.");

    try {
      await save.mutateAsync({
        id: task?.id,
        input: {
          title: title.trim(),
          type,
          deadline_date: deadline,
          est_hours: Math.round(h),
          subject_id: subjectId || null,
        },
      });
      toast.success(task ? "Task updated" : "Task added");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the task.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>
            Deadlines feed straight into your weekly panic score.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Signals & Systems mid-sem"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            {subjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No subjects yet —{" "}
                <Link to="/subjects" className="text-primary underline">
                  add your subjects
                </Link>{" "}
                to tag tasks with a course.
              </p>
            ) : (
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline date</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Estimated hours</Label>
              <Input
                id="hours"
                type="number"
                min={1}
                max={40}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : task ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeadlineMutations, useMyTaughtSubjects, useSubjectDeadlines } from "@/lib/faculty";

export const Route = createFileRoute("/_authenticated/faculty/deadlines")({
  head: () => ({
    meta: [
      { title: "Subject deadlines — Faculty portal" },
      {
        name: "description",
        content: "Publish assignment, lab and exam deadlines to every student in your subject.",
      },
      { property: "og:title", content: "Subject deadlines — Faculty portal" },
      {
        property: "og:description",
        content: "Publish subject deadlines to your class.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacultyDeadlines,
});

const TYPES = ["exam", "assignment", "lab", "project"];

function FacultyDeadlines() {
  const { data: subjects = [] } = useMyTaughtSubjects();
  const { data: deadlines = [], isLoading } = useSubjectDeadlines();
  const { save, remove } = useDeadlineMutations();

  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("assignment");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("2");
  const [notes, setNotes] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!subjectId) {
      toast.error("Pick a subject.");
      return;
    }
    if (!title.trim()) {
      toast.error("Enter a title.");
      return;
    }
    if (!date) {
      toast.error("Pick a deadline date.");
      return;
    }
    try {
      await save.mutateAsync({
        subject_id: subjectId,
        title: title.trim(),
        type,
        deadline_date: date,
        est_hours: Math.max(1, Math.min(40, Number(hours) || 2)),
        notes: notes.trim() || null,
      });
      toast.success("Deadline published to your class.");
      setTitle("");
      setDate("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish the deadline.");
    }
  }

  return (
    <AppShell title="Subject deadlines">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Publish a deadline</h2>
          {subjects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You are not assigned to any subject yet.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="subject">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.subject_id} value={s.subject_id}>
                    {s.name} {s.code ? `(${s.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
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
            <div className="space-y-2">
              <Label htmlFor="date">Due date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Suggested hours</Label>
            <Input
              id="hours"
              type="number"
              min={1}
              max={40}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Publishing…" : "Publish deadline"}
          </Button>
        </form>

        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
            Published deadlines
          </h2>
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : deadlines.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nothing published yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {deadlines.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.subjects?.name ?? "Subject"} · <span className="capitalize">{d.type}</span>{" "}
                      · due {d.deadline_date} · ~{d.est_hours}h
                    </p>
                    {d.notes && <p className="mt-1 text-sm text-muted-foreground">{d.notes}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove.mutate(d.id)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

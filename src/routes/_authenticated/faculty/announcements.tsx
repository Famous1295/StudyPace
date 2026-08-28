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
import { useAnnouncementMutations, useAnnouncements, useMyTaughtSubjects } from "@/lib/faculty";

export const Route = createFileRoute("/_authenticated/faculty/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Faculty portal" },
      {
        name: "description",
        content: "Broadcast notices to every student taking the subjects you teach.",
      },
      { property: "og:title", content: "Announcements — Faculty portal" },
      { property: "og:description", content: "Broadcast subject notices to your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacultyAnnouncements,
});

function FacultyAnnouncements() {
  const { data: subjects = [] } = useMyTaughtSubjects();
  const { data: items = [], isLoading } = useAnnouncements();
  const { create, remove } = useAnnouncementMutations();
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!subjectId) {
      toast.error("Pick a subject.");
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast.error("Add a title and a message.");
      return;
    }
    try {
      await create.mutateAsync({ subject_id: subjectId, title: title.trim(), message: message.trim() });
      toast.success("Announcement sent to your class.");
      setTitle("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the announcement.");
    }
  }

  return (
    <AppShell title="Announcements">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Broadcast to your subject</h2>
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
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Sending…" : "Send announcement"}
          </Button>
        </form>

        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Sent</h2>
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.subjects?.name ?? "Subject"} · {new Date(a.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm">{a.message}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove.mutate(a.id)}
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

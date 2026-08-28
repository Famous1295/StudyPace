import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquare, Plus, Send, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  memberLoads,
  suggestBalance,
  useGroupMessages,
  useGroupMutations,
  useGroupProjects,
  useMyGroupInvites,
  useRespondToInvite,
  useSendGroupMessage,
  type GroupProject,
} from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({
    meta: [
      { title: "Group projects — Studypace" },
      {
        name: "description",
        content: "Split group project work fairly and see who is carrying the heaviest load.",
      },
      { property: "og:title", content: "Group projects — Studypace" },
      {
        property: "og:description",
        content: "Assign group tasks, track hours per member and keep the split fair.",
      },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { data: projects = [], isLoading } = useGroupProjects();
  const { createProject } = useGroupMutations();
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");

  return (
    <AppShell title="Group projects">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New project</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) {
                  toast.error("Give the project a name.");
                  return;
                }
                createProject.mutate(
                  { name: name.trim(), description: null, deadline_date: deadline || null },
                  {
                    onSuccess: () => {
                      setName("");
                      setDeadline("");
                    },
                  },
                );
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="pname">Name</Label>
                <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdeadline">Deadline</Label>
                <Input
                  id="pdeadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createProject.isPending}>
                <Plus className="size-4" /> Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <InvitesCard />
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No group projects yet. Create one to start splitting the work.
            </p>
          ) : (
            projects.map((p) => <ProjectCard key={p.id} project={p} />)
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ProjectCard({ project }: { project: GroupProject }) {
  const { addMember, removeMember, addItem, updateItem, removeItem, removeProject } =
    useGroupMutations();
  const [memberName, setMemberName] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemHours, setItemHours] = useState("2");

  const loads = memberLoads(project);
  const balance = suggestBalance(project);
  const totalHours = project.items.reduce((s, i) => s + Number(i.est_hours), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{project.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {project.deadline_date ? `Due ${project.deadline_date} · ` : ""}
            {totalHours}h total
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete project"
          onClick={() => removeProject.mutate(project.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Load split</p>
          {loads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add members and tasks to see the split.</p>
          ) : (
            <ul className="space-y-2">
              {loads.map((l, i) => (
                <li key={l.member?.id ?? `unassigned-${i}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{l.member?.display_name ?? "Unassigned"}</span>
                    <span className="text-muted-foreground">
                      {l.hours}h · {l.share}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, l.share)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {balance && <p className="mt-2 text-xs text-muted-foreground">{balance}</p>}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Members</p>
          <div className="flex flex-wrap gap-2">
            {project.members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {m.display_name}
                {m.status !== "accepted" && (
                  <span className="text-[10px] uppercase text-muted-foreground">invited</span>
                )}
                <button
                  onClick={() => removeMember.mutate(m.id)}
                  aria-label={`Remove ${m.display_name}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!memberName.trim()) return;
              addMember.mutate(
                { project_id: project.id, username: memberName.trim() },
                { onSuccess: () => setMemberName("") },
              );
            }}
          >
            <Input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Invite by username"
              aria-label="Teammate username"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Add member">
              <UserPlus className="size-4" />
            </Button>
          </form>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Work items</p>
          <ul className="space-y-2">
            {project.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
                <Checkbox
                  checked={item.is_done}
                  onCheckedChange={(v) =>
                    updateItem.mutate({ id: item.id, is_done: v === true })
                  }
                  aria-label={`Mark ${item.title} done`}
                />
                <span className={item.is_done ? "text-sm line-through opacity-60" : "text-sm"}>
                  {item.title}
                </span>
                <span className="text-xs text-muted-foreground">{item.est_hours}h</span>
                <select
                  className="ml-auto rounded-md border border-input bg-background px-2 py-1 text-xs"
                  aria-label="Assignee"
                  value={item.assignee_id ?? ""}
                  onChange={(e) =>
                    updateItem.mutate({ id: item.id, assignee_id: e.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {project.members.filter((m) => m.status === "accepted").map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete item"
                  onClick={() => removeItem.mutate(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!itemTitle.trim()) return;
              addItem.mutate(
                {
                  project_id: project.id,
                  title: itemTitle.trim(),
                  est_hours: Number(itemHours) || 1,
                  assignee_id: null,
                },
                { onSuccess: () => setItemTitle("") },
              );
            }}
          >
            <Input
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder="Work item"
              aria-label="Work item"
            />
            <Input
              type="number"
              min={1}
              className="w-20"
              value={itemHours}
              onChange={(e) => setItemHours(e.target.value)}
              aria-label="Hours"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Add item">
              <Plus className="size-4" />
            </Button>
          </form>
        </div>

        <GroupChat projectId={project.id} />
      </CardContent>
    </Card>
  );
}

function InvitesCard() {
  const { data: invites = [] } = useMyGroupInvites();
  const respond = useRespondToInvite();
  if (!invites.length) return null;
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Project invites</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((inv) => (
          <div
            key={inv.member_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{inv.project_name}</p>
              <p className="text-xs text-muted-foreground">
                Invited by {inv.invited_by_name ?? "a classmate"}
                {inv.deadline_date ? ` · due ${inv.deadline_date}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => respond.mutate({ memberId: inv.member_id, accept: true })}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => respond.mutate({ memberId: inv.member_id, accept: false })}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GroupChat({ projectId }: { projectId: string }) {
  const { data: messages = [] } = useGroupMessages(projectId);
  const send = useSendGroupMessage(projectId);
  const [text, setText] = useState("");

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <MessageSquare className="size-3.5" /> Team chat
      </p>
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-medium">{m.author_name ?? "Member"}</span>{" "}
              <span className="text-[11px] text-muted-foreground">
                {new Date(m.created_at).toLocaleString([], {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <p className="whitespace-pre-wrap break-words text-muted-foreground">{m.body}</p>
            </div>
          ))
        )}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          send.mutate(body, { onSuccess: () => setText("") });
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your team"
          aria-label="Message"
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

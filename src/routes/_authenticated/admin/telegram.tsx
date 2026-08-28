import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminListTelegramRecipients,
  adminSendTelegram,
  type TelegramRecipient,
} from "@/lib/telegram-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/telegram")({
  head: () => ({
    meta: [
      { title: "Telegram broadcasts — Studypace admin" },
      {
        name: "description",
        content:
          "Send an instant Telegram notification to one student, a selected group, or everyone with a connected account.",
      },
      { property: "og:title", content: "Telegram broadcasts — Studypace admin" },
      { property: "og:description", content: "Instant Telegram messaging for admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminTelegramPage,
});

function AdminTelegramPage() {
  const [people, setPeople] = useState<TelegramRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    adminListTelegramRecipients()
      .then(setPeople)
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Could not load recipients."),
      )
      .finally(() => setLoading(false));
  }, []);

  const connected = people.filter((p) => p.connected);
  const visible = connected.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.full_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
  });

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function send(toEveryone: boolean) {
    if (message.trim().length < 2) {
      toast.error("Write a message first.");
      return;
    }
    if (!toEveryone && selected.length === 0) {
      toast.error("Select at least one user, or send to everyone.");
      return;
    }
    setSending(true);
    try {
      const res = await adminSendTelegram({
        data: { message: message.trim(), userIds: toEveryone ? [] : selected },
      });
      toast.success(`Sent to ${res.sent} user(s)${res.failed ? `, ${res.failed} failed` : ""}.`);
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminShell title="Telegram broadcasts">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compose message</CardTitle>
            <CardDescription>
              Delivered instantly to connected Telegram chats. Basic HTML like &lt;b&gt;bold&lt;/b&gt; works.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={8}
              value={message}
              maxLength={3000}
              placeholder="e.g. Reminder: submit your DBMS lab file before Friday 5 PM."
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => send(false)} disabled={sending}>
                <Send className="size-4" /> Send to selected ({selected.length})
              </Button>
              <Button variant="outline" onClick={() => send(true)} disabled={sending}>
                Send to everyone ({connected.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected users</CardTitle>
            <CardDescription>
              {loading
                ? "Loading users…"
                : `${connected.length} of ${people.length} users have linked Telegram.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(visible.map((p) => p.id))}>
                Select all shown
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {visible.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.full_name ?? "Unnamed"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </span>
                  <Badge variant="outline">Telegram</Badge>
                </label>
              ))}
              {!loading && visible.length === 0 && (
                <p className="text-sm text-muted-foreground">No connected users found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

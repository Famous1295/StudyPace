import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllTickets, useUpdateTicket, type SupportTicketWithUser } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Support queries — Studypace admin" },
      {
        name: "description",
        content:
          "Review student and faculty help requests by category, reply to them and mark each query as solved.",
      },
      { property: "og:title", content: "Support queries — Studypace admin" },
      { property: "og:description", content: "Manage and resolve user help requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSupportPage,
});

function TicketCard({ ticket }: { ticket: SupportTicketWithUser }) {
  const update = useUpdateTicket();
  const [reply, setReply] = useState(ticket.admin_reply ?? "");

  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{ticket.subject}</CardTitle>
          <Badge
            variant={ticket.status === "solved" ? "default" : "outline"}
            className={ticket.status === "solved" ? "bg-safe text-background" : ""}
          >
            {ticket.status === "in_progress" ? "In progress" : ticket.status === "solved" ? "Solved" : "Open"}
          </Badge>
        </div>
        <CardDescription>
          {ticket.user_name ?? "Unknown user"} · {ticket.user_email ?? "—"} · {ticket.category} ·{" "}
          {ticket.topic} · {new Date(ticket.created_at).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm">{ticket.message}</p>
        <Textarea
          rows={2}
          placeholder="Reply to the user (optional)"
          value={reply}
          maxLength={2000}
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={update.isPending || ticket.status === "solved"}
            onClick={() => update.mutate({ id: ticket.id, status: "solved", admin_reply: reply })}
          >
            Mark as solved
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: ticket.id, status: "in_progress", admin_reply: reply })}
          >
            Mark in progress
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: ticket.id, status: "open", admin_reply: reply })}
          >
            Reopen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminSupportPage() {
  const { data: tickets = [], isLoading } = useAllTickets();
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");

  const categories = [...new Set(tickets.map((t) => t.category))];
  const filtered = tickets.filter(
    (t) => (status === "all" || t.status === status) && (category === "all" || t.category === category),
  );

  return (
    <AdminShell title="Support queries">
      <div className="mb-5 flex flex-wrap gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="solved">Solved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading queries…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No queries match these filters.</p>
      )}
      <div className="grid gap-4">
        {filtered.map((t) => (
          <TicketCard key={t.id} ticket={t} />
        ))}
      </div>
    </AdminShell>
  );
}

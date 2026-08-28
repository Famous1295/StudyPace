import { useState } from "react";
import { CheckCircle2, ChevronRight, Clock, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HELP_MENU, useCreateTicket, useMyTickets } from "@/lib/support";

function StatusBadge({ status }: { status: string }) {
  if (status === "solved")
    return (
      <Badge className="gap-1 bg-safe text-background">
        <CheckCircle2 className="size-3" /> Solved
      </Badge>
    );
  if (status === "in_progress")
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="size-3" /> In progress
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="size-3" /> Open
    </Badge>
  );
}

export function HelpMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("new");
  const [category, setCategory] = useState(HELP_MENU[0]!.category);
  const [topic, setTopic] = useState(HELP_MENU[0]!.topics[0]!);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: tickets = [] } = useMyTickets();
  const create = useCreateTicket();
  const unsolved = tickets.filter((t) => t.status !== "solved").length;

  function start(cat: string, top: string) {
    setCategory(cat);
    setTopic(top);
    setSubject(top);
    setMessage("");
    setTab("new");
    setOpen(true);
  }

  function submit() {
    if (!subject.trim() || message.trim().length < 5) return;
    create.mutate(
      { category, topic, subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          setMessage("");
          setTab("mine");
        },
      },
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={
              className ??
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }
          >
            <LifeBuoy className="size-4" /> Help &amp; support
            {unsolved > 0 && (
              <span className="ml-auto rounded-full bg-brand px-2 text-xs font-semibold text-brand-foreground">
                {unsolved}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuLabel>What do you need help with?</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {HELP_MENU.map((group) => (
            <DropdownMenuSub key={group.category}>
              <DropdownMenuSubTrigger>{group.category}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {group.topics.map((t) => (
                  <DropdownMenuItem key={t} onSelect={() => start(group.category, t)}>
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setTab("mine");
              setOpen(true);
            }}
          >
            My requests
            <ChevronRight className="ml-auto size-4" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Help &amp; support</DialogTitle>
            <DialogDescription>
              Send a query to the admin team and track whether it has been solved.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">New request</TabsTrigger>
              <TabsTrigger value="mine">My requests ({tickets.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4 pt-4">
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Category:</span>{" "}
                <span className="font-medium">{category}</span>
                <span className="text-muted-foreground"> · Topic:</span>{" "}
                <span className="font-medium">{topic}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="help-subject">Subject</Label>
                <Input
                  id="help-subject"
                  value={subject}
                  maxLength={120}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="help-message">Describe the issue</Label>
                <Textarea
                  id="help-message"
                  rows={5}
                  value={message}
                  maxLength={2000}
                  placeholder="Tell us what happened and what you expected…"
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={create.isPending}>
                  {create.isPending ? "Sending…" : "Send request"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="mine" className="space-y-3 pt-4">
              {tickets.length === 0 && (
                <p className="text-sm text-muted-foreground">You haven't raised any requests yet.</p>
              )}
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {tickets.map((t) => (
                  <article key={t.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.category} · {t.topic} · {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t.message}</p>
                    {t.admin_reply && (
                      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="font-medium">Admin: </span>
                        {t.admin_reply}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

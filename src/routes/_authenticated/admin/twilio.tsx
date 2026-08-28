import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/twilio")({
  head: () => ({
    meta: [
      { title: "WhatsApp broadcasts — Studypace admin" },
      {
        name: "description",
        content:
          "WhatsApp broadcasting requires a paid WhatsApp Business API subscription. Telegram broadcasting is available for free.",
      },
      { property: "og:title", content: "WhatsApp broadcasts — Studypace admin" },
      {
        property: "og:description",
        content: "WhatsApp channel is locked behind a paid messaging subscription.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminWhatsAppLockedPage,
});

function AdminWhatsAppLockedPage() {
  return (
    <AdminShell title="WhatsApp broadcasts">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Lock className="size-4" />
              </span>
              <div>
                <CardTitle>WhatsApp channel is locked</CardTitle>
                <CardDescription>Available on a paid messaging subscription</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Sending WhatsApp messages from an application requires the official WhatsApp Business
              API through a provider such as Twilio. Unlike Telegram, it cannot be used free of
              charge.
            </p>

            <div className="space-y-3">
              <div className="flex gap-3 rounded-lg border border-border px-4 py-3">
                <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Paid provider subscription</p>
                  <p className="text-xs text-muted-foreground">
                    A Twilio (or other BSP) plan with an upgraded account and per-conversation
                    charges for every message delivered.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border px-4 py-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Verified business &amp; approved templates</p>
                  <p className="text-xs text-muted-foreground">
                    Meta business verification plus a pre-approved message template before any
                    broadcast can be sent.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border px-4 py-3">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Sender number &amp; webhook setup</p>
                  <p className="text-xs text-muted-foreground">
                    A dedicated WhatsApp sender number connected to the app webhook so replies and
                    activation codes are received.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-sm font-medium">Telegram is enabled and free</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Instant broadcasts, daily reminders and full task management already work on
                Telegram at no cost.
              </p>
              <Button asChild size="sm">
                <Link to="/admin/telegram">Go to Telegram broadcasts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <span className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm">
              <Lock className="size-4" /> Requires subscription
            </span>
          </div>
          <CardHeader>
            <CardTitle>Compose message</CardTitle>
            <CardDescription>Preview of the WhatsApp broadcast composer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 opacity-60">
            <Input disabled placeholder="Search by name or email" />
            <Textarea
              rows={8}
              disabled
              placeholder="e.g. Reminder: submit your DBMS lab file before Friday 5 PM."
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled>Send to selected</Button>
              <Button variant="outline" disabled>
                Send to everyone
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotificationSettings, useSaveNotificationSettings } from "@/lib/admin";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings — Studypace Admin" },
      { name: "description", content: "Configure platform-wide reminder and digest delivery." },
      { property: "og:title", content: "Notification Settings — Studypace Admin" },
      {
        property: "og:description",
        content: "Configure platform-wide reminder and digest delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const settings = useNotificationSettings();
  const save = useSaveNotificationSettings();

  const [email, setEmail] = useState(true);
  const [dailyTime, setDailyTime] = useState("08:00");
  const [digestDay, setDigestDay] = useState(0);
  const [digestTime, setDigestTime] = useState("18:00");
  const [aisensyApiKey, setAisensyApiKey] = useState("");
  const [aisensyCampaign, setAisensyCampaign] = useState("");

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setEmail(s.email_digest_enabled);
    setDailyTime(s.daily_reminder_time.slice(0, 5));
    setDigestDay(s.weekly_digest_day);
    setDigestTime(s.weekly_digest_time.slice(0, 5));
    setAisensyApiKey(s.aisensy_api_key ?? "");
    setAisensyCampaign(s.aisensy_campaign_name ?? "");
  }, [settings.data]);

  async function onSave() {
    try {
      await save.mutateAsync({
        whatsapp_enabled: false,
        email_digest_enabled: email,
        daily_reminder_time: `${dailyTime}:00`,
        weekly_digest_day: digestDay,
        weekly_digest_time: `${digestTime}:00`,
        twilio_whatsapp_from: null,
        aisensy_api_key: aisensyApiKey.trim() || null,
        aisensy_campaign_name: aisensyCampaign.trim() || null,
      });
      toast.success("Notification settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    }
  }

  return (
    <AdminShell title="Notification Settings">
      <div className="max-w-2xl space-y-4">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">
                WhatsApp reminders{" "}
                <span className="ml-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Locked
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Requires a paid WhatsApp Business API subscription, a verified business profile and
                approved templates. Telegram reminders are enabled and free.
              </p>
            </div>
            <Switch checked={false} disabled aria-label="WhatsApp reminders locked" />
          </div>
          <div className="space-y-4 border-t border-border pt-4 opacity-60">
            <div className="space-y-2">
              <Label htmlFor="aisensy-api-key">WhatsApp provider API key</Label>
              <Input
                id="aisensy-api-key"
                disabled
                placeholder="Available with a paid subscription"
                value={aisensyApiKey}
                onChange={(e) => setAisensyApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aisensy-campaign">WhatsApp campaign / template name</Label>
              <Input
                id="aisensy-campaign"
                disabled
                placeholder="Available with a paid subscription"
                value={aisensyCampaign}
                onChange={(e) => setAisensyCampaign(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Unlocks once a WhatsApp Business API subscription is connected.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border py-2 pt-4">
            <div>
              <p className="text-sm font-medium">Email digest</p>
              <p className="text-xs text-muted-foreground">Weekly workload summary email.</p>
            </div>
            <Switch checked={email} onCheckedChange={setEmail} />
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="daily">Daily reminder time</Label>
            <Input
              id="daily"
              type="time"
              value={dailyTime}
              onChange={(e) => setDailyTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="digest-day">Weekly digest day</Label>
            <select
              id="digest-day"
              value={digestDay}
              onChange={(e) => setDigestDay(Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="digest-time">Weekly digest time</Label>
            <Input
              id="digest-time"
              type="time"
              value={digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
            />
          </div>
        </section>

        <Button onClick={onSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </AdminShell>
  );
}

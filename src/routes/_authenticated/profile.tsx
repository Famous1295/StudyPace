import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMyProfile, useUpdateMyProfile, PHONE_REGEX, TELEGRAM_BOT_USERNAME } from "@/lib/profile";
import { USERNAME_REGEX, normalizeUsername, useUsernameAvailability } from "@/lib/username";
import { useMyRole } from "@/lib/admin";
import { COUNTRY_CODES, joinPhone, splitPhone } from "@/lib/country-codes";
import { assertNotGuest } from "@/lib/guest";
import { deleteMyAccount } from "@/lib/account.functions";
import { disconnectMyTelegram } from "@/lib/telegram-link.functions";
import {
  deleteMyAIKey,
  getMyAIKey,
  saveMyAIKey,
  type AIKeyStatus,
} from "@/lib/ai-keys.functions";
import { defaultModel, getProvider, type AIProviderId } from "@/lib/ai-providers";


import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Studypace" },
      {
        name: "description",
        content:
          "View and edit your student profile, contact number, reminder preferences, or delete your account.",
      },
      { property: "og:title", content: "My profile — Studypace" },
      {
        property: "og:description",
        content: "Manage your account details and notification preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function AiSensyCard({ profile: _profile }: { profile?: import("@/lib/profile").MyProfile | null | undefined }) {
  return (
    <Card className="relative overflow-hidden border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>WhatsApp reminders</CardTitle>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Locked · Paid plan
          </span>
        </div>
        <CardDescription>
          WhatsApp delivery runs on the WhatsApp Business API, which needs a paid messaging
          subscription (Twilio / BSP), a verified business profile and pre-approved message
          templates. This channel is disabled on the current plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Paid WhatsApp Business API subscription with a messaging provider</li>
          <li>Verified business account and an approved reminder template</li>
          <li>Per-conversation charges for every reminder sent</li>
        </ul>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium">WhatsApp channel</p>
            <p className="text-xs text-muted-foreground">
              Unavailable — upgrade to a paid messaging plan to enable.
            </p>
          </div>
          <Switch checked={false} disabled aria-label="WhatsApp reminders locked" />
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium">Use Telegram instead — free</p>
          <p className="text-xs text-muted-foreground">
            Telegram reminders support the full experience: daily digests, adding tasks, marking
            them complete, deleting them and the weekly home view. Set it up in the Telegram card
            below.
          </p>
        </div>
      </CardContent>
    </Card>
  );

}

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useMyProfile();
  const { data: role } = useMyRole();
  const update = useUpdateMyProfile();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [dial, setDial] = useState("+91");
  const [local, setLocal] = useState("");
  const [weeklyMail, setWeeklyMail] = useState(true);
  const [telegram, setTelegram] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [keyStatus, setKeyStatus] = useState<AIKeyStatus | null>(null);
  const provider: AIProviderId = "openrouter";
  const model = defaultModel();
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const providerInfo = getProvider();

  useEffect(() => {
    void getMyAIKey()
      .then((s) => setKeyStatus(s))
      .catch(() => setKeyStatus({ provider: null, model: null, masked: null }));
  }, []);


  async function saveKey() {
    if (apiKey.trim().length < 15) {
      toast.error("Enter a valid API key.");
      return;
    }
    try {
      assertNotGuest();
    } catch {
      return;
    }
    setSavingKey(true);
    try {
      await saveMyAIKey({ data: { provider, model, apiKey: apiKey.trim() } });
      const s = await getMyAIKey();
      setKeyStatus(s);
      setApiKey("");
      toast.success("Your AI key is saved — all AI features will now use it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the key.");
    } finally {
      setSavingKey(false);
    }
  }

  async function removeKey() {
    setSavingKey(true);
    try {
      await deleteMyAIKey();
      setKeyStatus({ provider: null, model: null, masked: null });
      toast.success("Key removed — AI features are switched off until you add a new key.");

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the key.");
    } finally {
      setSavingKey(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setUsername(profile.username ?? "");
    const parts = splitPhone(profile.phone);
    setDial(parts.dial);
    setLocal(parts.local);
    setWeeklyMail(profile.weekly_email_opt_in ?? true);
    setTelegram(profile.telegram_opt_in ?? false);
  }, [profile]);


  const usernameChanged = username !== (profile?.username ?? "");
  const usernameState = useUsernameAvailability(username, usernameChanged);

  function save() {
    const phone = joinPhone(dial, local);
    if (phone && !PHONE_REGEX.test(phone)) {
      toast.error("Enter a valid mobile number for the selected country code.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      toast.error("Username must be 3-20 characters: lowercase letters, numbers or underscore.");
      return;
    }
    if (usernameChanged && usernameState === "taken") {
      toast.error("That username is already taken.");
      return;
    }
    update.mutate({
      full_name: fullName.trim(),
      username,
      phone: phone || null,
      weekly_email_opt_in: weeklyMail,
      telegram_opt_in: telegram,
      aisensy_opt_in: false,
    });
  }

  async function removeAccount() {
    try {
      assertNotGuest();
    } catch {
      return;
    }
    setDeleting(true);
    try {
      await deleteMyAccount();
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell title="My profile">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              {isLoading ? "Loading your profile…" : "Update your name and contact number."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{profile?.email ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                <p className="text-sm font-medium capitalize">{role ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Branch</p>
                <p className="text-sm font-medium">{profile?.branch ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Semester</p>
                <p className="text-sm font-medium">
                  {profile?.semester ? `Semester ${profile.semester}` : "—"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={fullName}
                maxLength={100}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-username">Username</Label>
              <Input
                id="profile-username"
                value={username}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {usernameChanged && usernameState === "checking" && "Checking availability…"}
                {usernameChanged && usernameState === "available" && (
                  <span className="text-safe">@{username} is available.</span>
                )}
                {usernameChanged && usernameState === "taken" && (
                  <span className="text-destructive">@{username} is already taken.</span>
                )}
                {(!usernameChanged || usernameState === "invalid" || usernameState === "error") &&
                  "You can sign in with this username instead of your email."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-phone">Mobile number</Label>
              <div className="flex gap-2">
                <Select value={dial} onValueChange={setDial}>
                  <SelectTrigger className="w-28 shrink-0 sm:w-40" aria-label="Country code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.dial}>
                        {c.dial} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="profile-phone"
                  inputMode="tel"
                  placeholder="9876543210"
                  value={local}
                  maxLength={15}
                  onChange={(e) => setLocal(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for account contact. Leave blank to remove it.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium">WhatsApp reminders</p>
                <p className="text-xs text-muted-foreground">
                  Locked — requires a paid WhatsApp Business subscription.
                </p>
              </div>
              <Switch
                checked={false}
                disabled
                aria-label="WhatsApp reminders locked"
              />
            </div>


            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Monday email digest</p>
                <p className="text-xs text-muted-foreground">
                  Every Monday we email you the tasks and submissions due that week.
                </p>
              </div>
              <Switch
                checked={weeklyMail}
                onCheckedChange={setWeeklyMail}
                aria-label="Monday email digest"
              />
            </div>

            <Button onClick={save} disabled={update.isPending || isLoading}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telegram reminders</CardTitle>
            <CardDescription>
              Free deadline nudges straight to Telegram — no phone charges, no sandbox setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.telegram_chat_id ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Connected to Telegram. You'll get a message when deadlines are within 3 days.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disconnecting}
                  onClick={async () => {
                    try {
                      assertNotGuest();
                      setDisconnecting(true);
                      const res = await disconnectMyTelegram();
                      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                      toast.success(`Telegram disconnected. New code: ${res.code}`);
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Could not disconnect Telegram.",
                      );
                    } finally {
                      setDisconnecting(false);
                    }
                  }}
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect Telegram"}
                </Button>
              </div>
            ) : (

              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Open{" "}
                  <a
                    className="font-medium text-primary underline"
                    href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{TELEGRAM_BOT_USERNAME}
                  </a>{" "}
                  in Telegram and press Start.
                </li>
                <li>
                  Send it your link code:{" "}
                  <span className="font-mono text-base font-semibold text-foreground">
                    {profile?.telegram_link_code ?? "…"}
                  </span>
                </li>
                <li>Come back here — reminders switch on automatically.</li>
              </ol>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Send Telegram reminders</p>
                <p className="text-xs text-muted-foreground">
                  Daily message listing tasks due in the next 3 days.
                </p>
              </div>
              <Switch
                checked={telegram}
                disabled={!profile?.telegram_chat_id}
                onCheckedChange={setTelegram}
                aria-label="Telegram reminders"
              />
            </div>
          </CardContent>
        </Card>

        <AiSensyCard profile={profile} />

        <Card id="ai-key">
          <CardHeader>
            <CardTitle>AI API key (OpenRouter — free)</CardTitle>
            <CardDescription>
              Required. The AI assistant, study planner, workload advice and check-ins all run on
              your own free OpenRouter key. The model is fetched and configured automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {keyStatus?.masked ? (
              <p className="rounded-lg bg-muted p-3 text-sm">
                Active: <span className="font-medium">{providerInfo.label}</span>{" "}
                · <span className="font-mono text-xs">{model}</span> · key{" "}
                <span className="font-mono text-xs">{keyStatus.masked}</span>
              </p>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No key saved yet — AI features stay locked until you add one.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ai-api-key">OpenRouter API key</Label>
              <Input
                id="ai-api-key"
                type="password"
                autoComplete="off"
                placeholder={
                  keyStatus?.masked
                    ? "Enter a new key to replace it"
                    : `Paste your key (${providerInfo.keyHint})`
                }
                value={apiKey}
                maxLength={300}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">How to get a free key</p>
              <p className="mt-1 text-muted-foreground">{providerInfo.freeTier}</p>
              <a
                className="mt-2 inline-block font-medium text-primary underline"
                href={providerInfo.keyUrl}
                target="_blank"
                rel="noreferrer"
              >
                Create an OpenRouter API key →
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveKey} disabled={savingKey}>
                {savingKey ? "Saving…" : "Save key"}
              </Button>
              {keyStatus?.masked && (
                <Button variant="outline" onClick={removeKey} disabled={savingKey}>
                  Remove key
                </Button>
              )}
            </div>


            <p className="text-xs text-muted-foreground">
              Your key is stored privately on your account and only ever used for your own requests.
            </p>
          </CardContent>
        </Card>


        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Delete account</CardTitle>
            <CardDescription>
              This permanently removes your profile, tasks, marks, plans and history. It cannot be
              undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete my account"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All of your data will be erased immediately and you will be signed out. This
                    action cannot be reversed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={removeAccount}>Yes, delete it</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

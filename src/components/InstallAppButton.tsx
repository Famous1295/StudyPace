import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isPreviewContext } from "@/lib/pwa";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Offers to install Studypace: uses the native prompt when available, else shows manual steps. */
export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setPreview(isPreviewContext());
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setPrompt(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Install Studypace app"
        title="Install app"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
            return;
          }
          setHelpOpen(true);
        }}
      >
        <Download className="size-5" />
      </Button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install Studypace</DialogTitle>
            <DialogDescription>
              Add Studypace to your home screen so it opens like a normal app.
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              You are viewing the editor preview, which cannot be installed. Open the published
              Studypace link in Chrome or Safari on your phone, then try again.
            </p>
          ) : null}

          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {platform === "ios" ? (
              <>
                <li>Open Studypace in Safari (not Chrome or an in-app browser).</li>
                <li>Tap the Share button at the bottom of the screen.</li>
                <li>Choose “Add to Home Screen”, then tap Add.</li>
              </>
            ) : platform === "android" ? (
              <>
                <li>Open Studypace in Chrome (not inside another app’s browser).</li>
                <li>Tap the ⋮ menu at the top right.</li>
                <li>Choose “Install app” or “Add to Home screen”.</li>
              </>
            ) : (
              <>
                <li>Open Studypace in Chrome or Edge.</li>
                <li>Click the install icon in the address bar, or open the ⋮ menu.</li>
                <li>Choose “Install Studypace”.</li>
              </>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

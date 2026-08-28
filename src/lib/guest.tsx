import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const GUEST_EVENT = "guest-mode-blocked";

let guestFlag = false;

export function setGuestFlag(value: boolean) {
  guestFlag = value;
}

export function isGuestSession() {
  return guestFlag;
}

export class GuestBlockedError extends Error {
  constructor() {
    super("You're in guest mode — create an account or log in to use this feature.");
    this.name = "GuestBlockedError";
  }
}

export function notifyGuestBlocked() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(GUEST_EVENT));
}

/** Throws (and opens the guest dialog) when the current session is the read-only demo. */
export function assertNotGuest() {
  if (guestFlag) {
    notifyGuestBlocked();
    throw new GuestBlockedError();
  }
}

export function GuestModeDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(GUEST_EVENT, handler);
    return () => window.removeEventListener(GUEST_EVENT, handler);
  }, []);

  async function leaveGuest(mode: "login" | "register") {
    setOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: mode === "register" ? {} : {} });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You're in guest mode</DialogTitle>
          <DialogDescription>
            This is a read-only demo with sample data, so nothing can be added, edited or deleted.
            Please create an account or log in to use all the features.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep exploring
          </Button>
          <Button variant="secondary" onClick={() => leaveGuest("login")}>
            Log in
          </Button>
          <Button onClick={() => leaveGuest("register")}>Create account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { TOUR_STEPS, onStartTour } from "@/lib/tour";
import { profileQueryKey, useMyProfile } from "@/lib/profile";

export function TourGuide() {
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Auto-start once for a brand new account.
  useEffect(() => {
    if (!profile) return;
    if (profile.tour_completed_at) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(`tour-skipped-${profile.id}`))
      return;
    setIndex(0);
    setOpen(true);
  }, [profile]);

  useEffect(() => {
    const off = onStartTour(() => {
      setIndex(0);
      setOpen(true);
    });
    return () => {
      off();
    };
  }, []);

  const step = TOUR_STEPS[index]!;
  const isLast = index === TOUR_STEPS.length - 1;

  function goTo(next: number) {
    const target = TOUR_STEPS[next];
    setIndex(next);
    if (target?.route) void navigate({ to: target.route });
  }

  async function finish(_completed: boolean) {
    setOpen(false);
    if (!profile) return;
    if (typeof window !== "undefined")
      window.localStorage.setItem(`tour-skipped-${profile.id}`, "1");
    if (profile.tour_completed_at) return;
    // Whether finished or skipped, the tour is a one-time onboarding step.
    const { error } = await supabase
      .from("profiles")
      .update({ tour_completed_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (!error) void queryClient.invalidateQueries({ queryKey: profileQueryKey });
  }


  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : void finish(false))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Compass className="size-4" /> Guided tour · {index + 1} of {TOUR_STEPS.length}
          </div>
          <DialogTitle className="text-xl">{step.title}</DialogTitle>
          <DialogDescription className="sr-only">Studypace feature walkthrough</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {step.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {step.tip && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground">
              Where: {step.tip}
            </p>
          )}
        </div>

        <div className="flex gap-1" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => void finish(false)}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={() => goTo(index - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => (isLast ? void finish(true) : goTo(index + 1))}>
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

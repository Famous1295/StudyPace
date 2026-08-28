import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import logo from "@/assets/studypace-logo.png";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studypace for Engineering Students" },
      {
        name: "description",
        content:
          "Log exams, assignments, labs and projects and get an automatic weekly panic score so no week catches you off guard.",
      },
      { property: "og:title", content: "Studypace" },
      {
        property: "og:description",
        content: "Automatic weekly panic scoring for engineering students' academic deadlines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    title: "Weekly panic score",
    body: "Every deadline is weighted by type and urgency, then summed per week so you see trouble before it lands.",
  },
  {
    title: "Do-first ordering",
    body: "A priority engine ranks each task by weight, days left, effort and same-day clashes.",
  },
  {
    title: "Clash detection",
    body: "Tasks sharing a deadline get flagged automatically so two exams never surprise you on one morning.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, [navigate]);

  async function enterGuestMode() {
    setGuestError(null);
    setGuestLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: "guest@demo.com",
      password: "guest@123",
    });
    setGuestLoading(false);
    if (error) {
      setGuestError("Guest demo is unavailable right now.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Studypace logo" width={36} height={36} className="h-9 w-9 rounded-lg" />
            <span className="text-sm font-bold tracking-tight sm:text-base">
              Studypace
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Built for engineering semesters
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Know which week will break you — before it does.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              Log every exam, assignment, lab and project. We score each week automatically so you
              know when you're Safe, Busy or Overloaded, and exactly which task to do first.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={signedIn ? "/dashboard" : "/auth"}>
                  {signedIn ? "Go to dashboard" : "Start balancing free"}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">I already have an account</Link>
              </Button>
              {!signedIn && (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={enterGuestMode}
                  disabled={guestLoading}
                >
                  {guestLoading ? "Opening demo…" : "Try guest mode — no password"}
                </Button>
              )}
            </div>
            {guestError && <p className="mt-3 text-sm text-destructive">{guestError}</p>}
            <p className="mt-3 text-xs text-muted-foreground">
              Guest mode opens the student workspace with sample subjects, deadlines, marks and
              panic scores. Read-only — nothing you do is saved.
            </p>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
              {[
                ["Safe", "< 5"],
                ["Busy", "5 – 10"],
                ["Overloaded", "> 10"],
              ].map(([label, range]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-lg font-bold">{range}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <img
              src={hero}
              alt="Engineering student planning semester deadlines on a laptop beside a wall calendar"
              width={1536}
              height={1024}
              className="w-full rounded-2xl border border-border object-cover shadow-lg"
            />
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-5 px-6 py-14 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-base font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Studypace</span>
          <Link to="/adminportal" className="hover:text-foreground">
            Administrator login
          </Link>
        </div>
      </footer>
    </div>
  );
}

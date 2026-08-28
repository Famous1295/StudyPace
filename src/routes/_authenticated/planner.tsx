import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, Scale, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AIKeyGate } from "@/components/AIKeyGate";
import { AIAnswer, AIBadge } from "@/components/AIAnswer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTasks } from "@/lib/tasks";
import { useMySubjects } from "@/lib/subjects";
import { useMarks } from "@/lib/marks";
import { usePlanMutations, useStudyPlans, type PlanDay } from "@/lib/plans";
import { buildAIContext } from "@/lib/ai-context";
import { checkExamReadiness, generateStudyPlan, rebalanceWorkload } from "@/lib/ai.functions";
import { exportPlanPDF } from "@/lib/export";
import { classify, STATUS_LABEL, upcomingWeeks } from "@/lib/panic";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Planner — Studypace" },
      {
        name: "description",
        content:
          "Generate day-by-day study plans, rebalance overloaded weeks and check your exam readiness.",
      },
      { property: "og:title", content: "Planner — Studypace" },
      {
        property: "og:description",
        content: "AI study plans, workload rebalancing and exam readiness scoring for students.",
      },
    ],
  }),
  component: PlannerPage,
});

function PlannerPage() {
  const { data: tasks = [] } = useTasks();
  const { data: subjects = [] } = useMySubjects();
  const { data: marks = [] } = useMarks();
  const { data: plans = [] } = useStudyPlans();
  const { save, remove } = usePlanMutations();

  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("3");
  const [topics, setTopics] = useState("");
  const [weakness, setWeakness] = useState("");
  const [draft, setDraft] = useState<PlanDay[]>([]);
  const [generating, setGenerating] = useState(false);

  const [rebalance, setRebalance] = useState("");
  const [rebalancing, setRebalancing] = useState(false);
  const [readiness, setReadiness] = useState<{
    readiness: number;
    verdict: string;
    actions: string[];
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const weeks = useMemo(() => upcomingWeeks(tasks, 6), [tasks]);
  const overloaded = weeks.filter((w) => classify(w.score) === "overloaded");
  const context = () => buildAIContext(tasks, subjects, marks);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !examDate) {
      toast.error("Add a subject and exam date.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateStudyPlan({
        data: {
          subject: subject.trim(),
          examDate,
          hoursPerDay: Number(hoursPerDay) || 3,
          topics: topics.trim(),
          weakness: weakness.trim(),
        },
      });
      setDraft(res.plan);
      toast.success("Plan generated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build a plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function runRebalance() {
    setRebalancing(true);
    try {
      const res = await rebalanceWorkload({ data: context() });
      setRebalance(res.answer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rebalance.");
    } finally {
      setRebalancing(false);
    }
  }

  async function runReadiness() {
    setChecking(true);
    try {
      setReadiness(await checkExamReadiness({ data: context() }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not score readiness.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <AppShell title="Planner">
      <AIKeyGate />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Generate a study plan</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={generate}>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  list="planner-subjects"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Data Structures"
                />
                <datalist id="planner-subjects">
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="exam-date">Exam date</Label>
                  <Input
                    id="exam-date"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hpd">Hours / day</Label>
                  <Input
                    id="hpd"
                    type="number"
                    min={1}
                    max={12}
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topics">Topics (optional)</Label>
                <Textarea
                  id="topics"
                  rows={3}
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="Trees, graphs, dynamic programming…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weak">Weak areas (optional)</Label>
                <Input
                  id="weak"
                  value={weakness}
                  onChange={(e) => setWeakness(e.target.value)}
                  placeholder="Recursion"
                />
              </div>
              <Button type="submit" className="w-full" disabled={generating}>
                <Sparkles className="size-4" /> {generating ? "Building…" : "Generate plan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {draft.length ? `Draft plan · ${subject}` : "Your plan"}
            </CardTitle>
            {draft.length > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportPlanPDF(`${subject} study plan`, `Exam on ${examDate}`, draft)
                  }
                >
                  <Download className="size-4" /> PDF
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    save.mutate(
                      {
                        title: `${subject} study plan`,
                        subject_name: subject,
                        exam_date: examDate || null,
                        source: "ai",
                        notes: weakness || null,
                        plan: draft,
                      },
                      { onSuccess: () => setDraft([]) },
                    )
                  }
                  disabled={save.isPending}
                >
                  <Plus className="size-4" /> Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {draft.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Generate a plan and it will appear here before you save it.
              </p>
            ) : (
              <>
                <AIBadge label="AI study plan" />
                <ol className="mt-3 space-y-2">
                  {draft.map((day, i) => (
                    <li key={i} className="rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{day.date}</span>
                        <span className="text-muted-foreground">{day.hours}h</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{day.focus}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Workload rebalancer</CardTitle>
            <Button size="sm" variant="outline" onClick={runRebalance} disabled={rebalancing}>
              <Scale className="size-4" /> {rebalancing ? "Rebalancing…" : "Suggest a rebalance"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              {weeks.map((w) => (
                <span
                  key={w.weekStart}
                  className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold"
                >
                  {w.weekStart.slice(5)} · {w.score} · {STATUS_LABEL[classify(w.score)]}
                </span>
              ))}
            </div>
            {overloaded.length > 0 && (
              <p className="mb-3 rounded-lg bg-overloaded/10 px-3 py-2 text-sm text-overloaded">
                {overloaded.length} overloaded week
                {overloaded.length === 1 ? "" : "s"} ahead — spread this work out now.
              </p>
            )}
            {rebalance ? (
              <div className="rounded-lg bg-muted p-3">
                <AIBadge label="Rebalancer" />
                <AIAnswer text={rebalance} className="mt-2" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask for a rebalance to get task-level suggestions for flattening your peaks.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Exam readiness</CardTitle>
            <Button size="sm" variant="outline" onClick={runReadiness} disabled={checking}>
              {checking ? "Checking…" : "Check"}
            </Button>
          </CardHeader>
          <CardContent>
            {readiness ? (
              <div className="space-y-3">
                <div>
                  <p className="text-4xl font-bold">{readiness.readiness}%</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${readiness.readiness}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm">{readiness.verdict}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {readiness.actions.map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Get a readiness percentage based on your deadlines, hours and recent marks.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Saved plans</CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved plans yet.</p>
            ) : (
              <div className="space-y-3">
                {plans.map((p) => (
                  <details key={p.id} className="rounded-lg border border-border px-3 py-2">
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                      <span>
                        {p.title}
                        {p.exam_date ? (
                          <span className="text-muted-foreground"> · exam {p.exam_date}</span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Download plan"
                          onClick={(e) => {
                            e.preventDefault();
                            exportPlanPDF(p.title, p.exam_date ?? "", p.plan);
                          }}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete plan"
                          onClick={(e) => {
                            e.preventDefault();
                            remove.mutate(p.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {p.plan.map((d, i) => (
                        <li key={i}>
                          <span className="font-medium text-foreground">{d.date}</span> · {d.hours}h
                          — {d.focus}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

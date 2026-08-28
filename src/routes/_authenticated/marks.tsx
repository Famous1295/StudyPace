import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AIKeyGate } from "@/components/AIKeyGate";
import { AIAnswer, AIBadge } from "@/components/AIAnswer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { percentOf, subjectPerformance, useMarkMutations, useMarks } from "@/lib/marks";
import { useMySubjects } from "@/lib/subjects";
import { useTasks } from "@/lib/tasks";
import { buildAIContext } from "@/lib/ai-context";
import { adviseWeakSubjects } from "@/lib/ai.functions";
import { exportCSV } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({
    meta: [
      { title: "Marks — Studypace" },
      {
        name: "description",
        content: "Record exam marks, spot weak subjects early and get targeted improvement advice.",
      },
      { property: "og:title", content: "Marks — Studypace" },
      {
        property: "og:description",
        content: "Track subject performance and detect weak subjects before the finals.",
      },
    ],
  }),
  component: MarksPage,
});

const BAND_CLASS = {
  weak: "bg-overloaded/15 text-overloaded",
  watch: "bg-busy/15 text-busy",
  strong: "bg-safe/15 text-safe",
} as const;

function MarksPage() {
  const { data: marks = [], isLoading } = useMarks();
  const { data: subjects = [] } = useMySubjects();
  const { data: tasks = [] } = useTasks();
  const { create, remove } = useMarkMutations();

  const [subjectId, setSubjectId] = useState<string>("");
  const [examName, setExamName] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);

  const performance = useMemo(() => subjectPerformance(marks), [marks]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) {
      toast.error("Pick a subject first.");
      return;
    }
    if (!examName.trim()) {
      toast.error("Give the exam a name.");
      return;
    }
    const s = Number(score);
    const m = Number(maxScore);
    if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0 || s < 0 || s > m) {
      toast.error("Enter a valid score out of the maximum.");
      return;
    }
    create.mutate(
      {
        subject_id: subject.id,
        subject_name: subject.name,
        exam_name: examName.trim(),
        score: s,
        max_score: m,
        exam_date: examDate,
      },
      {
        onSuccess: () => {
          setExamName("");
          setScore("");
        },
      },
    );
  }

  async function getAdvice() {
    if (!marks.length) {
      toast.error("Add at least one result first.");
      return;
    }
    setBusy(true);
    try {
      const res = await adviseWeakSubjects({ data: buildAIContext(tasks, subjects, marks) });
      setAdvice(res.answer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get advice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Marks & performance"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportCSV(
              marks.map((m) => ({
                Subject: m.subject_name,
                Exam: m.exam_name,
                Score: m.score,
                Max: m.max_score,
                Percent: percentOf(m),
                Date: m.exam_date,
              })),
              "marks.csv",
            )
          }
          disabled={!marks.length}
        >
          Export CSV
        </Button>
      }
    >
      <AIKeyGate />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Record a result</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam">Exam</Label>
                <Input
                  id="exam"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Mid-sem 1"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="score">Score</Label>
                  <Input id="score" value={score} onChange={(e) => setScore(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max">Out of</Label>
                  <Input id="max" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Save result
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Subject performance</CardTitle>
            <Button size="sm" variant="outline" onClick={getAdvice} disabled={busy}>
              <Sparkles className="size-4" /> {busy ? "Analysing…" : "Weak-subject advice"}
            </Button>
          </CardHeader>
          <CardContent>
            {performance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {performance.map((p) => (
                  <li
                    key={p.subject}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.subject}</p>
                      <p className="text-xs text-muted-foreground">{p.count} result(s)</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        BAND_CLASS[p.band],
                      )}
                    >
                      {p.average}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {advice && (
              <div className="mt-4 rounded-lg bg-muted p-3">
                <AIBadge label="Weak-subject advisor" />
                <AIAnswer text={advice} className="mt-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">All results</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : marks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Subject</th>
                      <th className="py-2">Exam</th>
                      <th className="py-2">Score</th>
                      <th className="py-2">%</th>
                      <th className="py-2">Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-2">{m.subject_name}</td>
                        <td className="py-2">{m.exam_name}</td>
                        <td className="py-2">
                          {m.score}/{m.max_score}
                        </td>
                        <td className="py-2 font-semibold">{percentOf(m)}%</td>
                        <td className="py-2 text-muted-foreground">{m.exam_date}</td>
                        <td className="py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete result"
                            onClick={() => remove.mutate(m.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HeartHandshake, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AIKeyGate, useAIKey } from "@/components/AIKeyGate";
import { AIAnswer, AIBadge } from "@/components/AIAnswer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTasks } from "@/lib/tasks";
import { useMySubjects } from "@/lib/subjects";
import { useMarks } from "@/lib/marks";
import { useAIChats, useSaveChat } from "@/lib/chats";
import { buildAIContext } from "@/lib/ai-context";
import { askAssistant, sentimentCheckIn } from "@/lib/ai.functions";
import { classify, upcomingWeeks } from "@/lib/panic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI assistant — Studypace" },
      {
        name: "description",
        content:
          "Assignment help, doubt solving and exam strategy from an assistant that knows your workload.",
      },
      { property: "og:title", content: "AI assistant — Studypace" },
      {
        property: "og:description",
        content: "Ask about assignments, doubts and exam prep with your workload as context.",
      },
    ],
  }),
  component: AssistantPage,
});

const CATEGORIES = [
  { id: "assignment", label: "Assignment help", hint: "Plan and structure an assignment" },
  { id: "doubt", label: "Doubt solver", hint: "Explain a concept step by step" },
  { id: "exam", label: "Exam & marks", hint: "Revision strategy and marks advice" },
] as const;

const MOODS = ["Calm", "Okay", "Stressed", "Overwhelmed", "Burnt out"];

function AssistantPage() {
  const { data: tasks = [] } = useTasks();
  const { data: subjects = [] } = useMySubjects();
  const { data: marks = [] } = useMarks();
  const { data: history = [] } = useAIChats();
  const saveChat = useSaveChat();
  const { data: aiKey } = useAIKey();
  const hasKey = Boolean(aiKey?.masked);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("assignment");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const [mood, setMood] = useState("Okay");
  const [note, setNote] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checking, setChecking] = useState(false);

  const week = upcomingWeeks(tasks, 1)[0];

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!hasKey) {
      toast.error("Save an AI API key in My profile to use the assistant.");
      return;
    }
    if (question.trim().length < 3) {
      toast.error("Ask a slightly longer question.");
      return;
    }
    setBusy(true);
    setAnswer("");
    try {
      const ctx = buildAIContext(tasks, subjects, marks);
      const summary = ctx.tasks
        .slice(0, 10)
        .map((t) => `${t.title} (${t.type}, due in ${t.days}d)`)
        .join("; ");
      const res = await askAssistant({
        data: { category, question: question.trim(), context: summary },
      });
      setAnswer(res.answer);
      saveChat.mutate({ category, question: question.trim(), answer: res.answer });
      setQuestion("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The assistant could not answer.");
    } finally {
      setBusy(false);
    }
  }

  async function runCheckIn() {
    if (!hasKey) {
      toast.error("Save an AI API key in My profile to use the assistant.");
      return;
    }
    setChecking(true);
    try {
      const res = await sentimentCheckIn({
        data: {
          mood,
          note: note.trim(),
          score: week?.score ?? 0,
          taskCount: tasks.filter((t) => !t.is_completed).length,
        },
      });
      setCheckIn(res.answer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <AppShell title="AI assistant">
      <AIKeyGate />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ask anything about your semester</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    category === c.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <form className="space-y-3" onSubmit={ask}>
              <Textarea
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  hasKey
                    ? CATEGORIES.find((c) => c.id === category)?.hint
                    : "Add your AI API key in My profile to ask questions"
                }
                disabled={!hasKey}
              />
              <Button type="submit" disabled={busy || !hasKey}>
                <Send className="size-4" /> {busy ? "Thinking…" : "Ask"}
              </Button>
            </form>
            {answer && (
              <div className="mt-4 rounded-lg bg-muted p-3">
                <AIBadge />
                <AIAnswer text={answer} className="mt-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartHandshake className="size-4" /> Weekly check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>How are you feeling?</Label>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      mood === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Anything on your mind?</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {week && (
              <p className="text-xs text-muted-foreground">
                This week: score {week.score} ({classify(week.score)})
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={runCheckIn} disabled={checking || !hasKey}>
              {checking ? "Checking in…" : "Check in"}
            </Button>
            {checkIn && <AIAnswer text={checkIn} className="rounded-lg bg-muted p-3" />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <details key={h.id} className="rounded-lg border border-border px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      {h.question}
                      <span className="ml-2 text-xs text-muted-foreground">{h.category}</span>
                    </summary>
                    <AIAnswer text={h.answer} className="mt-2 text-muted-foreground" />
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

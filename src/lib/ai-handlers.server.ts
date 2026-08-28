import {
  callAI,
  callAIJson,
  SYSTEM_PROMPTS,
  type AICategory,
  type AICreds,
} from "@/lib/ai.server";

export interface AssistantInput {
  category: AICategory;
  question: string;
  context?: string;
}

export interface StudyPlanInput {
  subject: string;
  examDate: string;
  hoursPerDay: number;
  topics?: string;
  weakness?: string;
}

export interface ContextTask {
  title: string;
  type: string;
  deadline_date: string;
  est_hours: number;
  days: number;
  subject?: string | null | undefined;
}

export interface ContextInput {
  tasks: ContextTask[];
  weeks: { weekStart: string; score: number; hours: number }[];
  marks?: { subject: string; exam: string; percent: number }[] | undefined;
}

export interface ParseTaskInput {
  transcript: string;
  today: string;
  subjects: string[];
}

export interface PlanDay {
  date: string;
  focus: string;
  hours: number;
}

function describe(input: ContextInput): string {
  const tasks = input.tasks
    .map(
      (t) =>
        `- ${t.title} (${t.type}${t.subject ? `, ${t.subject}` : ""}) due ${t.deadline_date}, ${t.days} day(s) away, ~${t.est_hours}h`,
    )
    .join("\n");
  const weeks = input.weeks
    .map((w) => `- week of ${w.weekStart}: panic score ${w.score}, ${w.hours}h planned`)
    .join("\n");
  const marks = (input.marks ?? [])
    .map((m) => `- ${m.subject} / ${m.exam}: ${m.percent}%`)
    .join("\n");
  return [
    `ACTIVE TASKS:\n${tasks || "(none)"}`,
    `WEEKLY PANIC SCORES:\n${weeks || "(none)"}`,
    marks ? `RECENT MARKS:\n${marks}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const SCORE_RULES =
  "Panic score for a week = sum over tasks of (task weight / days remaining). Weights: exam 3, assignment 2, project 2, lab 1. Under 5 is Safe, 5-10 is Busy, above 10 is Overloaded.";

export async function askAssistantHandler({ category, question, context }: AssistantInput, creds?: AICreds) {
  const answer = await callAI([
    { role: "system", content: SYSTEM_PROMPTS[category] },
    {
      role: "user",
      content: context ? `${question}\n\nStudent context:\n${context}` : question,
    },
  ], creds);
  return { answer };
}

export async function studyPlanHandler(input: StudyPlanInput, creds?: AICreds) {
  const plan = await callAIJson<PlanDay[]>([
    {
      role: "system",
      content:
        "You build day-by-day exam revision plans for engineering students. Reply with ONLY a JSON array. Each element: {\"date\":\"YYYY-MM-DD\",\"focus\":\"what to study that day\",\"hours\":number}. Include a final revision + mock-test day right before the exam. No prose, no markdown fences.",
    },
    {
      role: "user",
      content: `Subject: ${input.subject}\nExam date: ${input.examDate}\nAvailable study hours per day: ${input.hoursPerDay}\nTopics: ${input.topics || "not specified — use a standard syllabus for this subject"}\nWeak areas: ${input.weakness || "not specified"}\nToday: ${new Date().toISOString().slice(0, 10)}`,
    },
  ], creds);
  return { plan: plan.slice(0, 60) };
}

export async function weakSubjectHandler(input: ContextInput, creds?: AICreds) {
  const answer = await callAI([
    {
      role: "system",
      content:
        "You are a weak-subject advisor. Identify the 2-3 subjects most at risk based on marks and workload, and give one concrete corrective action for each. Be specific and under 220 words. Use markdown bullets.",
    },
    { role: "user", content: describe(input) },
  ], creds);
  return { answer };
}

export async function rebalanceHandler(input: ContextInput, creds?: AICreds) {
  const answer = await callAI([
    {
      role: "system",
      content: `You are a workload rebalancer. ${SCORE_RULES} Suggest concrete moves — start earlier, split into sessions, shift a low-stakes deadline, or pre-work a task — so no week stays Overloaded. Reply with markdown bullets naming the exact task and the exact suggested change. Under 220 words.`,
    },
    { role: "user", content: describe(input) },
  ], creds);
  return { answer };
}

export async function examReadinessHandler(input: ContextInput, creds?: AICreds) {
  const result = await callAIJson<{ readiness: number; verdict: string; actions: string[] }>([
    {
      role: "system",
      content: `You assess exam readiness. ${SCORE_RULES} Reply with ONLY JSON: {"readiness": 0-100 integer, "verdict": "one sentence", "actions": ["3 short actions"]}. No markdown fences.`,
    },
    { role: "user", content: describe(input) },
  ], creds);
  return {
    readiness: Math.max(0, Math.min(100, Math.round(result.readiness))),
    verdict: result.verdict,
    actions: (result.actions ?? []).slice(0, 5),
  };
}

export async function explainScoreHandler(input: ContextInput, creds?: AICreds) {
  const answer = await callAI([
    {
      role: "system",
      content: `You explain a student's panic score in plain English. ${SCORE_RULES} Show which tasks contribute most (with their arithmetic), then say what single change would drop the score fastest. Under 200 words, markdown bullets.`,
    },
    { role: "user", content: describe(input) },
  ], creds);
  return { answer };
}

export async function checkInHandler(input: {
  mood: string;
  note?: string | undefined;
  score: number;
  taskCount: number;
}, creds?: AICreds) {
  const answer = await callAI([
    {
      role: "system",
      content:
        "You are a supportive, sentiment-aware academic check-in companion. Acknowledge how the student feels first, then give at most three grounded, practical next steps for the next 24 hours. Never give medical advice; if the student sounds in crisis, gently suggest talking to someone they trust or their college counsellor. Under 160 words.",
    },
    {
      role: "user",
      content: `Mood: ${input.mood}\nNote: ${input.note || "(none)"}\nThis week's panic score: ${input.score}\nActive tasks: ${input.taskCount}`,
    },
  ], creds);
  return { answer };
}

export async function parseTaskHandler(input: ParseTaskInput, creds?: AICreds) {
  const parsed = await callAIJson<{
    title: string;
    type: string;
    deadline_date: string;
    est_hours: number;
    subject: string | null;
  }>([
    {
      role: "system",
      content:
        'You convert a spoken sentence into an academic task. Reply with ONLY JSON: {"title":string,"type":"exam"|"assignment"|"lab"|"project","deadline_date":"YYYY-MM-DD","est_hours":number 1-40,"subject":string|null}. Resolve relative dates like "next Friday" against the given today date. Pick subject only from the provided list, else null. No markdown fences.',
    },
    {
      role: "user",
      content: `Today: ${input.today}\nKnown subjects: ${input.subjects.join(", ") || "(none)"}\nSpoken: "${input.transcript}"`,
    },
  ], creds);
  const type = ["exam", "assignment", "lab", "project"].includes(parsed.type)
    ? parsed.type
    : "assignment";
  return {
    title: (parsed.title || input.transcript).slice(0, 120),
    type,
    deadline_date: parsed.deadline_date,
    est_hours: Math.max(1, Math.min(40, Math.round(parsed.est_hours || 2))),
    subject: parsed.subject,
  };
}

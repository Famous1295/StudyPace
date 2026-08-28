import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadUserAICreds } from "@/lib/ai-keys.server";
import {
  askAssistantHandler,
  checkInHandler,
  examReadinessHandler,
  explainScoreHandler,
  parseTaskHandler,
  rebalanceHandler,
  studyPlanHandler,
  weakSubjectHandler,
  type AssistantInput,
  type ContextInput,
  type ParseTaskInput,
  type StudyPlanInput,
} from "@/lib/ai-handlers.server";

const taskContext = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().max(200),
        type: z.string().max(20),
        deadline_date: z.string().max(20),
        est_hours: z.number(),
        days: z.number(),
        subject: z.string().max(120).nullable().optional(),
      }),
    )
    .max(60),
  weeks: z
    .array(z.object({ weekStart: z.string().max(20), score: z.number(), hours: z.number() }))
    .max(12),
  marks: z
    .array(
      z.object({
        subject: z.string().max(120),
        exam: z.string().max(120),
        percent: z.number(),
      }),
    )
    .max(60)
    .optional(),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        category: z.enum(["assignment", "doubt", "exam"]),
        question: z.string().min(3).max(2000),
        context: z.string().max(4000).optional(),
      })
      .parse(data) as AssistantInput,
  )
  .handler(async ({ data, context }) => askAssistantHandler(data, await loadUserAICreds(context.supabase)));

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        subject: z.string().min(1).max(120),
        examDate: z.string().min(4).max(20),
        hoursPerDay: z.number().min(1).max(12),
        topics: z.string().max(2000).optional(),
        weakness: z.string().max(1000).optional(),
      })
      .parse(data) as StudyPlanInput,
  )
  .handler(async ({ data, context }) => studyPlanHandler(data, await loadUserAICreds(context.supabase)));

export const adviseWeakSubjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => taskContext.parse(data) as ContextInput)
  .handler(async ({ data, context }) => weakSubjectHandler(data, await loadUserAICreds(context.supabase)));

export const rebalanceWorkload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => taskContext.parse(data) as ContextInput)
  .handler(async ({ data, context }) => rebalanceHandler(data, await loadUserAICreds(context.supabase)));

export const checkExamReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => taskContext.parse(data) as ContextInput)
  .handler(async ({ data, context }) => examReadinessHandler(data, await loadUserAICreds(context.supabase)));

export const explainPanicScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => taskContext.parse(data) as ContextInput)
  .handler(async ({ data, context }) => explainScoreHandler(data, await loadUserAICreds(context.supabase)));

export const sentimentCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        mood: z.string().min(1).max(40),
        note: z.string().max(1000).optional(),
        score: z.number(),
        taskCount: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => checkInHandler(data, await loadUserAICreds(context.supabase)));

export const parseSpokenTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        transcript: z.string().min(2).max(600),
        today: z.string().max(20),
        subjects: z.array(z.string().max(120)).max(40),
      })
      .parse(data) as ParseTaskInput,
  )
  .handler(async ({ data, context }) => parseTaskHandler(data, await loadUserAICreds(context.supabase)));

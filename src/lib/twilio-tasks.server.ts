import {
  sendTwilioMessage,
  renderReminder,
  whatsappNumber,
} from "@/lib/twilio.server";

export const TASK_TYPES = ["exam", "assignment", "project", "lab"] as const;
export type BotTaskType = (typeof TASK_TYPES)[number];
const TYPE_WEIGHTS: Record<BotTaskType, number> = { exam: 3, assignment: 2, project: 2, lab: 1 };
const TYPE_LABELS: Record<BotTaskType, string> = {
  exam: "📝 Exam",
  assignment: "📄 Assignment",
  project: "🛠 Project",
  lab: "🔬 Lab",
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, "today", "tomorrow", "5d". */
export function parseDeadline(input: string): string | null {
  const raw = input.trim().toLowerCase();
  const today = new Date();
  if (raw === "today") return iso(today);
  if (raw === "tomorrow") {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + 1);
    return iso(d);
  }
  const rel = raw.match(/^(\d{1,3})\s*d(ays?)?$/);
  if (rel) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + Number(rel[1]));
    return iso(d);
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  }
  return null;
}

const sessionKey = (chatId: string) => `twilio:${chatId}`;

interface Draft {
  title?: string;
  type?: BotTaskType;
  deadline_date?: string;
  est_hours?: number;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function setSession(chatId: string, userId: string, step: string, draft: Draft) {
  const supabaseAdmin = await getAdmin();
  await supabaseAdmin.from("chat_sessions").upsert(
    {
      phone: sessionKey(chatId),
      user_id: userId,
      step,
      draft: draft as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
}

async function clearSession(chatId: string) {
  const supabaseAdmin = await getAdmin();
  await supabaseAdmin.from("chat_sessions").delete().eq("phone", sessionKey(chatId));
}

export async function getSession(chatId: string) {
  const supabaseAdmin = await getAdmin();
  const { data } = await supabaseAdmin
    .from("chat_sessions")
    .select("step, draft, user_id")
    .eq("phone", sessionKey(chatId))
    .maybeSingle();
  return data as { step: string; draft: Draft; user_id: string | null } | null;
}

export async function startAddTask(chatId: string, userId: string) {
  await setSession(chatId, userId, "task_title", {});
  await sendTwilioMessage(
    chatId,
    "Let's add a task 📝\n\nWhat's the *title*?\n\nReply *cancel* to stop.",
  );
}

export async function cancelFlow(chatId: string) {
  await clearSession(chatId);
  await sendTwilioMessage(
    chatId,
    "Cancelled. Nothing was saved.\n\nReply *home* any time to see this week's tasks or *add* to add a task.",
  );
}

async function askType(chatId: string, title: string) {
  const options = TASK_TYPES.map((t, i) => `${i + 1}. ${TYPE_LABELS[t]}`).join("\n");
  await sendTwilioMessage(
    chatId,
    `Got it: *${title}*\n\nWhat *type* is it?\n\n${options}\n\nReply with the number.`,
  );
}

async function askDate(chatId: string) {
  await sendTwilioMessage(
    chatId,
    "When is it *due*? 📅\n\nSend a date like 2026-08-30, or type *today*, *tomorrow*, or *5d* for 5 days from now.",
  );
}

async function askHours(chatId: string, date: string) {
  await sendTwilioMessage(
    chatId,
    `Due *${date}* ✅\n\nRoughly how many *hours* of work?\n\nReply with a number (1-200).`,
  );
}

async function saveTask(chatId: string, userId: string, draft: Draft, hours: number) {
  const type = (draft.type ?? "assignment") as BotTaskType;
  const supabaseAdmin = await getAdmin();
  const { error } = await supabaseAdmin.from("tasks").insert({
    user_id: userId,
    title: draft.title!,
    type,
    weight: TYPE_WEIGHTS[type],
    deadline_date: draft.deadline_date!,
    est_hours: Math.round(hours),
    is_completed: false,
  });
  await clearSession(chatId);

  if (error) {
    console.error("Twilio add task failed:", error.message);
    await sendTwilioMessage(chatId, "Couldn't save that task. Please try again.");
    return;
  }

  await sendTwilioMessage(
    chatId,
    `Saved ✅\n\n*${draft.title}* (${type}) — due ${draft.deadline_date}, ~${Math.round(hours)}h.\n\nIt's now in your Studypace dashboard.\n\nReply *home* to see this week's tasks or *add* for another.`,
  );
}

export async function continueAddTask(
  chatId: string,
  userId: string,
  step: string,
  draft: Draft,
  text: string,
) {
  const value = text.trim();

  if (step === "task_title") {
    if (value.length < 2 || value.length > 120) {
      await sendTwilioMessage(chatId, "Please send a title between 2 and 120 characters.");
      return;
    }
    await setSession(chatId, userId, "task_type", { ...draft, title: value });
    await askType(chatId, value);
    return;
  }

  if (step === "task_type") {
    const idx = Number(value.replace(/\D/g, "")) - 1;
    const type = TASK_TYPES[idx];
    if (!type) {
      const options = TASK_TYPES.map((t, i) => `${i + 1}. ${TYPE_LABELS[t]}`).join("\n");
      await sendTwilioMessage(chatId, `Reply with a number from the list:\n\n${options}`);
      return;
    }
    await setSession(chatId, userId, "task_date", { ...draft, type });
    await askDate(chatId);
    return;
  }

  if (step === "task_date") {
    const date = parseDeadline(value);
    if (!date) {
      await sendTwilioMessage(
        chatId,
        "I couldn't read that date. Send a date like 2026-08-30, or type *today*, *tomorrow*, or *5d*.",
      );
      return;
    }
    await setSession(chatId, userId, "task_hours", { ...draft, deadline_date: date });
    await askHours(chatId, date);
    return;
  }

  if (step === "task_hours") {
    const hours = Number(value.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(hours) || hours <= 0 || hours > 200) {
      await sendTwilioMessage(chatId, "Reply with a number of hours between 1 and 200.");
      return;
    }
    await saveTask(chatId, userId, draft, hours);
    return;
  }

  await clearSession(chatId);
}

/* ---------------- home / weekly view ---------------- */

function weekRange(ref = new Date()) {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(d);
  start.setUTCDate(start.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: iso(start), end: iso(end) };
}

function shortDate(dateIso: string) {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function dayLabel(dateIso: string) {
  const today = iso(new Date());
  const tomorrow = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return iso(d);
  })();
  const weekday = new Date(`${dateIso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
  if (dateIso === today) return `Today · ${shortDate(dateIso)}`;
  if (dateIso === tomorrow) return `Tomorrow · ${shortDate(dateIso)}`;
  if (dateIso < today) return `${weekday} · ${shortDate(dateIso)} (overdue)`;
  return `${weekday} · ${shortDate(dateIso)}`;
}

const TYPE_ICON: Record<string, string> = {
  exam: "📝",
  assignment: "📄",
  project: "🛠",
  lab: "🔬",
};

interface HomeTask {
  id: string;
  title: string;
  type: string;
  deadline_date: string;
  est_hours: number | null;
  is_completed: boolean;
}

function renderHome(tasks: HomeTask[], start: string, end: string) {
  const header = `🏠 *This week*\n${shortDate(start)} – ${shortDate(end)}`;

  if (tasks.length === 0) {
    return {
      text: `${header}\n\n🎉 Nothing due this week. Enjoy the calm!\n\nReply *add* to add a task.`,
      indexMap: [],
    };
  }

  const open = tasks.filter((t) => !t.is_completed);
  const hours = open.reduce((sum, t) => sum + (t.est_hours ?? 0), 0);

  const byDay = new Map<string, HomeTask[]>();
  for (const t of tasks) byDay.set(t.deadline_date, [...(byDay.get(t.deadline_date) ?? []), t]);

  const blocks: string[] = [];
  let n = 0;
  const indexMap: { n: number; id: string }[] = [];

  for (const [date, items] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const lines = items.map((t) => {
      n += 1;
      indexMap.push({ n, id: t.id });
      const icon = TYPE_ICON[t.type] ?? "•";
      const hrs = t.est_hours ? ` · ${t.est_hours}h` : "";
      return t.is_completed
        ? `${n}. ~${icon} ${t.title}~ ✅`
        : `${n}. ${icon} *${t.title}*${hrs}`;
    });
    blocks.push(`📅 *${dayLabel(date)}*\n${lines.join("\n")}`);
  }

  const summary = `${open.length} to do · ${tasks.length - open.length} done · ~${hours}h left`;

  return {
    text: `${header}\n_${summary}_\n\n${blocks.join("\n\n")}\n\nReply *done N* to complete or *delete N* to remove a numbered task.\nReply *add* to add a task or *home* to refresh.`,
    indexMap,
  };
}

async function loadWeek(userId: string) {
  const { start, end } = weekRange();
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, title, type, deadline_date, est_hours, is_completed")
    .eq("user_id", userId)
    .gte("deadline_date", start)
    .lte("deadline_date", end)
    .order("deadline_date", { ascending: true })
    .order("created_at", { ascending: true });
  return { tasks: (data ?? []) as HomeTask[], error, start, end };
}

export async function sendHome(chatId: string, userId: string) {
  await clearSession(chatId);
  const { tasks, error, start, end } = await loadWeek(userId);
  if (error) {
    console.error("Twilio home failed:", error.message);
    await sendTwilioMessage(chatId, "Couldn't load your week. Please try again.");
    return;
  }
  const view = renderHome(tasks, start, end);
  await sendTwilioMessage(chatId, view.text);
}

export async function handleHomeReply(
  chatId: string,
  userId: string,
  text: string,
) {
  const lower = text.trim().toLowerCase();
  const doneMatch = lower.match(/^done\s*(\d+)$/);
  const deleteMatch = lower.match(/^delete\s*(\d+)$/);

  const { tasks } = await loadWeek(userId);
  const { indexMap } = renderHome(tasks, "", "");

  if (doneMatch) {
    const n = Number(doneMatch[1]);
    const item = indexMap.find((x) => x.n === n);
    if (!item) {
      await sendTwilioMessage(chatId, "I don't see that task number. Reply *home* to see the list.");
      return;
    }
    await completeTask(chatId, userId, item.id);
    return;
  }

  if (deleteMatch) {
    const n = Number(deleteMatch[1]);
    const item = indexMap.find((x) => x.n === n);
    if (!item) {
      await sendTwilioMessage(chatId, "I don't see that task number. Reply *home* to see the list.");
      return;
    }
    await deleteTask(chatId, userId, item.id);
    return;
  }

  await sendHome(chatId, userId);
}

export async function completeTask(chatId: string, userId: string, taskId: string) {
  const supabaseAdmin = await getAdmin();
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ is_completed: true })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) {
    console.error("Twilio complete task failed:", error.message);
    await sendTwilioMessage(chatId, "Couldn't update that task.");
    return;
  }
  await sendTwilioMessage(chatId, "Marked as complete ✅\n\nReply *home* to see the updated list.");
}

export async function deleteTask(chatId: string, userId: string, taskId: string) {
  const supabaseAdmin = await getAdmin();
  const { error } = await supabaseAdmin.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
  if (error) {
    console.error("Twilio delete task failed:", error.message);
    await sendTwilioMessage(chatId, "Couldn't delete that task.");
    return;
  }
  await sendTwilioMessage(chatId, "Deleted 🗑\n\nReply *home* to see the updated list.");
}

export { renderReminder };

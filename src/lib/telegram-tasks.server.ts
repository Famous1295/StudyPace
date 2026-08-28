import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
  type InlineKeyboard,
} from "@/lib/telegram.server";

export const TASK_TYPES = ["exam", "assignment", "project", "lab"] as const;
export type BotTaskType = (typeof TASK_TYPES)[number];
const TYPE_WEIGHTS: Record<BotTaskType, number> = { exam: 3, assignment: 2, project: 2, lab: 1 };
const TYPE_LABELS: Record<BotTaskType, string> = {
  exam: "📝 Exam",
  assignment: "📄 Assignment",
  project: "🛠 Project",
  lab: "🔬 Lab",
};

export const ADD_TASK_HINT = "Add a new task right here: send /addtask";

const sessionKey = (chatId: number) => `tg:${chatId}`;

interface Draft {
  title?: string;
  type?: BotTaskType;
  deadline_date?: string;
  est_hours?: number;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

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

/* ---------------- keyboards ---------------- */

const CANCEL_ROW: InlineKeyboard[number] = [{ text: "✖ Cancel", callback_data: "flow:cancel" }];

export function typeKeyboard(): InlineKeyboard {
  return [
    [
      { text: TYPE_LABELS.exam, callback_data: "type:exam" },
      { text: TYPE_LABELS.assignment, callback_data: "type:assignment" },
    ],
    [
      { text: TYPE_LABELS.project, callback_data: "type:project" },
      { text: TYPE_LABELS.lab, callback_data: "type:lab" },
    ],
    CANCEL_ROW,
  ];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function shift(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Inline month calendar: tap a day instead of typing a date. */
export function calendarKeyboard(ym: string): InlineKeyboard {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const todayIso = iso(new Date());

  const rows: InlineKeyboard = [
    [
      { text: "‹", callback_data: `cal:${shift(ym, -1)}` },
      { text: `${MONTHS[m! - 1]} ${y}`, callback_data: "noop" },
      { text: "›", callback_data: `cal:${shift(ym, 1)}` },
    ],
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => ({ text: d, callback_data: "noop" })),
  ];

  let week: InlineKeyboard[number] = [];
  for (let i = 0; i < lead; i++) week.push({ text: " ", callback_data: "noop" });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${ym}-${String(day).padStart(2, "0")}`;
    week.push({ text: date === todayIso ? `·${day}·` : String(day), callback_data: `date:${date}` });
    if (week.length === 7) {
      rows.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push({ text: " ", callback_data: "noop" });
    rows.push(week);
  }

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextWeek = new Date();
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  rows.push([
    { text: "Today", callback_data: `date:${todayIso}` },
    { text: "Tomorrow", callback_data: `date:${iso(tomorrow)}` },
    { text: "+7 days", callback_data: `date:${iso(nextWeek)}` },
  ]);
  rows.push(CANCEL_ROW);
  return rows;
}

export function hoursKeyboard(): InlineKeyboard {
  return [
    [1, 2, 3, 4].map((h) => ({ text: `${h}h`, callback_data: `hours:${h}` })),
    [6, 8, 10, 15].map((h) => ({ text: `${h}h`, callback_data: `hours:${h}` })),
    CANCEL_ROW,
  ];
}

/* ---------------- session storage ---------------- */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function setSession(chatId: number, userId: string, step: string, draft: Draft) {
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

async function clearSession(chatId: number) {
  const supabaseAdmin = await getAdmin();
  await supabaseAdmin.from("chat_sessions").delete().eq("phone", sessionKey(chatId));
}

export async function getSession(chatId: number) {
  const supabaseAdmin = await getAdmin();
  const { data } = await supabaseAdmin
    .from("chat_sessions")
    .select("step, draft, user_id")
    .eq("phone", sessionKey(chatId))
    .maybeSingle();
  return data as { step: string; draft: Draft; user_id: string | null } | null;
}

/* ---------------- flow ---------------- */

export async function startAddTask(chatId: number, userId: string) {
  await setSession(chatId, userId, "task_title", {});
  await sendTelegramMessage(
    chatId,
    "Let's add a task 📝\n\nWhat's the <b>title</b>?",
    [CANCEL_ROW],
  );
}

export async function cancelFlow(chatId: number) {
  await clearSession(chatId);
  await sendTelegramMessage(chatId, "Cancelled. Nothing was saved.\n\nSend /home any time to see this week's tasks.", [
    [{ text: "👉 Add a task now", callback_data: "flow:addtask" }],
    [{ text: "🏠 Home", callback_data: "flow:home" }],
  ]);
}

async function askType(chatId: number, title: string) {
  await sendTelegramMessage(
    chatId,
    `Got it: <b>${esc(title)}</b>\n\nWhat <b>type</b> is it?`,
    typeKeyboard(),
  );
}

async function askDate(chatId: number) {
  await sendTelegramMessage(
    chatId,
    "When is it <b>due</b>? Pick a date 📅",
    calendarKeyboard(currentMonth()),
  );
}

async function askHours(chatId: number, date: string) {
  await sendTelegramMessage(
    chatId,
    `Due <b>${date}</b> ✅\n\nRoughly how many <b>hours</b> of work?`,
    hoursKeyboard(),
  );
}

async function saveTask(chatId: number, userId: string, draft: Draft, hours: number) {
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
    console.error("Telegram add task failed:", error.message);
    await sendTelegramMessage(chatId, "Couldn't save that task. Please try again.", [
      [{ text: "👉 Add a task now", callback_data: "flow:addtask" }],
    ]);
    return;
  }

  await sendTelegramMessage(
    chatId,
    `Saved ✅\n\n<b>${esc(draft.title ?? "")}</b> (${type}) — due ${draft.deadline_date}, ~${Math.round(hours)}h.\n\nIt's now in your Studypace dashboard and counts towards your panic score.\n\nTap 🏠 Home (or send /home) to see this week's tasks.`,
    [
      [{ text: "➕ Add another task", callback_data: "flow:addtask" }],
      [{ text: "🏠 Home", callback_data: "flow:home" }],
    ],
  );
}

/** Handles one text message while an add-task flow is active. */
export async function continueAddTask(
  chatId: number,
  userId: string,
  step: string,
  draft: Draft,
  text: string,
) {
  const value = text.trim();

  if (step === "task_title") {
    if (value.length < 2 || value.length > 120) {
      await sendTelegramMessage(chatId, "Please send a title between 2 and 120 characters.");
      return;
    }
    await setSession(chatId, userId, "task_type", { ...draft, title: value });
    await askType(chatId, value);
    return;
  }

  if (step === "task_type") {
    const type = value.toLowerCase() as BotTaskType;
    if (!TASK_TYPES.includes(type)) {
      await sendTelegramMessage(chatId, "Tap one of the buttons below 👇", typeKeyboard());
      return;
    }
    await setSession(chatId, userId, "task_date", { ...draft, type });
    await askDate(chatId);
    return;
  }

  if (step === "task_date") {
    const date = parseDeadline(value);
    if (!date) {
      await sendTelegramMessage(
        chatId,
        "I couldn't read that date — pick one from the calendar 👇",
        calendarKeyboard(currentMonth()),
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
      await sendTelegramMessage(chatId, "Tap an option or send a number of hours (1–200).", hoursKeyboard());
      return;
    }
    await saveTask(chatId, userId, draft, hours);
    return;
  }

  await clearSession(chatId);
}

/** Handles a tap on any inline button. */
export async function handleCallback(opts: {
  chatId: number;
  userId: string;
  messageId: number;
  callbackId: string;
  data: string;
}) {
  const { chatId, userId, messageId, callbackId, data } = opts;
  await answerCallbackQuery(callbackId);

  if (data === "noop") return;

  if (data === "flow:cancel") {
    await cancelFlow(chatId);
    return;
  }

  if (data === "flow:addtask") {
    await startAddTask(chatId, userId);
    return;
  }

  if (data === "flow:home") {
    await sendHome(chatId, userId);
    return;
  }

  if (data === "flow:disconnect") {
    await sendTelegramMessage(
      chatId,
      "Disconnect this chat from your Studypace account?\n\nYou'll stop getting reminders and will need a <b>new activation code</b> to reconnect.",
      [
        [{ text: "✅ Yes, disconnect", callback_data: "flow:disconnect_yes" }],
        [{ text: "✖ Keep connected", callback_data: "flow:home" }],
      ],
    );
    return;
  }

  if (data === "flow:disconnect_yes") {
    await disconnectFromBot(chatId, userId);
    return;
  }


  if (data.startsWith("done:")) {
    await completeTask(chatId, userId, data.slice(5), messageId);
    return;
  }

  if (data.startsWith("del:")) {
    await deleteTask(chatId, userId, data.slice(4), messageId);
    return;
  }

  if (data.startsWith("cal:")) {
    const ym = data.slice(4);
    await editTelegramMessage(
      chatId,
      messageId,
      "When is it <b>due</b>? Pick a date 📅",
      calendarKeyboard(ym),
    );
    return;
  }

  const session = await getSession(chatId);
  const draft = session?.draft ?? {};

  if (data.startsWith("type:")) {
    const type = data.slice(5) as BotTaskType;
    if (!TASK_TYPES.includes(type)) return;
    await setSession(chatId, userId, "task_date", { ...draft, type });
    await editTelegramMessage(chatId, messageId, `Type: <b>${TYPE_LABELS[type]}</b>`);
    await askDate(chatId);
    return;
  }

  if (data.startsWith("date:")) {
    const date = data.slice(5);
    await setSession(chatId, userId, "task_hours", { ...draft, deadline_date: date });
    await editTelegramMessage(chatId, messageId, `Due date: <b>${date}</b>`);
    await askHours(chatId, date);
    return;
  }

  if (data.startsWith("hours:")) {
    const hours = Number(data.slice(6));
    if (!Number.isFinite(hours) || hours <= 0) return;
    if (!draft.title || !draft.deadline_date) {
      await sendTelegramMessage(chatId, "That task expired — let's start again.", [
        [{ text: "👉 Add a task now", callback_data: "flow:addtask" }],
      ]);
      return;
    }
    await editTelegramMessage(chatId, messageId, `Estimated effort: <b>${hours}h</b>`);
    await saveTask(chatId, userId, draft, hours);
  }
}

/* ---------------- home / weekly view ---------------- */

export const HOME_ROW: InlineKeyboard[number] = [
  { text: "🏠 Home", callback_data: "flow:home" },
];

export const MAIN_MENU: InlineKeyboard = [
  [{ text: "➕ Add task", callback_data: "flow:addtask" }],
  HOME_ROW,
];

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
  const header = `🏠 <b>This week</b>\n${shortDate(start)} – ${shortDate(end)}`;

  if (tasks.length === 0) {
    return {
      text: `${header}\n\n🎉 Nothing due this week. Enjoy the calm!`,
      keyboard: MAIN_MENU,
    };
  }

  const open = tasks.filter((t) => !t.is_completed);
  const hours = open.reduce((sum, t) => sum + (t.est_hours ?? 0), 0);

  const byDay = new Map<string, HomeTask[]>();
  for (const t of tasks) byDay.set(t.deadline_date, [...(byDay.get(t.deadline_date) ?? []), t]);

  const rows: InlineKeyboard = [];
  const blocks: string[] = [];
  let n = 0;

  for (const [date, items] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const lines = items.map((t) => {
      n += 1;
      const icon = TYPE_ICON[t.type] ?? "•";
      const hrs = t.est_hours ? ` · ${t.est_hours}h` : "";
      rows.push(
        t.is_completed
          ? [{ text: `${n}. ✅ done — 🗑 delete`, callback_data: `del:${t.id}` }]
          : [
              { text: `✅ ${n}`, callback_data: `done:${t.id}` },
              { text: `🗑 ${n}`, callback_data: `del:${t.id}` },
            ],
      );
      return t.is_completed
        ? `<s>${n}. ${esc(t.title)}</s> ✅`
        : `${n}. ${icon} <b>${esc(t.title)}</b>${hrs}`;
    });
    blocks.push(`📅 <b>${dayLabel(date)}</b>\n${lines.join("\n")}`);
  }

  const summary = `${open.length} to do · ${tasks.length - open.length} done · ~${hours}h left`;

  rows.push([{ text: "➕ Add task", callback_data: "flow:addtask" }]);
  rows.push([
    { text: "🔄 Refresh", callback_data: "flow:home" },
    { text: "🔌 Disconnect", callback_data: "flow:disconnect" },
  ]);


  return {
    text: `${header}\n<i>${summary}</i>\n\n${blocks.join("\n\n")}\n\nTap ✅ to complete or 🗑 to delete a numbered task.`,
    keyboard: rows,
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

/** Sends the "home" screen: every task due in the current Mon–Sun week. */
export async function sendHome(chatId: number, userId: string, _name?: string | null) {
  await clearSession(chatId);
  const { tasks, error, start, end } = await loadWeek(userId);
  if (error) {
    console.error("Telegram home failed:", error.message);
    await sendTelegramMessage(chatId, "Couldn't load your week. Please try again.", MAIN_MENU);
    return;
  }
  const view = renderHome(tasks, start, end);
  await sendTelegramMessage(chatId, view.text, view.keyboard);
}

/** Redraws the home screen in place after a complete/delete tap. */
export async function refreshHome(chatId: number, userId: string, messageId: number) {
  const { tasks, error, start, end } = await loadWeek(userId);
  if (error) return;
  const view = renderHome(tasks, start, end);
  await editTelegramMessage(chatId, messageId, view.text, view.keyboard);
}

export async function completeTask(chatId: number, userId: string, taskId: string, messageId: number) {
  const supabaseAdmin = await getAdmin();
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ is_completed: true })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) {
    console.error("Telegram complete task failed:", error.message);
    await sendTelegramMessage(chatId, "Couldn't update that task.", MAIN_MENU);
    return;
  }
  await refreshHome(chatId, userId, messageId);
}

export async function deleteTask(chatId: number, userId: string, taskId: string, messageId: number) {
  const supabaseAdmin = await getAdmin();
  const { error } = await supabaseAdmin.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
  if (error) {
    console.error("Telegram delete task failed:", error.message);
    await sendTelegramMessage(chatId, "Couldn't delete that task.", MAIN_MENU);
    return;
  }
  await refreshHome(chatId, userId, messageId);
}

/** Disconnects this chat from the bot and issues a fresh activation code. */
export async function disconnectFromBot(chatId: number, userId: string) {
  await clearSession(chatId);
  const { unlinkTelegramForUser } = await import("@/lib/telegram.server");
  await unlinkTelegramForUser(userId, "bot");
}

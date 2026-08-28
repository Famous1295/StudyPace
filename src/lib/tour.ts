export interface TourStep {
  title: string;
  body: string[];
  route?: string;
  tip?: string;
}

/** Guided walkthrough shown to every new account (and re-runnable from Help). */
export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Studypace 👋",
    body: [
      "Studypace turns your semester into one clear plan: every deadline in one place, plus a weekly Panic Score that tells you how heavy the week ahead really is.",
      "This quick tour takes about a minute. You can stop any time and restart it later from Help → Take the tour.",
    ],
    route: "/dashboard",
  },
  {
    title: "Dashboard — your week at a glance",
    body: [
      "The Panic Score combines how many deadlines you have, how big they are and how close they are.",
      "Green means comfortable, amber means busy, red means act now. Under it you'll find what to tackle first.",
    ],
    route: "/dashboard",
  },
  {
    title: "Tasks — everything you owe",
    body: [
      "Add assignments, labs, quizzes and projects with a subject, due date and effort estimate.",
      "Tick items off as you finish them; completed work instantly lowers your Panic Score.",
    ],
    route: "/tasks",
  },
  {
    title: "Timeline & Planner",
    body: [
      "Timeline shows the whole semester so you can spot crunch weeks before they hit.",
      "Planner asks the AI to spread your workload across free days and builds a realistic study schedule.",
    ],
    route: "/timeline",
  },
  {
    title: "Analytics & Marks",
    body: [
      "Track marks per subject, see predicted totals, and watch how your workload trend moves week to week.",
      "The forecast highlights subjects that need attention before the internals.",
    ],
    route: "/analytics",
  },
  {
    title: "AI assistant",
    body: [
      "Ask anything about your semester — 'what should I do today?', 'summarise this unit', 'plan my week'.",
      "It already knows your subjects, deadlines and marks. You can also plug in your own API key from My profile.",
    ],
    route: "/assistant",
  },
  {
    title: "Group projects & Subjects",
    body: [
      "Group projects let you split work between teammates and track who finished what.",
      "Subjects keeps your syllabus, faculty and credit weights, which is what powers the scoring.",
    ],
    route: "/groups",
  },
  {
    title: "Reminders on Telegram — step 1",
    body: [
      "Telegram reminders are free and instant. Open My profile and scroll to the Telegram card.",
      "You'll see a personal activation code there — copy it.",
    ],
    route: "/profile",
    tip: "My profile → Telegram reminders",
  },
  {
    title: "Telegram — step 2: start the bot",
    body: [
      "In Telegram, search for @Smart_workload_balancer_bot and press Start.",
      "The bot asks for your activation code — paste the code from your profile and send it. The toggle in your profile flips to connected.",
    ],
    route: "/profile",
  },
  {
    title: "Telegram — step 3: use it daily",
    body: [
      "Send /home to see this week's tasks, tap ✅ to complete or 🗑 to delete, and use ➕ Add task to create one with an inline calendar.",
      "Every morning the bot sends the day's deadlines, and Monday brings a weekly email digest.",
    ],
    route: "/profile",
  },
  {
    title: "Help & support",
    body: [
      "Stuck? Use the Help button in the sidebar to raise a query by category — an admin replies and you'll see when it's marked solved.",
      "That's the tour. Add your first task and Studypace starts scoring your week straight away.",
    ],
    route: "/tasks",
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();

/** Manually restart the walkthrough (Help menu / sidebar button). */
export function startTour() {
  listeners.forEach((l) => l());
}

export function onStartTour(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

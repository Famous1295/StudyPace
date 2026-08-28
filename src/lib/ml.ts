/**
 * Lightweight, dependency-free ML helpers.
 *  - forecastPanic: ordinary least-squares linear regression over weekly panic scores.
 *  - detectProcrastination: 1-D k-means (k=3) over "days before deadline a task was completed".
 */
import { classify, parseDate, type PanicStatus, type Task } from "@/lib/panic";

export interface Forecast {
  weekStart: string;
  score: number;
  status: PanicStatus;
  predicted: boolean;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  trend: "rising" | "falling" | "flat";
  forecast: Forecast[];
}

/** Fits y = a + b·x over the observed weeks and projects `ahead` future weeks. */
export function forecastPanic(
  history: { weekStart: string; score: number }[],
  ahead = 3,
): RegressionResult | null {
  const points = history.filter((h) => Number.isFinite(h.score));
  if (points.length < 3) return null;

  const n = points.length;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.score);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0) || 1;
  const sxy = xs.reduce((acc, x, i) => acc + (x - meanX) * ((ys[i] ?? 0) - meanY), 0);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  const ssTot = ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((acc, y, i) => acc + (y - (intercept + slope * i)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  const last = parseDate(points[n - 1]!.weekStart);
  const forecast: Forecast[] = [];
  for (let i = 1; i <= ahead; i++) {
    const d = new Date(last);
    d.setDate(d.getDate() + i * 7);
    const raw = intercept + slope * (n - 1 + i);
    const score = Math.round(Math.max(0, raw) * 100) / 100;
    forecast.push({
      weekStart: `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`,
      score,
      status: classify(score),
      predicted: true,
    });
  }

  return {
    slope: Math.round(slope * 1000) / 1000,
    intercept: Math.round(intercept * 100) / 100,
    r2: Math.round(r2 * 100) / 100,
    trend: slope > 0.15 ? "rising" : slope < -0.15 ? "falling" : "flat",
    forecast,
  };
}

export interface ProcrastinationResult {
  sampleSize: number;
  /** Mean lead time in days across all completed tasks (negative = finished late). */
  averageLead: number;
  clusters: { label: string; centroid: number; count: number }[];
  profile: "planner" | "steady" | "last-minute";
  headline: string;
}

/** Simple 1-D k-means with deterministic quantile seeding. */
function kmeans1d(values: number[], k: number, iterations = 25): number[][] {
  const sorted = [...values].sort((a, b) => a - b);
  let centroids = Array.from(
    { length: k },
    (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) / k) * sorted.length))]!,
  );
  let groups: number[][] = [];
  for (let it = 0; it < iterations; it++) {
    groups = Array.from({ length: k }, () => [] as number[]);
    for (const v of values) {
      let best = 0;
      let bestDist = Infinity;
      centroids.forEach((c, i) => {
        const d = Math.abs(v - c);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      groups[best]!.push(v);
    }
    const next = groups.map((g, i) =>
      g.length ? g.reduce((a, b) => a + b, 0) / g.length : centroids[i]!,
    );
    if (next.every((c, i) => Math.abs(c - centroids[i]!) < 1e-6)) break;
    centroids = next;
  }
  return groups;
}

/**
 * Uses completed tasks: lead time = days between completion (proxied by today for recently
 * completed work is unreliable, so we use created_at → deadline span vs. deadline) —
 * we measure how close to the deadline the task sat before being marked done.
 */
export function detectProcrastination(tasks: Task[]): ProcrastinationResult | null {
  const done = tasks.filter((t) => t.is_completed);
  const leads = done
    .map((t) => {
      const deadline = parseDate(t.deadline_date).getTime();
      const created = new Date(t.created_at).getTime();
      const span = (deadline - created) / 86_400_000;
      return Math.round(span * 10) / 10;
    })
    .filter((v) => Number.isFinite(v));

  if (leads.length < 4) return null;

  const averageLead = Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10;
  const groups = kmeans1d(leads, 3)
    .map((g) => ({
      centroid: g.length ? Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 10) / 10 : 0,
      count: g.length,
    }))
    .sort((a, b) => a.centroid - b.centroid);

  const labels = ["Last-minute", "Steady", "Early planner"];
  const clusters = groups.map((g, i) => ({ ...g, label: labels[i] ?? "Cluster" }));
  const dominant = [...clusters].sort((a, b) => b.count - a.count)[0]!;

  const profile: ProcrastinationResult["profile"] =
    averageLead < 3 ? "last-minute" : averageLead < 8 ? "steady" : "planner";

  const headline =
    profile === "last-minute"
      ? "You usually log work only a couple of days before it's due — add tasks earlier to spread the load."
      : profile === "steady"
        ? "You keep a healthy few days of runway on most tasks."
        : "You plan well ahead — most tasks are logged over a week before the deadline.";

  return {
    sampleSize: leads.length,
    averageLead,
    clusters,
    profile,
    headline: `${headline} Largest group: ${dominant.label} (${dominant.count} task${dominant.count === 1 ? "" : "s"}).`,
  };
}

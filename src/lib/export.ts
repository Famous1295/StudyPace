import { jsPDF } from "jspdf";
import {
  classify,
  daysRemaining,
  STATUS_LABEL,
  upcomingWeeks,
  type Task,
} from "@/lib/panic";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const body = rows.map((row) => headers.map((h) => csvCell(row[h])).join(","));
  download(
    new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}

export function tasksToRows(tasks: Task[], subjectName: (id: string | null | undefined) => string) {
  return tasks.map((t) => ({
    Title: t.title,
    Subject: subjectName(t.subject_id),
    Type: t.type,
    Deadline: t.deadline_date,
    "Days left": daysRemaining(t.deadline_date),
    "Est. hours": t.est_hours,
    Weight: t.weight,
    Status: t.is_completed ? "Completed" : "Pending",
  }));
}

/** Semester workload report: weekly panic scores plus the full task table. */
export function exportTasksPDF(
  tasks: Task[],
  subjectName: (id: string | null | undefined) => string,
  studentName: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  let y = margin;

  doc.setFontSize(18);
  doc.text("Semester Workload Report", margin, y);
  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${studentName} · generated ${new Date().toLocaleDateString()}`, margin, y);
  doc.setTextColor(0);
  y += 26;

  doc.setFontSize(13);
  doc.text("Weekly panic score", margin, y);
  y += 16;
  doc.setFontSize(10);
  for (const week of upcomingWeeks(tasks, 6)) {
    doc.text(
      `Week of ${week.weekStart}   score ${week.score}   ${STATUS_LABEL[classify(week.score)]}   ${week.tasks.length} task(s)`,
      margin,
      y,
    );
    y += 14;
  }

  y += 14;
  doc.setFontSize(13);
  doc.text("Tasks", margin, y);
  y += 16;
  doc.setFontSize(9);

  const cols = [margin, margin + 170, margin + 260, margin + 340, margin + 420, margin + 480];
  const header = ["Title", "Subject", "Type", "Deadline", "Hours", "Status"];
  header.forEach((h, i) => doc.text(h, cols[i]!, y));
  y += 12;
  doc.setDrawColor(200);
  doc.line(margin, y - 8, 551, y - 8);

  for (const t of tasks) {
    if (y > 780) {
      doc.addPage();
      y = margin;
    }
    const row = [
      doc.splitTextToSize(t.title, 160)[0] ?? t.title,
      doc.splitTextToSize(subjectName(t.subject_id), 80)[0] ?? "",
      t.type,
      t.deadline_date,
      String(t.est_hours),
      t.is_completed ? "Done" : "Pending",
    ];
    row.forEach((cell, i) => doc.text(String(cell), cols[i]!, y));
    y += 14;
  }

  doc.save("semester-workload-report.pdf");
}

export function exportPlanPDF(
  title: string,
  subtitle: string,
  days: { date: string; focus: string; hours: number }[],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  let y = margin;
  doc.setFontSize(18);
  doc.text(title, margin, y);
  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(subtitle, margin, y);
  doc.setTextColor(0);
  y += 26;

  for (const day of days) {
    if (y > 780) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.text(`${day.date} · ${day.hours}h`, margin, y);
    y += 14;
    doc.setFontSize(10);
    for (const line of doc.splitTextToSize(day.focus, 500)) {
      doc.text(line, margin + 12, y);
      y += 13;
    }
    y += 6;
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

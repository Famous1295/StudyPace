import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminUsers, useSubjects } from "@/lib/admin";
import { useAllFacultyAssignments, useFacultyAssignmentMutations } from "@/lib/faculty";

export const Route = createFileRoute("/_authenticated/admin/faculty")({
  head: () => ({
    meta: [
      { title: "Faculty assignments — Admin console" },
      {
        name: "description",
        content:
          "Assign faculty members to subjects so they can publish deadlines and see class analytics.",
      },
      { property: "og:title", content: "Faculty assignments — Admin console" },
      { property: "og:description", content: "Assign faculty members to subjects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminFacultyPage,
});

function AdminFacultyPage() {
  const { data: users = [] } = useAdminUsers();
  const { data: subjects = [] } = useSubjects();
  const { data: assignments = [], isLoading } = useAllFacultyAssignments();
  const { assign, unassign } = useFacultyAssignmentMutations();
  const [facultyId, setFacultyId] = useState("");
  const [semester, setSemester] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const faculty = users.filter((u) => u.role === "faculty");
  const userById = new Map(users.map((u) => [u.id, u]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const semesters = Array.from(
    new Set(subjects.map((s) => s.semester).filter((s): s is number => s != null)),
  ).sort((a, b) => a - b);
  const visibleSubjects = semester
    ? subjects.filter((s) => String(s.semester) === semester)
    : [];
  const facultyIds = Array.from(new Set(assignments.map((a) => a.faculty_id)));

  async function add() {
    if (!facultyId || !subjectId) {
      toast.error("Pick a faculty member, a semester and a subject.");
      return;
    }
    try {
      await assign.mutateAsync({
        faculty_id: facultyId,
        subject_id: subjectId,
        label: `${userById.get(facultyId)?.email ?? facultyId} → ${subjectById.get(subjectId)?.name ?? subjectId}`,
      });
      toast.success("Subject assigned.");
      setSubjectId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign the subject.");
    }
  }

  return (
    <AdminShell title="Faculty assignments">
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        A faculty member only sees anonymised class analytics and can only publish deadlines and
        announcements for the subjects assigned here.
      </p>

      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1.2fr_0.8fr_1.2fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="faculty">Faculty member</Label>
          <Select value={facultyId} onValueChange={setFacultyId}>
            <SelectTrigger id="faculty">
              <SelectValue placeholder={faculty.length ? "Select faculty" : "No faculty accounts"} />
            </SelectTrigger>
            <SelectContent>
              {faculty.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.full_name ?? f.email ?? f.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="semester">Semester</Label>
          <Select
            value={semester}
            onValueChange={(v) => {
              setSemester(v);
              setSubjectId("");
            }}
          >
            <SelectTrigger id="semester">
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              {semesters.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  Semester {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Select value={subjectId} onValueChange={setSubjectId} disabled={!semester}>
            <SelectTrigger id="subject">
              <SelectValue
                placeholder={
                  !semester
                    ? "Choose a semester first"
                    : visibleSubjects.length
                      ? "Select subject"
                      : "No subjects in this semester"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {visibleSubjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.code}){s.semester ? ` · Sem ${s.semester}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} disabled={assign.isPending}>
          {assign.isPending ? "Assigning…" : "Assign"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        A faculty member can teach across several semesters — pick the semester, then its subject,
        and repeat for each semester they teach.
      </p>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
          Current assignments
        </h2>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing assigned yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {facultyIds.map((fid) => {
              const mine = assignments.filter((a) => a.faculty_id === fid);
              const sems = Array.from(
                new Set(
                  mine
                    .map((a) => subjectById.get(a.subject_id)?.semester)
                    .filter((s): s is number => s != null),
                ),
              ).sort((a, b) => a - b);
              return (
                <li key={fid} className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {userById.get(fid)?.full_name ?? userById.get(fid)?.email ?? fid}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {sems.length
                        ? `Semester ${sems.join(", ")}`
                        : "No semester set on these subjects"}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {mine.map((a) => {
                      const s = subjectById.get(a.subject_id);
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-4 rounded-md bg-muted/50 px-3 py-2 text-sm"
                        >
                          <span>
                            {s?.name ?? a.subject_id}
                            <span className="text-muted-foreground">
                              {s?.code ? ` (${s.code})` : ""}
                              {s?.semester ? ` · Sem ${s.semester}` : ""}
                            </span>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unassign.mutate({ id: a.id })}
                            disabled={unassign.isPending}
                          >
                            Remove
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

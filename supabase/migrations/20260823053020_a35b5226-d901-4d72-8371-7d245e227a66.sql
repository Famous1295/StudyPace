
-- helper: is the caller a read-only guest?
CREATE OR REPLACE FUNCTION public.is_guest(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'guest')
$$;
REVOKE EXECUTE ON FUNCTION public.is_guest(uuid) FROM PUBLIC, anon;

-- faculty <-> subject assignment
CREATE TABLE public.faculty_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faculty_subjects TO authenticated;
GRANT ALL ON public.faculty_subjects TO service_role;
ALTER TABLE public.faculty_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage faculty subjects" ON public.faculty_subjects FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Faculty read own assignments" ON public.faculty_subjects FOR SELECT TO authenticated
  USING (faculty_id = auth.uid());

CREATE OR REPLACE FUNCTION public.teaches_subject(_user_id uuid, _subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.faculty_subjects f WHERE f.faculty_id = _user_id AND f.subject_id = _subject_id)
$$;
REVOKE EXECUTE ON FUNCTION public.teaches_subject(uuid, uuid) FROM PUBLIC, anon;

-- can a student see a given master subject (same branch + semester)?
CREATE OR REPLACE FUNCTION public.subject_in_my_class(_subject_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subjects s
    JOIN public.profiles p ON p.id = _user_id
    WHERE s.id = _subject_id
      AND (s.branch_id IS NULL OR s.branch_id = p.branch_id)
      AND (s.semester IS NULL OR s.semester = p.semester)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.subject_in_my_class(uuid, uuid) FROM PUBLIC, anon;

-- faculty-set subject deadlines
CREATE TABLE public.subject_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'assignment',
  deadline_date date NOT NULL,
  est_hours integer NOT NULL DEFAULT 2,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_deadlines TO authenticated;
GRANT ALL ON public.subject_deadlines TO service_role;
ALTER TABLE public.subject_deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Faculty manage own subject deadlines" ON public.subject_deadlines FOR ALL TO authenticated
  USING (teaches_subject(auth.uid(), subject_id))
  WITH CHECK (teaches_subject(auth.uid(), subject_id) AND created_by = auth.uid());
CREATE POLICY "Admins read subject deadlines" ON public.subject_deadlines FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Students read class deadlines" ON public.subject_deadlines FOR SELECT TO authenticated
  USING (subject_in_my_class(subject_id, auth.uid()));

-- faculty announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Faculty manage own announcements" ON public.announcements FOR ALL TO authenticated
  USING (teaches_subject(auth.uid(), subject_id))
  WITH CHECK (teaches_subject(auth.uid(), subject_id) AND created_by = auth.uid());
CREATE POLICY "Admins read announcements" ON public.announcements FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Students read class announcements" ON public.announcements FOR SELECT TO authenticated
  USING (subject_in_my_class(subject_id, auth.uid()));

-- anonymised class-wide analytics for faculty/admin
CREATE OR REPLACE FUNCTION public.class_workload_overview()
RETURNS TABLE (
  branch_id uuid,
  branch_name text,
  semester integer,
  student_count bigint,
  avg_panic numeric,
  overloaded_students bigint,
  total_tasks bigint,
  completed_tasks bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'faculty') OR has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH scope AS (
    SELECT DISTINCT s.branch_id AS b_id, s.semester AS sem
    FROM public.subjects s
    WHERE has_role(auth.uid(),'admin')
       OR EXISTS (SELECT 1 FROM public.faculty_subjects f
                  WHERE f.faculty_id = auth.uid() AND f.subject_id = s.id)
  ),
  latest AS (
    SELECT DISTINCT ON (ps.user_id) ps.user_id, ps.score
    FROM public.panic_scores ps
    ORDER BY ps.user_id, ps.week_start_date DESC
  )
  SELECT
    p.branch_id,
    b.name,
    p.semester,
    count(DISTINCT p.id),
    round(coalesce(avg(l.score), 0)::numeric, 2),
    count(DISTINCT p.id) FILTER (WHERE l.score >= 15),
    coalesce(sum(t.total), 0),
    coalesce(sum(t.done), 0)
  FROM public.profiles p
  JOIN scope sc ON (sc.b_id IS NULL OR sc.b_id = p.branch_id)
                AND (sc.sem IS NULL OR sc.sem = p.semester)
  LEFT JOIN public.branches b ON b.id = p.branch_id
  LEFT JOIN latest l ON l.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS total, count(*) FILTER (WHERE tk.is_completed) AS done
    FROM public.tasks tk WHERE tk.user_id = p.id
  ) t ON true
  WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'student')
  GROUP BY p.branch_id, b.name, p.semester
  ORDER BY b.name NULLS LAST, p.semester;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.class_workload_overview() FROM PUBLIC, anon;

-- guest read-only enforcement
DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
CREATE POLICY "Users read own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users write own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid())) WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid()));

DROP POLICY IF EXISTS "Users manage own marks" ON public.marks;
CREATE POLICY "Users read own marks" ON public.marks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users write own marks" ON public.marks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users update own marks" ON public.marks FOR UPDATE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid())) WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users delete own marks" ON public.marks FOR DELETE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid()));

DROP POLICY IF EXISTS "Users manage own study plans" ON public.study_plans;
CREATE POLICY "Users read own study plans" ON public.study_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users write own study plans" ON public.study_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users update own study plans" ON public.study_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid())) WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users delete own study plans" ON public.study_plans FOR DELETE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid()));

DROP POLICY IF EXISTS "Users create own projects" ON public.group_projects;
CREATE POLICY "Users create own projects" ON public.group_projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND NOT is_guest(auth.uid()));

DROP POLICY IF EXISTS "Users manage own subjects" ON public.student_subjects;
CREATE POLICY "Users read own subjects" ON public.student_subjects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users write own subjects" ON public.student_subjects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users update own subjects" ON public.student_subjects FOR UPDATE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid())) WITH CHECK (auth.uid() = user_id AND NOT is_guest(auth.uid()));
CREATE POLICY "Users delete own subjects" ON public.student_subjects FOR DELETE TO authenticated USING (auth.uid() = user_id AND NOT is_guest(auth.uid()));

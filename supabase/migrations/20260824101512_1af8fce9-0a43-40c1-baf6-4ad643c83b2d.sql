CREATE OR REPLACE FUNCTION public.faculty_subject_tasks()
RETURNS TABLE(
  source text,
  subject_id uuid,
  subject_name text,
  subject_code text,
  semester integer,
  title text,
  type text,
  deadline_date date,
  est_hours numeric,
  is_completed boolean,
  student_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(),'faculty') OR has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH my_subjects AS (
    SELECT s.id, s.name, s.code, s.semester, s.branch_id
    FROM public.subjects s
    WHERE has_role(auth.uid(),'admin')
       OR EXISTS (SELECT 1 FROM public.faculty_subjects f
                  WHERE f.faculty_id = auth.uid() AND f.subject_id = s.id)
  )
  SELECT 'student'::text,
         ms.id, ms.name, ms.code, ms.semester,
         t.title, t.type, t.deadline_date, t.est_hours::numeric, t.is_completed,
         coalesce(p.full_name, 'Student')::text,
         t.created_at
  FROM public.tasks t
  JOIN public.student_subjects ss ON ss.id = t.subject_id
  JOIN my_subjects ms ON lower(btrim(ms.name)) = lower(btrim(ss.name))
  JOIN public.profiles p ON p.id = t.user_id
  WHERE (ms.branch_id IS NULL OR p.branch_id IS NULL OR ms.branch_id = p.branch_id)
    AND (ms.semester IS NULL OR p.semester IS NULL OR ms.semester = p.semester)

  UNION ALL

  SELECT 'faculty'::text,
         ms.id, ms.name, ms.code, ms.semester,
         d.title, d.type, d.deadline_date, d.est_hours::numeric, false,
         NULL::text,
         d.created_at
  FROM public.subject_deadlines d
  JOIN my_subjects ms ON ms.id = d.subject_id
  ORDER BY 8 ASC, 6 ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.faculty_subject_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faculty_subject_tasks() TO authenticated;
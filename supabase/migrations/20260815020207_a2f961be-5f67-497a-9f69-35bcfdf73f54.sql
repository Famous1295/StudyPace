-- Student-owned subject list
CREATE TABLE public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_subjects TO authenticated;
GRANT ALL ON public.student_subjects TO service_role;

ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subjects" ON public.student_subjects
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all student subjects" ON public.student_subjects
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_student_subjects_updated_at
  BEFORE UPDATE ON public.student_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX student_subjects_user_id_idx ON public.student_subjects(user_id);

-- Link tasks to a student subject (unlinks automatically if the subject is deleted)
ALTER TABLE public.tasks
  ADD COLUMN subject_id uuid REFERENCES public.student_subjects(id) ON DELETE SET NULL;

CREATE INDEX tasks_subject_id_idx ON public.tasks(subject_id);

-- Public signup must never grant faculty/admin: force the student role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _branch text := NEW.raw_user_meta_data ->> 'branch';
  _branch_id uuid;
begin
  select id into _branch_id from public.branches
  where name = _branch or id::text = _branch limit 1;

  insert into public.profiles (id, full_name, semester, branch, branch_id, email)
  values (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    nullif(NEW.raw_user_meta_data ->> 'semester','')::int,
    coalesce((select name from public.branches where id = _branch_id), _branch),
    _branch_id,
    NEW.email
  )
  on conflict (id) do nothing;

  -- Self-serve signups are always students; elevated roles are granted by an admin.
  insert into public.user_roles (user_id, role)
  values (NEW.id, 'student')
  on conflict do nothing;

  return NEW;
end;
$function$;
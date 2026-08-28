begin;
-- ===== supabase/migrations/20260811163135_ba9826e6-b076-4d84-95b6-de1d78e12fe5.sql =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  semester int,
  branch text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('exam','assignment','lab','project')),
  weight int NOT NULL,
  deadline_date date NOT NULL,
  est_hours int NOT NULL DEFAULT 2,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tasks_user_deadline_idx ON public.tasks (user_id, deadline_date);

CREATE TABLE public.panic_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  score numeric(5,2) NOT NULL DEFAULT 0,
  status text CHECK (status IN ('safe','busy','overloaded')),
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.panic_scores TO authenticated;
GRANT ALL ON public.panic_scores TO service_role;
ALTER TABLE public.panic_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scores" ON public.panic_scores FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, semester, branch)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NULLIF(NEW.raw_user_meta_data ->> 'semester','')::int,
    NEW.raw_user_meta_data ->> 'branch'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- ===== supabase/migrations/20260811163149_8ec8deb4-a6d2-441d-8634-7fd9cc3eddd9.sql =====
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- ===== supabase/migrations/20260812104204_18211bc8-996b-45ed-86b5-fd34212e13ea.sql =====
-- ROLES
create type public.app_role as enum ('admin','faculty','student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create policy "Users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- BRANCHES
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.branches to anon;
grant select, insert, update, delete on public.branches to authenticated;
grant all on public.branches to service_role;
alter table public.branches enable row level security;
create policy "Anyone can view active branches" on public.branches
  for select to anon, authenticated using (is_active or public.has_role(auth.uid(),'admin'));
create policy "Admins manage branches" on public.branches
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.branches (name, code) values
  ('Computer Engineering','CE'),
  ('Computer Science','CS'),
  ('Information Technology','IT');

-- SEMESTER SETTINGS
create table public.semester_settings (
  semester int primary key check (semester between 1 and 8),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select on public.semester_settings to anon;
grant select, insert, update, delete on public.semester_settings to authenticated;
grant all on public.semester_settings to service_role;
alter table public.semester_settings enable row level security;
create policy "Anyone can view semesters" on public.semester_settings
  for select to anon, authenticated using (true);
create policy "Admins manage semesters" on public.semester_settings
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.semester_settings (semester) select generate_series(1,8);

-- PROFILES additions
alter table public.profiles
  add column if not exists email text,
  add column if not exists status text not null default 'active' check (status in ('active','suspended')),
  add column if not exists branch_id uuid references public.branches(id);

update public.profiles p set branch_id = b.id from public.branches b where p.branch = b.name and p.branch_id is null;

create policy "Admins read all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins update all profiles" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- SUBJECTS master list
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  branch_id uuid references public.branches(id) on delete set null,
  semester int check (semester between 1 and 8),
  created_at timestamptz not null default now(),
  unique (code)
);
grant select, insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "Signed in users read subjects" on public.subjects
  for select to authenticated using (true);
create policy "Admins manage subjects" on public.subjects
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- NOTIFICATION SETTINGS (singleton)
create table public.notification_settings (
  id boolean primary key default true check (id),
  whatsapp_enabled boolean not null default false,
  email_digest_enabled boolean not null default true,
  daily_reminder_time time not null default '08:00',
  weekly_digest_day int not null default 0 check (weekly_digest_day between 0 and 6),
  weekly_digest_time time not null default '18:00',
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_settings to authenticated;
grant all on public.notification_settings to service_role;
alter table public.notification_settings enable row level security;
create policy "Signed in users read notification settings" on public.notification_settings
  for select to authenticated using (true);
create policy "Admins manage notification settings" on public.notification_settings
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
insert into public.notification_settings (id) values (true);

-- AUDIT LOG
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  admin_name text,
  action_type text not null,
  target text,
  details text,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "Admins read audit log" on public.audit_log
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins write audit log" on public.audit_log
  for insert to authenticated with check (public.has_role(auth.uid(),'admin') and admin_id = auth.uid());

-- New user trigger: capture email, branch_id, default student role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

  insert into public.user_roles (user_id, role)
  values (NEW.id, coalesce(nullif(NEW.raw_user_meta_data ->> 'role','')::public.app_role, 'student'))
  on conflict do nothing;

  return NEW;
end;
$$;

update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
insert into public.user_roles (user_id, role)
select id, 'student' from auth.users on conflict do nothing;
-- ===== supabase/migrations/20260812104223_d37442b6-f536-4c1c-b633-df5a59a65cdd.sql =====
revoke all on function public.handle_new_user() from public, anon, authenticated;
-- ===== supabase/migrations/20260812104249_97deb7dd-3b05-40ae-a46d-c9285cb4fd65.sql =====
drop policy "Anyone can view active branches" on public.branches;
create policy "Visitors view active branches" on public.branches
  for select to anon using (is_active);
create policy "Users view branches" on public.branches
  for select to authenticated using (is_active or public.has_role(auth.uid(),'admin'));
revoke all on function public.has_role(uuid, public.app_role) from anon;
-- ===== supabase/migrations/20260812104317_74099687-886b-4dac-a792-9f722f9cdb78.sql =====
create policy "Admins read all tasks" on public.tasks
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins read all panic scores" on public.panic_scores
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
-- ===== supabase/migrations/20260815020207_a2f961be-5f67-497a-9f69-35bcfdf73f54.sql =====
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
-- ===== supabase/migrations/20260815020229_03d5bf89-dbea-4ec8-9b34-44db3720194c.sql =====
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- ===== supabase/migrations/20260818093519_59b699e1-0373-4995-85cc-1d1b83a6d9c4.sql =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'sent',
  detail text,
  sent_for_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, channel, sent_for_date)
);

GRANT SELECT ON public.reminder_log TO authenticated;
GRANT ALL ON public.reminder_log TO service_role;

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reminders"
  ON public.reminder_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all reminders"
  ON public.reminder_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

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

  insert into public.profiles (id, full_name, semester, branch, branch_id, email, phone)
  values (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    nullif(NEW.raw_user_meta_data ->> 'semester','')::int,
    coalesce((select name from public.branches where id = _branch_id), _branch),
    _branch_id,
    NEW.email,
    nullif(NEW.raw_user_meta_data ->> 'phone','')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (NEW.id, 'student')
  on conflict do nothing;

  return NEW;
end;
$function$;
-- ===== supabase/migrations/20260823042916_987798b7-c462-4a3f-a0ff-bbade4b3cb81.sql =====
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ===== supabase/migrations/20260823043004_7c627994-3ae6-4f74-a16a-6a903fb2b220.sql =====
-- intentionally empty: contents were a duplicate of 20260812104204, 20260812104249 and 20260812104317
select 1;

-- ===== supabase/migrations/20260823043044_00874b2d-ae96-4204-a3b2-b66c97c72c52.sql =====
-- Consolidated security hardening + phone capture on signup.
-- (student_subjects, reminder_log and the profiles phone columns are created
--  in earlier migrations; this file keeps only the final function versions.)

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

  insert into public.profiles (id, full_name, semester, branch, branch_id, email, phone)
  values (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    nullif(NEW.raw_user_meta_data ->> 'semester','')::int,
    coalesce((select name from public.branches where id = _branch_id), _branch),
    _branch_id,
    NEW.email,
    nullif(NEW.raw_user_meta_data ->> 'phone','')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (NEW.id, 'student')
  on conflict do nothing;

  return NEW;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ===== supabase/migrations/20260823043226_243bf729-e908-4289-94c1-d4277e6057bc.sql =====
-- MARKS
CREATE TABLE public.marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.student_subjects(id) ON DELETE SET NULL,
  subject_name text NOT NULL,
  exam_name text NOT NULL,
  score numeric(6,2) NOT NULL,
  max_score numeric(6,2) NOT NULL DEFAULT 100,
  exam_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marks TO authenticated;
GRANT ALL ON public.marks TO service_role;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own marks" ON public.marks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all marks" ON public.marks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX marks_user_idx ON public.marks(user_id, exam_date);

-- STUDY PLANS
CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject_name text,
  exam_date date,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT ALL ON public.study_plans TO service_role;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study plans" ON public.study_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- AI CHATS
CREATE TABLE public.ai_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('assignment','doubt','exam')),
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_chats TO authenticated;
GRANT ALL ON public.ai_chats TO service_role;
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ai chats" ON public.ai_chats FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WHATSAPP CHAT SESSIONS (server-side only)
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  step text NOT NULL DEFAULT 'idle',
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_sessions TO service_role;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own chat session" ON public.chat_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT ON public.chat_sessions TO authenticated;

-- GROUP PROJECTS
CREATE TABLE public.group_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  deadline_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.group_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, display_name)
);

CREATE OR REPLACE FUNCTION public.is_group_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_projects p WHERE p.id = _project_id AND p.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.group_members m WHERE m.project_id = _project_id AND m.user_id = _user_id
  )
$$;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;

CREATE TABLE public.group_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.group_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid REFERENCES public.group_members(id) ON DELETE SET NULL,
  est_hours numeric(5,1) NOT NULL DEFAULT 2,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_items TO authenticated;
GRANT ALL ON public.group_projects TO service_role;
GRANT ALL ON public.group_members TO service_role;
GRANT ALL ON public.group_items TO service_role;

ALTER TABLE public.group_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view projects" ON public.group_projects FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "Users create own projects" ON public.group_projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update projects" ON public.group_projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete projects" ON public.group_projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Members view members" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(project_id, auth.uid()));
CREATE POLICY "Owners manage members" ON public.group_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.group_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Members manage items" ON public.group_items FOR ALL TO authenticated
  USING (public.is_group_member(project_id, auth.uid()))
  WITH CHECK (public.is_group_member(project_id, auth.uid()));

CREATE INDEX group_members_project_idx ON public.group_members(project_id);
CREATE INDEX group_items_project_idx ON public.group_items(project_id);
-- ===== supabase/migrations/20260823052915_6737d281-223f-405e-8f7e-a2709d610209.sql =====
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guest';
-- ===== supabase/migrations/20260823053020_a35b5226-d901-4d72-8371-7d245e227a66.sql =====

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

-- ===== supabase/migrations/20260823104701_9f9ebd12-4ae6-4604-8612-838d96932ba7.sql =====

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_email_opt_in boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.user_ai_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_keys TO authenticated;
GRANT ALL ON public.user_ai_keys TO service_role;
ALTER TABLE public.user_ai_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own AI key" ON public.user_ai_keys;
CREATE POLICY "Users manage their own AI key" ON public.user_ai_keys
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND NOT public.is_guest(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND NOT public.is_guest(auth.uid()));

CREATE TABLE IF NOT EXISTS public.weekly_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT ON public.weekly_digest_log TO authenticated;
GRANT ALL ON public.weekly_digest_log TO service_role;
ALTER TABLE public.weekly_digest_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their own digest log" ON public.weekly_digest_log;
CREATE POLICY "Users read their own digest log" ON public.weekly_digest_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ===== supabase/migrations/20260823114619_593531a2-7c37-4b90-be01-c713154a7cad.sql =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_link_code text;

UPDATE public.profiles SET telegram_link_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE telegram_link_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN telegram_link_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_link_code_key ON public.profiles (telegram_link_code);
-- ===== supabase/migrations/20260823114828_e38cfdfd-108e-4b9b-a215-8719ce50ba48.sql =====
do $cron_guard$
begin
  if to_regnamespace('cron') is not null then
    execute 'select cron.unschedule(jobid) from cron.job where jobname = ''daily-telegram-reminders''';
    execute $schedule$
      select cron.schedule(
        'daily-telegram-reminders',
        '0 8 * * *',
        $job$
        select net.http_post(
          url := 'https://project--470a09f8-9f40-4ad3-8083-f2e9b683f2cf-dev.lovable.app/api/public/hooks/telegram-reminders',
          headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_r6vrfv-LNgrYB6G3ZXY0Og_aZZv0LNs'),
          body := '{}'::jsonb
        );
        $job$
      )
    $schedule$;
  else
    raise notice 'Skipping daily-telegram-reminders: pg_cron is not enabled';
  end if;
end $cron_guard$;
-- ===== supabase/migrations/20260823144140_fe00f131-f346-4e6c-9101-37188fc638e8.sql =====
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  topic text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_guest(auth.uid()));

CREATE POLICY "Admins update tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own tickets"
ON public.support_tickets FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_support_tickets_user ON public.support_tickets (user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets (status, created_at DESC);

CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ===== supabase/migrations/20260824090749_6a5dc0a3-d116-4290-8fa5-0caaa12d0d4b.sql =====
-- 1. notification_settings: admin-only reads
DROP POLICY IF EXISTS "Signed in users read notification settings" ON public.notification_settings;

-- 2. semester_settings: remove anonymous read access
DROP POLICY IF EXISTS "Anyone can view semesters" ON public.semester_settings;
CREATE POLICY "Signed in users view semesters"
  ON public.semester_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.semester_settings FROM anon;

-- 3. group_members: explicit owner-only insert rule
DROP POLICY IF EXISTS "Owners add members" ON public.group_members;
CREATE POLICY "Owners add members"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_projects p
    WHERE p.id = group_members.project_id AND p.owner_id = auth.uid()
  ));
REVOKE ALL ON public.group_members FROM anon;

-- 4. Harden SECURITY DEFINER helpers so callers can only ask about themselves
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select (auth.uid() is null or _user_id = auth.uid())
     and exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_guest(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select (auth.uid() is null or _user_id = auth.uid())
     and exists (select 1 from public.user_roles where user_id = _user_id and role = 'guest')
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select (auth.uid() is null or _user_id = auth.uid())
     and (exists (select 1 from public.group_projects p where p.id = _project_id and p.owner_id = _user_id)
       or exists (select 1 from public.group_members m where m.project_id = _project_id and m.user_id = _user_id))
$$;

CREATE OR REPLACE FUNCTION public.teaches_subject(_user_id uuid, _subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select (auth.uid() is null or _user_id = auth.uid())
     and exists (select 1 from public.faculty_subjects f where f.faculty_id = _user_id and f.subject_id = _subject_id)
$$;

CREATE OR REPLACE FUNCTION public.subject_in_my_class(_subject_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select (auth.uid() is null or _user_id = auth.uid())
     and exists (
       select 1 from public.subjects s
       join public.profiles p on p.id = _user_id
       where s.id = _subject_id
         and (s.branch_id is null or s.branch_id = p.branch_id)
         and (s.semester is null or s.semester = p.semester)
     )
$$;

-- 5. Remove execute access from roles that must not call definer helpers directly
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_guest(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.teaches_subject(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.subject_in_my_class(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.class_workload_overview() FROM anon, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_guest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teaches_subject(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subject_in_my_class(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.class_workload_overview() TO authenticated, service_role;
-- ===== supabase/migrations/20260824101512_1af8fce9-0a43-40c1-baf6-4ad643c83b2d.sql =====
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
-- ===== supabase/migrations/20260824102548_0d9da70e-d1c3-4744-a776-74aa9a60803f.sql =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twilio_chat_id text,
  ADD COLUMN IF NOT EXISTS twilio_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_link_code text;

UPDATE public.profiles SET twilio_link_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE twilio_link_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN twilio_link_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_twilio_link_code_key ON public.profiles (twilio_link_code);
-- ===== supabase/migrations/20260824102651_cddef9d9-83c7-463a-9ee7-1e626434b962.sql =====
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS twilio_whatsapp_from text;

COMMENT ON COLUMN public.notification_settings.twilio_whatsapp_from IS 'Twilio WhatsApp sender number, e.g. whatsapp:+14155238886';
-- ===== supabase/migrations/20260824103628_cc30ac05-02e6-4fdf-a0b7-06870ed604f0.sql =====
do $cron_guard$
begin
  if to_regnamespace('cron') is not null then
    execute 'select cron.unschedule(jobid) from cron.job where jobname = ''daily-twilio-reminders''';
    execute $schedule$
      select cron.schedule(
        'daily-twilio-reminders',
        '0 8 * * *',
        $job$
        select net.http_post(
          url := 'https://project--470a09f8-9f40-4ad3-8083-f2e9b683f2cf-dev.lovable.app/api/public/hooks/twilio-reminders',
          headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_r6vrfv-LNgrYB6G3ZXY0Og_aZZv0LNs'),
          body := '{}'::jsonb
        );
        $job$
      )
    $schedule$;
  else
    raise notice 'Skipping daily-twilio-reminders: pg_cron is not enabled';
  end if;
end $cron_guard$;
-- ===== supabase/migrations/20260824121050_d85f2e51-aee1-43f6-873a-bad7def0d8f8.sql =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aisensy_chat_id text,
  ADD COLUMN IF NOT EXISTS aisensy_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aisensy_link_code text;

UPDATE public.profiles SET aisensy_link_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE aisensy_link_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN aisensy_link_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_aisensy_link_code_key ON public.profiles (aisensy_link_code);

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS aisensy_api_key text,
  ADD COLUMN IF NOT EXISTS aisensy_campaign_name text;
-- ===== supabase/migrations/20260824121134_020b4b61-2178-4986-92ca-c975824b5a1a.sql =====
do $cron_guard$
begin
  if to_regnamespace('cron') is not null then
    execute 'select cron.unschedule(jobid) from cron.job where jobname = ''daily-aisensy-reminders''';
    execute $schedule$
      select cron.schedule(
        'daily-aisensy-reminders',
        '0 8 * * *',
        $job$
        select net.http_post(
          url := 'https://project--470a09f8-9f40-4ad3-8083-f2e9b683f2cf-dev.lovable.app/api/public/hooks/aisensy-reminders',
          headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_r6vrfv-LNgrYB6G3ZXY0Og_aZZv0LNs'),
          body := '{}'::jsonb
        );
        $job$
      )
    $schedule$;
  else
    raise notice 'Skipping daily-aisensy-reminders: pg_cron is not enabled';
  end if;
end $cron_guard$;
-- ===== supabase/migrations/20260824124616_dde3fc23-4c58-42a4-8359-ad5ef20ed36b.sql =====

alter table public.profiles
  add column if not exists username text,
  add column if not exists tour_completed_at timestamptz;

-- backfill from email local part, deduped
with base as (
  select id,
         regexp_replace(lower(split_part(coalesce(email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g') as raw
  from public.profiles
  where username is null
), norm as (
  select id, case when length(raw) >= 3 then raw else raw || 'user' end as raw from base
), numbered as (
  select id, raw, row_number() over (partition by raw order by id) as rn from norm
)
update public.profiles p
set username = case when n.rn = 1 then n.raw else n.raw || n.rn::text end
from numbered n
where p.id = n.id;

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

create or replace function public.username_available(_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _username ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(_username));
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.resolve_login_email(_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when position('@' in _identifier) > 0 then _identifier
    else (select email from public.profiles where lower(username) = lower(_identifier) limit 1)
  end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _branch text := NEW.raw_user_meta_data ->> 'branch';
  _branch_id uuid;
  _username text := nullif(lower(NEW.raw_user_meta_data ->> 'username'), '');
begin
  select id into _branch_id from public.branches
  where name = _branch or id::text = _branch limit 1;

  if _username is null or exists (select 1 from public.profiles where lower(username) = _username) then
    _username := regexp_replace(lower(split_part(coalesce(NEW.email,'user'), '@', 1)), '[^a-z0-9_]', '', 'g');
    if length(_username) < 3 then _username := _username || 'user'; end if;
    while exists (select 1 from public.profiles where lower(username) = _username) loop
      _username := _username || floor(random() * 10)::int::text;
    end loop;
  end if;

  insert into public.profiles (id, full_name, semester, branch, branch_id, email, phone, username)
  values (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    nullif(NEW.raw_user_meta_data ->> 'semester','')::int,
    coalesce((select name from public.branches where id = _branch_id), _branch),
    _branch_id,
    NEW.email,
    nullif(NEW.raw_user_meta_data ->> 'phone',''),
    _username
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (NEW.id, 'student')
  on conflict do nothing;

  return NEW;
end;
$$;

-- ===== supabase/migrations/20260824131149_09dee9dc-d77b-471d-b3eb-169ac3269932.sql =====
DO $$
DECLARE r RECORD; base text; candidate text; i int;
BEGIN
  FOR r IN SELECT id, email FROM public.profiles WHERE username IS NULL OR btrim(username) = '' LOOP
    base := regexp_replace(lower(split_part(coalesce(r.email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g');
    IF length(base) < 3 THEN base := base || 'user'; END IF;
    base := left(base, 18);
    candidate := base;
    i := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = candidate) LOOP
      i := i + 1;
      candidate := left(base, 18 - length(i::text)) || i::text;
    END LOOP;
    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_username(_user_id uuid, _username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _clean text := lower(btrim(_username));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF _clean !~ '^[a-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'Username must be 3-20 characters: letters, numbers or underscore';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = _clean AND id <> _user_id) THEN
    RAISE EXCEPTION 'That username is already taken';
  END IF;
  UPDATE public.profiles SET username = _clean WHERE id = _user_id;
  RETURN _clean;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_username(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_username(uuid, text) TO authenticated;
-- ===== supabase/migrations/20260824140151_9ccea0f8-c77f-4647-951a-b298cd02e8e7.sql =====

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_projects TO authenticated;
GRANT ALL ON public.group_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_items TO authenticated;
GRANT ALL ON public.group_items TO service_role;

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_group_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select (auth.uid() is null or _user_id = auth.uid())
     and (exists (select 1 from public.group_projects p where p.id = _project_id and p.owner_id = _user_id)
       or exists (select 1 from public.group_members m where m.project_id = _project_id and m.user_id = _user_id))
$$;

CREATE OR REPLACE FUNCTION public.is_accepted_group_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select (auth.uid() is null or _user_id = auth.uid())
     and (exists (select 1 from public.group_projects p where p.id = _project_id and p.owner_id = _user_id)
       or exists (select 1 from public.group_members m
                  where m.project_id = _project_id and m.user_id = _user_id and m.status = 'accepted'))
$$;

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.group_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read messages" ON public.group_messages;
CREATE POLICY "Members read messages" ON public.group_messages FOR SELECT TO authenticated
  USING (public.is_accepted_group_member(project_id, auth.uid()));
DROP POLICY IF EXISTS "Members post messages" ON public.group_messages;
CREATE POLICY "Members post messages" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_accepted_group_member(project_id, auth.uid()));
DROP POLICY IF EXISTS "Authors delete messages" ON public.group_messages;
CREATE POLICY "Authors delete messages" ON public.group_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Members may update their own invite row (accept / decline)
DROP POLICY IF EXISTS "Invitees respond" ON public.group_members;
CREATE POLICY "Invitees respond" ON public.group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Invite by username
CREATE OR REPLACE FUNCTION public.invite_group_member(_project_id uuid, _username text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _name text; _email text; _id uuid; _clean text := lower(btrim(_username));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_projects p WHERE p.id = _project_id AND p.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the project owner can invite members';
  END IF;
  SELECT id, full_name, email INTO _uid, _name, _email FROM public.profiles WHERE lower(username) = _clean;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No student found with username %', _clean;
  END IF;
  IF _uid = auth.uid() THEN
    RAISE EXCEPTION 'You are already in this project';
  END IF;
  IF EXISTS (SELECT 1 FROM public.group_members m WHERE m.project_id = _project_id AND m.user_id = _uid) THEN
    RAISE EXCEPTION 'That student is already invited';
  END IF;
  INSERT INTO public.group_members (project_id, user_id, display_name, email, username, status, invited_by)
  VALUES (_project_id, _uid, coalesce(_name, _clean), _email, _clean, 'invited', auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_group_invite(_member_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_members m WHERE m.id = _member_id AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF _accept THEN
    UPDATE public.group_members SET status = 'accepted', responded_at = now() WHERE id = _member_id;
  ELSE
    DELETE FROM public.group_members WHERE id = _member_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_group_invites()
RETURNS TABLE(member_id uuid, project_id uuid, project_name text, deadline_date date, invited_by_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, p.id, p.name, p.deadline_date, coalesce(pr.full_name, pr.username, 'A classmate'), m.created_at
  FROM public.group_members m
  JOIN public.group_projects p ON p.id = m.project_id
  LEFT JOIN public.profiles pr ON pr.id = m.invited_by
  WHERE m.user_id = auth.uid() AND m.status = 'invited'
  ORDER BY m.created_at DESC
$$;

-- Existing accounts should not see the onboarding tour again
UPDATE public.profiles SET tour_completed_at = now() WHERE tour_completed_at IS NULL;

-- ===== supabase/migrations/20260824140221_ca5e7bcf-14cd-4187-b9de-71b0ad2e8bf0.sql =====

REVOKE EXECUTE ON FUNCTION public.invite_group_member(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.respond_group_invite(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_group_invites() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_accepted_group_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.invite_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_group_invite(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_group_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_accepted_group_member(uuid, uuid) TO authenticated;

-- ===== supabase/migrations/20260824141355_77875d80-c7b9-4bdb-90af-0a57b9813263.sql =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_projects TO service_role;
GRANT ALL ON public.group_members TO service_role;
GRANT ALL ON public.group_items TO service_role;
GRANT ALL ON public.group_messages TO service_role;
-- ===== supabase/migrations/20260824141610_188fc32c-610a-4847-84bd-9d18cde9677d.sql =====
CREATE POLICY "Owners view own projects" ON public.group_projects
FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Own membership rows" ON public.group_members
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Owners view project members" ON public.group_members
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.group_projects p WHERE p.id = group_members.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Owners view project items" ON public.group_items
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.group_projects p WHERE p.id = group_items.project_id AND p.owner_id = auth.uid()));
-- ===== supabase/migrations/20260824163131_5e196aab-dc76-47ea-8414-a732fd1a24fd.sql =====
ALTER TABLE public.user_ai_keys ADD COLUMN IF NOT EXISTS model text;
-- ===== supabase/migrations/20260826170012_8d4a88fa-eaa8-45e4-b042-9d46aecce833.sql =====
CREATE TABLE public.code_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject_id UUID,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  stdin TEXT NOT NULL DEFAULT '',
  last_output TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_snippets TO authenticated;
GRANT ALL ON public.code_snippets TO service_role;
ALTER TABLE public.code_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own snippets" ON public.code_snippets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_code_snippets_user ON public.code_snippets(user_id, updated_at DESC);
CREATE TRIGGER update_code_snippets_updated_at BEFORE UPDATE ON public.code_snippets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
commit;

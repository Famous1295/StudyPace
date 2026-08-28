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
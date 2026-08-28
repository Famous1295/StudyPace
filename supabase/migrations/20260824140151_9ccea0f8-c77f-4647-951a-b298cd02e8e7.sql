
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

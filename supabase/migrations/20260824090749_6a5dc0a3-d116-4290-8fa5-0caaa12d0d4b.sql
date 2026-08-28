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
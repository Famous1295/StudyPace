CREATE POLICY "Owners view own projects" ON public.group_projects
FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Own membership rows" ON public.group_members
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Owners view project members" ON public.group_members
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.group_projects p WHERE p.id = group_members.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Owners view project items" ON public.group_items
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.group_projects p WHERE p.id = group_items.project_id AND p.owner_id = auth.uid()));
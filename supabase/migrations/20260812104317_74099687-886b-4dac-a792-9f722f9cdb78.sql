create policy "Admins read all tasks" on public.tasks
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins read all panic scores" on public.panic_scores
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
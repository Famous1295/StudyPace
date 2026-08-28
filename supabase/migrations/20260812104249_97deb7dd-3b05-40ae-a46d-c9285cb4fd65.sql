drop policy "Anyone can view active branches" on public.branches;
create policy "Visitors view active branches" on public.branches
  for select to anon using (is_active);
create policy "Users view branches" on public.branches
  for select to authenticated using (is_active or public.has_role(auth.uid(),'admin'));
revoke all on function public.has_role(uuid, public.app_role) from anon;
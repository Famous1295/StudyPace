GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_projects TO service_role;
GRANT ALL ON public.group_members TO service_role;
GRANT ALL ON public.group_items TO service_role;
GRANT ALL ON public.group_messages TO service_role;
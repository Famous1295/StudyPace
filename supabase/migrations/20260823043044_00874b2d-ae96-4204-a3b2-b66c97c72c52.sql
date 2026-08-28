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

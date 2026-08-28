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
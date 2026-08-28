
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

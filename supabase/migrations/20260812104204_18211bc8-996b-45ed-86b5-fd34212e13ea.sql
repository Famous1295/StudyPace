-- ROLES
create type public.app_role as enum ('admin','faculty','student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create policy "Users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- BRANCHES
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.branches to anon;
grant select, insert, update, delete on public.branches to authenticated;
grant all on public.branches to service_role;
alter table public.branches enable row level security;
create policy "Anyone can view active branches" on public.branches
  for select to anon, authenticated using (is_active or public.has_role(auth.uid(),'admin'));
create policy "Admins manage branches" on public.branches
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.branches (name, code) values
  ('Computer Engineering','CE'),
  ('Computer Science','CS'),
  ('Information Technology','IT');

-- SEMESTER SETTINGS
create table public.semester_settings (
  semester int primary key check (semester between 1 and 8),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select on public.semester_settings to anon;
grant select, insert, update, delete on public.semester_settings to authenticated;
grant all on public.semester_settings to service_role;
alter table public.semester_settings enable row level security;
create policy "Anyone can view semesters" on public.semester_settings
  for select to anon, authenticated using (true);
create policy "Admins manage semesters" on public.semester_settings
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.semester_settings (semester) select generate_series(1,8);

-- PROFILES additions
alter table public.profiles
  add column if not exists email text,
  add column if not exists status text not null default 'active' check (status in ('active','suspended')),
  add column if not exists branch_id uuid references public.branches(id);

update public.profiles p set branch_id = b.id from public.branches b where p.branch = b.name and p.branch_id is null;

create policy "Admins read all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins update all profiles" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- SUBJECTS master list
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  branch_id uuid references public.branches(id) on delete set null,
  semester int check (semester between 1 and 8),
  created_at timestamptz not null default now(),
  unique (code)
);
grant select, insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "Signed in users read subjects" on public.subjects
  for select to authenticated using (true);
create policy "Admins manage subjects" on public.subjects
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- NOTIFICATION SETTINGS (singleton)
create table public.notification_settings (
  id boolean primary key default true check (id),
  whatsapp_enabled boolean not null default false,
  email_digest_enabled boolean not null default true,
  daily_reminder_time time not null default '08:00',
  weekly_digest_day int not null default 0 check (weekly_digest_day between 0 and 6),
  weekly_digest_time time not null default '18:00',
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_settings to authenticated;
grant all on public.notification_settings to service_role;
alter table public.notification_settings enable row level security;
create policy "Signed in users read notification settings" on public.notification_settings
  for select to authenticated using (true);
create policy "Admins manage notification settings" on public.notification_settings
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
insert into public.notification_settings (id) values (true);

-- AUDIT LOG
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  admin_name text,
  action_type text not null,
  target text,
  details text,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "Admins read audit log" on public.audit_log
  for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins write audit log" on public.audit_log
  for insert to authenticated with check (public.has_role(auth.uid(),'admin') and admin_id = auth.uid());

-- New user trigger: capture email, branch_id, default student role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _branch text := NEW.raw_user_meta_data ->> 'branch';
  _branch_id uuid;
begin
  select id into _branch_id from public.branches
  where name = _branch or id::text = _branch limit 1;

  insert into public.profiles (id, full_name, semester, branch, branch_id, email)
  values (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    nullif(NEW.raw_user_meta_data ->> 'semester','')::int,
    coalesce((select name from public.branches where id = _branch_id), _branch),
    _branch_id,
    NEW.email
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (NEW.id, coalesce(nullif(NEW.raw_user_meta_data ->> 'role','')::public.app_role, 'student'))
  on conflict do nothing;

  return NEW;
end;
$$;

update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
insert into public.user_roles (user_id, role)
select id, 'student' from auth.users on conflict do nothing;
-- Staff / admin role management.
--
-- Staff authenticate through normal Supabase Auth (email + password, set up
-- via the dashboard or Admin API — not part of this table). This table only
-- links an existing auth identity to a store role. There is intentionally
-- no public sign-up path onto this table: see 0005_staff_users_policies.sql
-- for the provisioning procedure, which is the only way rows are ever
-- written here.

create table public.staff_users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_users is
  'Store staff/admin accounts. Rows are only ever created or changed via the provision_staff()/deactivate_staff() functions, never by direct insert.';

create index staff_users_role_idx on public.staff_users (role);
create index staff_users_is_active_idx on public.staff_users (is_active);

create trigger staff_users_set_updated_at
  before update on public.staff_users
  for each row
  execute function public.set_updated_at();

-- RLS is enabled immediately so the table is never briefly writable by
-- everyone. No policies exist yet (added in 0005, once the is_staff()
-- helper exists), so until then this table permits no access at all to
-- the anon/authenticated roles, which is the correct fail-closed default.
alter table public.staff_users enable row level security;

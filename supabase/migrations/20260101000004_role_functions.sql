-- Role-check helpers used by RLS policies on every other table.
--
-- These are SECURITY DEFINER so that checking staff_users from a policy on
-- a *different* table never recurses into staff_users' own RLS, and so
-- that staff_users' own policies (0005) can safely call this function too
-- without recursing into themselves. This relies on the function being
-- owned by a role that bypasses RLS (in Supabase, whatever role runs these
-- migrations — normally `postgres` — already has BYPASSRLS). Do not change
-- the owner of these functions to a non-privileged role.
--
-- `set search_path` is pinned to prevent search-path hijacking of a
-- SECURITY DEFINER function.

create or replace function public.is_staff(required_role text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.is_active
      and (required_role is null or su.role = required_role)
  );
$$;

comment on function public.is_staff(text) is
  'True if the current authenticated user is an active staff member. Pass ''admin'' to require the admin role specifically.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff('admin');
$$;

revoke all on function public.is_staff(text) from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

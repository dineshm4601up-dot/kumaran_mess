-- RLS policies for staff_users, plus the only two functions that are ever
-- allowed to write to it. There is no INSERT/UPDATE/DELETE policy on this
-- table for anon/authenticated at all — writes only happen inside these
-- SECURITY DEFINER functions (which bypass RLS via their owner), and both
-- functions require the caller to already be an active admin. This is what
-- satisfies "no public staff-registration or role-promotion operation" and
-- "customers can never promote themselves": there is no code path to this
-- table that does not first check is_admin() against the *caller's* own
-- row.
--
-- The very first admin cannot be created this way (there is, by
-- definition, no admin yet to authorize it) — see
-- supabase/docs/SETUP.md for the one-time manual bootstrap step.

create policy staff_users_select_staff
  on public.staff_users
  for select
  to authenticated
  using (public.is_staff());

create or replace function public.provision_staff(
  p_target_user_id uuid,
  p_full_name text,
  p_role text
)
returns public.staff_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.staff_users;
begin
  if not public.is_admin() then
    raise exception 'Only an active admin may provision staff accounts';
  end if;

  if p_role not in ('admin', 'staff') then
    raise exception 'role must be ''admin'' or ''staff''';
  end if;

  if p_target_user_id is null then
    raise exception 'p_target_user_id is required';
  end if;

  insert into public.staff_users (id, full_name, role, is_active)
  values (p_target_user_id, p_full_name, p_role, true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        is_active = true,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.provision_staff(uuid, text, text) is
  'Creates or re-activates a staff/admin account for an existing auth.users identity. Caller must already be an active admin.';

create or replace function public.deactivate_staff(p_target_user_id uuid)
returns public.staff_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.staff_users;
begin
  if not public.is_admin() then
    raise exception 'Only an active admin may deactivate staff accounts';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'Ask another admin to deactivate your own account';
  end if;

  update public.staff_users
    set is_active = false,
        updated_at = now()
    where id = p_target_user_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'No staff account found for that user id';
  end if;

  return v_row;
end;
$$;

comment on function public.deactivate_staff(uuid) is
  'Soft-disables a staff/admin account. Caller must already be an active admin and cannot deactivate themselves.';

revoke all on function public.provision_staff(uuid, text, text) from public;
revoke all on function public.deactivate_staff(uuid) from public;
grant execute on function public.provision_staff(uuid, text, text) to authenticated;
grant execute on function public.deactivate_staff(uuid) to authenticated;

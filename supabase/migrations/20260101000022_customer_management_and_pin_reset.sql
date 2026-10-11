-- Phase 12 (part 1): admin-assisted customer PIN reset (no OTP/SMS —
-- requirement 3) and the shop's public contact details (requirement 6).
--
-- PIN reset architecture: the existing custom PIN auth (Phase 3,
-- 20260101000013_phone_auth.sql) already has everything needed except a
-- "must change PIN next login" flag and an admin-facing write path, so
-- this reuses set_customer_pin_for_user()'s exact hashing approach
-- (crypt()/gen_salt('bf')) rather than inventing a new one. No OTP, no
-- SMS, no paid provider — the admin types/generates the temporary PIN
-- directly, which is exactly what the phase asked for ("Admin generates
-- or enters a new temporary PIN").

-- ---------------------------------------------------------------------
-- Shop contact details (requirement 6). shop_phone already exists
-- (Phase 10, 20260101000021) as a bill-display field with no format
-- constraint and no default — reused here as the same "customer-facing
-- contact number" rather than adding a second, duplicate column, per
-- the phase's "do not hard-code the number into multiple components"
-- and "add a minimal migration only if necessary". whatsapp_number is
-- the one genuinely new column this requirement needs.
-- ---------------------------------------------------------------------

alter table public.shop_settings
  add column whatsapp_number text,
  add constraint shop_settings_whatsapp_number_format check (
    whatsapp_number is null or whatsapp_number ~ '^\+[1-9]\d{7,14}$'
  );

comment on column public.shop_settings.whatsapp_number is 'Optional, separate from shop_phone — the number customer-facing "contact us on WhatsApp" links use, normalised to E.164 the same way customer_profiles.phone is.';

-- shop_phone itself had no format constraint before now (Phase 10 left
-- it as a free-text bill display field); this phase starts actually
-- using it for a tel: link, so it needs the same E.164 shape every other
-- phone column in this schema already enforces. Existing data is safe
-- to constrain: either the column is still null (migration 0021 not yet
-- applied anywhere real) or already E.164 from register_customer_profile
-- fixtures.
alter table public.shop_settings
  add constraint shop_settings_shop_phone_format check (
    shop_phone is null or shop_phone ~ '^\+[1-9]\d{7,14}$'
  );

-- Initial contact number the phase asked for, applied as a column
-- default (new rows) and backfilled onto the existing singleton row only
-- if it's still unset — an admin who already configured a different
-- number before this migration ran keeps their own value, never
-- silently overwritten.
alter table public.shop_settings alter column shop_phone set default '+919344689836';
update public.shop_settings set shop_phone = '+919344689836' where shop_phone is null;

-- ---------------------------------------------------------------------
-- PIN reset: a flag forcing a PIN change, an audit trail that never
-- stores the PIN itself, and the two write paths (admin reset; the
-- customer's own forced change afterward).
-- ---------------------------------------------------------------------

alter table public.customer_profiles
  add column pin_reset_required boolean not null default false;

comment on column public.customer_profiles.pin_reset_required is 'Set true by admin_reset_customer_pin(); cleared only by change_own_customer_pin() once the customer picks their own PIN. Never set directly by any other path.';

-- Audit trail of *that an admin reset a PIN*, never *what the PIN was*
-- (requirement: "never store the temporary PIN in... application logs").
-- No update/delete grant at all — an audit log that can be edited after
-- the fact isn't one.
create table public.customer_pin_resets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles (id) on delete cascade,
  staff_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.customer_pin_resets is 'Audit trail only — records that a staff member reset a customer''s PIN and when, never the PIN value itself.';

create index customer_pin_resets_customer_id_idx on public.customer_pin_resets (customer_id);

alter table public.customer_pin_resets enable row level security;

create policy customer_pin_resets_select_staff
  on public.customer_pin_resets
  for select
  to authenticated
  using (public.is_staff());

create policy customer_pin_resets_insert_staff
  on public.customer_pin_resets
  for insert
  to authenticated
  with check (public.is_staff());

revoke all on public.customer_pin_resets from anon;

-- verify_customer_pin() needs an extra output column (pin_reset_required)
-- so the login route can tell a customer to change their temporary PIN —
-- Postgres has no ALTER FUNCTION for a changed return signature on a
-- table-returning function, so this is drop-and-recreate (same approach
-- Phase 10 used for the `total` generated column). Behaviour is
-- otherwise byte-for-byte identical to the Phase 3 version.
drop function if exists public.verify_customer_pin(text, text);

create function public.verify_customer_pin(p_phone text, p_pin text)
returns table (
  success boolean,
  customer_id uuid,
  locked_until timestamptz,
  attempts_remaining integer,
  pin_reset_required boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.customer_profiles%rowtype;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
begin
  select * into v_profile from public.customer_profiles where phone = p_phone;

  if v_profile.id is null then
    return query select false, null::uuid, null::timestamptz, null::integer, null::boolean;
    return;
  end if;

  if v_profile.pin_locked_until is not null and v_profile.pin_locked_until > now() then
    return query select false, v_profile.id, v_profile.pin_locked_until, 0, v_profile.pin_reset_required;
    return;
  end if;

  if crypt(p_pin, v_profile.pin_hash) = v_profile.pin_hash then
    update public.customer_profiles
      set pin_failed_attempts = 0, pin_locked_until = null
      where id = v_profile.id;
    return query select true, v_profile.id, null::timestamptz, v_max_attempts, v_profile.pin_reset_required;
    return;
  else
    update public.customer_profiles
      set pin_failed_attempts = pin_failed_attempts + 1,
          pin_locked_until = case
            when pin_failed_attempts + 1 >= v_max_attempts
              then now() + (v_lockout_minutes || ' minutes')::interval
            else pin_locked_until
          end
      where id = v_profile.id
      returning pin_failed_attempts, pin_locked_until
      into v_profile.pin_failed_attempts, v_profile.pin_locked_until;
    return query select false, v_profile.id, v_profile.pin_locked_until,
      greatest(v_max_attempts - v_profile.pin_failed_attempts, 0), v_profile.pin_reset_required;
    return;
  end if;
end;
$$;

comment on function public.verify_customer_pin(text, text) is
  'Same as Phase 3, plus pin_reset_required in the result so the login route can force a PIN change after an admin-assisted reset. Never returns pin_hash. service_role only.';

revoke all on function public.verify_customer_pin(text, text) from public;
grant execute on function public.verify_customer_pin(text, text) to service_role;

-- Admin-assisted reset (requirement 3, steps 5-6). p_staff_id is passed
-- in rather than read from auth.uid() because this function runs as
-- service_role from trusted server code the same way every other
-- service_role function in this schema does — the API route calling
-- this has already verified the staff session itself (getStaffContext())
-- before ever reaching here, and passes that verified id through.
create or replace function public.admin_reset_customer_pin(
  p_customer_id uuid,
  p_new_pin text,
  p_staff_id uuid
)
returns public.customer_profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.customer_profiles;
begin
  if p_new_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  update public.customer_profiles
    set pin_hash = crypt(p_new_pin, gen_salt('bf')),
        pin_failed_attempts = 0,
        pin_locked_until = null,
        pin_reset_required = true
    where id = p_customer_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'customer_not_found';
  end if;

  insert into public.customer_pin_resets (customer_id, staff_id)
  values (p_customer_id, p_staff_id);

  return v_row;
end;
$$;

comment on function public.admin_reset_customer_pin(uuid, text, uuid) is
  'Admin-assisted PIN reset — no OTP/SMS involved (requirement 3). Sets pin_reset_required so the customer must pick their own PIN after their next successful login. Logs who did it (customer_pin_resets), never what the PIN was. service_role only, called after the route''s own is_staff() check.';

revoke all on function public.admin_reset_customer_pin(uuid, text, uuid) from public;
grant execute on function public.admin_reset_customer_pin(uuid, text, uuid) to service_role;

-- The customer's own forced change, once logged in with the temporary
-- PIN (requirement 3, step 7). Requires the *current* (temporary) PIN
-- again as a defense-in-depth check — the session cookie alone proves
-- "this browser already knows the temporary PIN", but re-checking it
-- here means a stolen session cookie still can't silently take over the
-- account by picking a new PIN without ever having known the old one.
-- Reuses the exact same lockout columns as verify_customer_pin(), so a
-- brute-force attempt against *this* endpoint is throttled by the same
-- 5-attempts/15-minute rule, not a separate, easily-missed mechanism.
create or replace function public.change_own_customer_pin(
  p_customer_id uuid,
  p_current_pin text,
  p_new_pin text
)
returns table (
  success boolean,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.customer_profiles%rowtype;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
begin
  if p_new_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  select * into v_profile from public.customer_profiles where id = p_customer_id;

  if v_profile.id is null then
    raise exception 'customer_not_found';
  end if;

  if v_profile.pin_locked_until is not null and v_profile.pin_locked_until > now() then
    return query select false, v_profile.pin_locked_until;
    return;
  end if;

  if crypt(p_current_pin, v_profile.pin_hash) = v_profile.pin_hash then
    update public.customer_profiles
      set pin_hash = crypt(p_new_pin, gen_salt('bf')),
          pin_failed_attempts = 0,
          pin_locked_until = null,
          pin_reset_required = false
      where id = p_customer_id;
    return query select true, null::timestamptz;
    return;
  else
    update public.customer_profiles
      set pin_failed_attempts = pin_failed_attempts + 1,
          pin_locked_until = case
            when pin_failed_attempts + 1 >= v_max_attempts
              then now() + (v_lockout_minutes || ' minutes')::interval
            else pin_locked_until
          end
      where id = p_customer_id
      returning pin_locked_until into v_profile.pin_locked_until;
    return query select false, v_profile.pin_locked_until;
    return;
  end if;
end;
$$;

comment on function public.change_own_customer_pin(uuid, text, text) is
  'Forced PIN change after an admin reset (requirement 3, step 7) — requires the current (temporary) PIN again even though the caller already has a valid session, and shares verify_customer_pin()''s lockout columns. service_role only; p_customer_id must come from the caller''s own verified session, never client-supplied.';

revoke all on function public.change_own_customer_pin(uuid, text, text) from public;
grant execute on function public.change_own_customer_pin(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Admin customer directory (requirement 2) — all-time, unfiltered by
-- date range (unlike the Customer-wise *report*, which is date-ranged —
-- see 20260101000023_admin_reports.sql). One aggregate query, not one
-- query per customer (requirement 9's "avoid expensive repeated
-- queries"). Staff already have unrestricted SELECT on customer_profiles
-- and orders (Phase 2/3 policies), so this doesn't expose anything a
-- staff session couldn't already read directly.
-- ---------------------------------------------------------------------

create or replace function public.admin_list_customers(p_query text default null)
returns table (
  id uuid,
  full_name text,
  phone text,
  email text,
  created_at timestamptz,
  order_count bigint,
  delivered_sales numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cp.id,
    cp.full_name,
    cp.phone,
    cp.email,
    cp.created_at,
    count(o.id) as order_count,
    coalesce(sum(o.total) filter (where o.status = 'delivered'), 0) as delivered_sales
  from public.customer_profiles cp
  left join public.orders o on o.customer_id = cp.id
  where p_query is null or btrim(p_query) = ''
     or cp.full_name ilike '%' || p_query || '%'
     or cp.phone ilike '%' || p_query || '%'
  group by cp.id, cp.full_name, cp.phone, cp.email, cp.created_at
  order by cp.created_at desc
  limit 500;
$$;

comment on function public.admin_list_customers(text) is
  'Customer directory: all-time order_count/delivered_sales per customer, one aggregate query. service_role only, called after the route''s own is_staff() check.';

revoke all on function public.admin_list_customers(text) from public;
grant execute on function public.admin_list_customers(text) to service_role;

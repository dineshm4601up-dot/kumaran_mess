-- Customer profile, linked 1:1 to a Supabase Auth identity (requirement 3).
--
-- The PIN is never handled as plaintext by this migration or by any grant
-- given to the authenticated role: pin_hash can only ever be set by
-- register_customer_profile() below, which hashes it server-side with
-- pgcrypto's crypt()/gen_salt('bf') (bcrypt) before it is written. The
-- format check constraint is a second, independent guard against a future
-- code path accidentally writing a raw PIN into this column.
--
-- pin_failed_attempts / pin_locked_until exist to support rate limiting
-- and temporary lockout on PIN login, per the project's security
-- requirements. The function that will enforce that lockout on every
-- login attempt is intentionally deferred to the phase that builds the
-- actual login flow (it needs to be designed together with session
-- issuance) — these columns are schema groundwork for it, not yet wired
-- to anything that reads them.

create table public.customer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  pin_hash text not null,
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_phone_format check (phone ~ '^\+[1-9]\d{7,14}$'),
  constraint customer_profiles_email_format check (
    email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  ),
  constraint customer_profiles_pin_hash_format check (
    pin_hash ~ '^\$2[aby]\$\d{2}\$[A-Za-z0-9./]{53}$'
  ),
  constraint customer_profiles_pin_failed_attempts_non_negative check (
    pin_failed_attempts >= 0
  )
);

comment on table public.customer_profiles is 'One row per registered customer, 1:1 with auth.users. Written only via register_customer_profile(); only full_name/email are directly editable by the customer afterwards.';
comment on column public.customer_profiles.phone is 'E.164 format, e.g. +919876543210. This is the customer''s login identifier.';
comment on column public.customer_profiles.pin_hash is 'bcrypt hash only (via pgcrypto crypt()/gen_salt(''bf'')) — never a plaintext PIN.';

create unique index customer_profiles_phone_key on public.customer_profiles (phone);

create trigger customer_profiles_set_updated_at
  before update on public.customer_profiles
  for each row
  execute function public.set_updated_at();

alter table public.customer_profiles enable row level security;

create policy customer_profiles_select_own
  on public.customer_profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy customer_profiles_select_staff
  on public.customer_profiles
  for select
  to authenticated
  using (public.is_staff());

create policy customer_profiles_update_own
  on public.customer_profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Lock down exactly which columns the update policy above is allowed to
-- touch. phone/pin_hash/pin_failed_attempts/pin_locked_until are
-- deliberately excluded: phone changes need re-verification and PIN
-- changes need the current PIN or an OTP, neither of which exists as a
-- plain column update, so both are left for a dedicated function in a
-- later phase. There is no insert/delete grant at all — registration
-- happens only through register_customer_profile().
revoke all on public.customer_profiles from anon, authenticated;
grant select on public.customer_profiles to authenticated;
grant update (full_name, email) on public.customer_profiles to authenticated;

create or replace function public.register_customer_profile(
  p_full_name text,
  p_phone text,
  p_pin text,
  p_email text default null
)
returns public.customer_profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.customer_profiles;
  v_auth_phone text;
  v_phone_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to register a customer profile';
  end if;

  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;

  -- Require that p_phone matches the phone number actually verified by
  -- Supabase Auth for this session (via phone OTP sign-in), not merely
  -- whatever the client claims. Digits are compared with any '+' / spacing
  -- stripped, since Supabase stores auth.users.phone without a leading
  -- '+'. Without this check, an authenticated-but-unverified-for-this-
  -- number caller could register a profile claiming someone else's phone
  -- number and block that person from ever registering with it.
  select phone, phone_confirmed_at
    into v_auth_phone, v_phone_confirmed_at
  from auth.users
  where id = auth.uid();

  if v_phone_confirmed_at is null then
    raise exception 'Phone number has not been verified for this session';
  end if;

  if regexp_replace(coalesce(v_auth_phone, ''), '\D', '', 'g')
     <> regexp_replace(p_phone, '\D', '', 'g') then
    raise exception 'p_phone does not match the verified phone number for this session';
  end if;

  insert into public.customer_profiles (id, full_name, phone, email, pin_hash)
  values (auth.uid(), btrim(p_full_name), p_phone, p_email, crypt(p_pin, gen_salt('bf')))
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.register_customer_profile(text, text, text, text) is
  'Creates the caller''s own customer profile, hashing the PIN server-side. The caller must already have an authenticated session (e.g. after Supabase phone OTP verification).';

revoke all on function public.register_customer_profile(text, text, text, text) from public;
grant execute on function public.register_customer_profile(text, text, text, text) to authenticated;

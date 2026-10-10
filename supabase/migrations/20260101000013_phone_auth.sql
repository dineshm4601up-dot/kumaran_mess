-- Phase 3: customer registration & authentication primitives.
--
-- Architecture (see the Phase 3 chat explanation / PROJECT_PROGRESS.md for
-- the full write-up): customers never get a real Supabase Auth session.
-- auth.users is used only as the identity Supabase phone-auth never: a
-- row is created via the Admin API (service_role) purely so
-- customer_profiles.id keeps its FK from Phase 2. OTP, PIN verification,
-- and session issuance are all custom, and every function below is
-- restricted to `service_role` — i.e. callable only from trusted
-- server-side code (Next.js Route Handlers using the service role key),
-- never directly from a browser via PostgREST. This is deliberately
-- tighter than Phase 2's `anon`-callable `register_customer_profile()`,
-- which this supersedes for the actual registration flow used by the
-- app (left in place, unused, rather than dropped — see
-- PROJECT_PROGRESS.md).

-- ---------------------------------------------------------------------
-- OTP: custom, not Supabase's native phone-auth feature (see the Phase 3
-- explanation for why). Used for registration verification and
-- forgot-PIN recovery.
-- ---------------------------------------------------------------------

create table public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  purpose text not null check (purpose in ('register', 'login_recovery')),
  otp_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint phone_otps_attempts_non_negative check (attempts >= 0)
);

comment on table public.phone_otps is 'Hashed, short-lived OTP codes. service_role only — see request_phone_otp()/verify_phone_otp().';

create index phone_otps_phone_purpose_created_idx
  on public.phone_otps (phone, purpose, created_at desc);

alter table public.phone_otps enable row level security;

-- No policies at all: zero access for anon/authenticated on every
-- command. Only service_role (which bypasses RLS) can touch this table,
-- and only through the two functions below.
revoke all on public.phone_otps from anon, authenticated;

create or replace function public.request_phone_otp(p_phone text, p_purpose text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_otp text;
  v_last_created_at timestamptz;
  v_recent_count integer;
begin
  if p_purpose not in ('register', 'login_recovery') then
    raise exception 'invalid_purpose';
  end if;

  if p_phone !~ '^\+[1-9]\d{7,14}$' then
    raise exception 'invalid_phone_format';
  end if;

  select created_at into v_last_created_at
  from public.phone_otps
  where phone = p_phone and purpose = p_purpose
  order by created_at desc
  limit 1;

  if v_last_created_at is not null and v_last_created_at > now() - interval '60 seconds' then
    raise exception 'otp_cooldown';
  end if;

  select count(*) into v_recent_count
  from public.phone_otps
  where phone = p_phone and purpose = p_purpose and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'otp_rate_limited';
  end if;

  -- 6-digit numeric code. Compensating controls (10-minute expiry, 5
  -- attempts, the cooldown/rate-limit above) carry the real security
  -- weight here, not the RNG — Postgres's random() is a good PRNG but not
  -- a formal CSPRNG.
  v_otp := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.phone_otps (phone, purpose, otp_hash, expires_at)
  values (p_phone, p_purpose, crypt(v_otp, gen_salt('bf')), now() + interval '10 minutes');

  return v_otp;
end;
$$;

comment on function public.request_phone_otp(text, text) is
  'Generates and stores a hashed OTP, returning the raw code to the (trusted, service_role) caller to send via SMS. Never persists the raw code.';

create or replace function public.verify_phone_otp(p_phone text, p_purpose text, p_otp text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.phone_otps%rowtype;
  v_max_attempts constant integer := 5;
begin
  select * into v_row
  from public.phone_otps
  where phone = p_phone
    and purpose = p_purpose
    and consumed_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_row.id is null then
    return false;
  end if;

  if v_row.attempts >= v_max_attempts then
    return false;
  end if;

  if crypt(p_otp, v_row.otp_hash) = v_row.otp_hash then
    update public.phone_otps set consumed_at = now() where id = v_row.id;
    return true;
  else
    update public.phone_otps set attempts = attempts + 1 where id = v_row.id;
    return false;
  end if;
end;
$$;

comment on function public.verify_phone_otp(text, text, text) is
  'Checks and consumes the latest unexpired OTP for (phone, purpose). Returns false (never an error) for wrong/expired/missing codes, so callers can show a uniform message.';

revoke all on function public.request_phone_otp(text, text) from public;
revoke all on function public.verify_phone_otp(text, text, text) from public;
grant execute on function public.request_phone_otp(text, text) to service_role;
grant execute on function public.verify_phone_otp(text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Customer sessions: our own, not a Supabase Auth session. token_hash is
-- SHA-256 of a 256-bit random token — a plain fast hash is correct here
-- (unlike pin_hash/otp_hash) because the token's security comes from its
-- entropy, not from being expensive to brute-force guess.
-- ---------------------------------------------------------------------

create table public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

comment on table public.customer_sessions is 'service_role only. Session CRUD is done directly from trusted server code (no wrapper functions needed — there is no untrusted caller to guard against here).';

create unique index customer_sessions_token_hash_key on public.customer_sessions (token_hash);
create index customer_sessions_customer_id_idx on public.customer_sessions (customer_id);
create index customer_sessions_expires_at_idx on public.customer_sessions (expires_at);

alter table public.customer_sessions enable row level security;
revoke all on public.customer_sessions from anon, authenticated;

-- ---------------------------------------------------------------------
-- PIN verification (the everyday login path) and the two service_role
-- write paths that complete registration and forgot-PIN recovery.
-- ---------------------------------------------------------------------

create or replace function public.verify_customer_pin(p_phone text, p_pin text)
returns table (
  success boolean,
  customer_id uuid,
  locked_until timestamptz,
  attempts_remaining integer
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
    -- Do not reveal whether the phone is registered.
    return query select false, null::uuid, null::timestamptz, null::integer;
    return;
  end if;

  if v_profile.pin_locked_until is not null and v_profile.pin_locked_until > now() then
    return query select false, v_profile.id, v_profile.pin_locked_until, 0;
    return;
  end if;

  if crypt(p_pin, v_profile.pin_hash) = v_profile.pin_hash then
    update public.customer_profiles
      set pin_failed_attempts = 0, pin_locked_until = null
      where id = v_profile.id;
    return query select true, v_profile.id, null::timestamptz, v_max_attempts;
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
      greatest(v_max_attempts - v_profile.pin_failed_attempts, 0);
    return;
  end if;
end;
$$;

comment on function public.verify_customer_pin(text, text) is
  '5 wrong attempts locks the account for 15 minutes. Never returns pin_hash. service_role only — called from the login API route, never exposed directly to a browser.';

create or replace function public.register_customer_profile_for_user(
  p_user_id uuid,
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
begin
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;

  insert into public.customer_profiles (id, full_name, phone, email, pin_hash)
  values (p_user_id, btrim(p_full_name), p_phone, p_email, crypt(p_pin, gen_salt('bf')))
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.register_customer_profile_for_user(uuid, text, text, text, text) is
  'service_role-only registration completion: the caller (the register/verify API route) has already verified the OTP and created the auth.users row itself, so unlike Phase 2''s register_customer_profile() this trusts p_user_id/p_phone directly rather than deriving them from auth.uid().';

create or replace function public.set_customer_pin_for_user(p_phone text, p_new_pin text)
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
        pin_locked_until = null
    where phone = p_phone
    returning * into v_row;

  if v_row.id is null then
    raise exception 'No customer profile found for that phone number';
  end if;

  return v_row;
end;
$$;

comment on function public.set_customer_pin_for_user(text, text) is
  'Forgot-PIN completion: caller must have already verified a login_recovery OTP for this phone. Resets the lockout counters too.';

revoke all on function public.verify_customer_pin(text, text) from public;
revoke all on function public.register_customer_profile_for_user(uuid, text, text, text, text) from public;
revoke all on function public.set_customer_pin_for_user(text, text) from public;
grant execute on function public.verify_customer_pin(text, text) to service_role;
grant execute on function public.register_customer_profile_for_user(uuid, text, text, text, text) to service_role;
grant execute on function public.set_customer_pin_for_user(text, text) to service_role;

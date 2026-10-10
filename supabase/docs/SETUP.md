# Applying the Phase 2 migrations

This covers getting `supabase/migrations/*.sql` onto a Supabase project, and
the one-time manual step to create the first admin. Nothing here touches
the Next.js app — Phase 2 is database-only.

## Option A — Supabase CLI configured

```bash
# One-time: link this repo to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# Apply all pending migrations to the linked project
supabase db push

# Optional, local dev only: spin up a local Supabase stack, apply
# migrations AND supabase/seed.sql against it
supabase db reset
```

`supabase db push` applies the migration files in `supabase/migrations/` in
filename order (they're already timestamp-prefixed so that's also
chronological order). It will refuse to run if a migration has already
been applied with different contents, which is the safety net against
accidentally re-running something that changed.

## Option B — No CLI, using the Supabase Dashboard SQL Editor

If the CLI isn't set up yet, apply the files manually and in this exact
order (each one depends on the ones before it):

1. `20260101000001_extensions.sql`
2. `20260101000002_utility_functions.sql`
3. `20260101000003_staff_users.sql`
4. `20260101000004_role_functions.sql`
5. `20260101000005_staff_users_policies.sql`
6. `20260101000006_categories.sql`
7. `20260101000007_products.sql`
8. `20260101000008_customer_profiles.sql`
9. `20260101000009_customer_addresses.sql`
10. `20260101000010_orders.sql`
11. `20260101000011_order_items.sql`
12. `20260101000012_order_status_history.sql`

For each one: Supabase Dashboard → **SQL Editor** → **New query** → paste
the file's contents → **Run**. Do this on a **development** project first,
not production, until you've read through `TESTING.md` and tried the
access tests yourself.

The SQL Editor runs as the Postgres superuser, so every statement above
(including the `CREATE EXTENSION`, the `SECURITY DEFINER` functions, and
the `REVOKE`/`GRANT` statements) will apply cleanly with no extra setup.

If you'd like dev-only sample categories/products afterwards (mirroring
the Phase 1 UI demo data), also run `supabase/seed.sql` the same way. Do
**not** run it against a production project.

## One-time manual step: creating the first admin

There is intentionally no self-service way to become the first admin —
`provision_staff()` requires the caller to already be an admin, which is
exactly the point (see `20260101000005_staff_users_policies.sql`). So the
very first admin has to be created by you, once, directly:

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**.
   Create the owner/admin's login with their real email and a password
   (or send an invite, per your preference). Copy the generated **User
   UID**.
2. Supabase Dashboard → **SQL Editor** → run:

   ```sql
   insert into public.staff_users (id, full_name, role)
   values ('<paste the User UID here>', 'Owner Name', 'admin');
   ```

That's it — this one row is the root of trust for every future staff
account. From then on, any admin can create or deactivate other staff
accounts by calling (as that admin, from an authenticated session):

```sql
select public.provision_staff('<their auth user id>', 'Their Name', 'staff');
select public.deactivate_staff('<their auth user id>');
```

## If a table seems to deny everything even with a matching policy

Most tables below rely on Supabase's default behavior of granting base
table privileges (SELECT/INSERT/UPDATE/DELETE) to the `anon`/`authenticated`
roles on new tables in `public`, with RLS policies doing the real
filtering — this is standard on every Supabase project and is why most
tables here have no explicit `GRANT` statements. `customer_profiles` and
`orders` are the two exceptions, where an explicit `REVOKE ... GRANT`
narrows things further (see those migration files). If you're on a
project where those defaults were changed, and a policy that should allow
access still returns nothing, run:

```sql
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products to anon, authenticated;
```

as a baseline and compare against what each migration file grants.

## Environment variables

No new environment variables are introduced by Phase 2. The variables
already listed in `.env.example` from Phase 1
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) are what the Next.js app will use to talk to
this schema once UI integration starts — nothing to add yet.

## Open design questions for the next phase

These are flagged here because they affect how the schema above gets used,
not because anything is broken:

- **PIN login doesn't issue a session by itself.** `register_customer_profile()`
  requires an existing authenticated session (from Supabase phone-OTP
  sign-in) and writes the hashed PIN. But logging in with phone + PIN
  afterwards is *not* a native Supabase Auth method — verifying the PIN
  and actually minting a session for the user needs either the Supabase
  Admin API (from a trusted server context) or another mechanism. This
  needs to be designed together with the login flow itself, not bolted on
  here.
- **PIN rate limiting is schema-only so far.** `pin_failed_attempts` /
  `pin_locked_until` exist on `customer_profiles`, but no function
  increments or checks them yet — that belongs with the login flow above.
  Per-account lockout alone also won't stop an attacker probing many
  different phone numbers; pair it with IP/edge-level rate limiting when
  that phase is built.
- **Public product visibility.** `products_select_available_public` only
  allows reading `is_active AND is_available` products — an out-of-stock
  item is invisible to customers at the database level, not just greyed
  out. If the UI should show out-of-stock items (greyed out, as the Phase
  1 demo UI did), that needs a dedicated read path (e.g. a SECURITY
  DEFINER function) rather than loosening this policy.
- **Order placement.** There is no customer-facing way to create an order
  yet, by design — that needs a function that revalidates stock and
  current prices server-side before insert. This schema is ready for that
  function to be added without further migrations.

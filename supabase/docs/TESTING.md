# Testing the RLS policies

This is a manual test script for the SQL Editor (works identically via
`psql`). It creates disposable fixture rows and then impersonates
different users by switching the Postgres session role and faking the
`request.jwt.claims` setting that `auth.uid()` reads — the same technique
Supabase's own documentation uses for testing RLS without a real HTTP
request. No application code is involved.

**Run this only against a throwaway development project.** It inserts
directly into `auth.users`, which you would never do from application
code, and the cleanup step at the end deletes everything it created.

**Important — one code block per "Run":** pasting several statements into
the SQL Editor and hitting Run executes them as a single implicit
transaction. `set local role` and `set_config(..., true)` only last for
that transaction, which is why every block below re-establishes the role
and claim it needs. It also means that if a statement is expected to
*fail*, it is always the **last** statement in its block — once a
statement raises an error, Postgres aborts the rest of that transaction,
so anything after it in the same block would fail too, but for the wrong
reason ("current transaction is aborted"), not the thing being tested.
Run each block below separately, in order, top to bottom.

## 1. Fixtures

Run as-is — the SQL Editor runs as the table owner, so this setup step
bypasses RLS entirely, which is expected.

> **If the `auth.users` insert below errors** (e.g. a "null value in
> column ... violates not-null constraint" on some column not listed
> here): Supabase's `auth.users` schema has gained a handful of columns
> across versions, and this wasn't tested against a live project before
> being handed to you (no Supabase project was available in the sandbox
> this was written in — see the Phase 2 report). The more robust
> alternative is to skip this insert and instead create three real users
> via Dashboard → Authentication → Users → **Add user** (two as
> customers, one as staff), then substitute their real UUIDs for the
> `11111111.../22222222.../33333333...` placeholders everywhere below.

```sql
-- Two customers and one staff member, as raw Supabase Auth identities.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'customer.a@example.test', extensions.crypt('x', extensions.gen_salt('bf')),
   now(), '919800000001', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'customer.b@example.test', extensions.crypt('x', extensions.gen_salt('bf')),
   now(), '919800000002', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'staff.one@example.test', extensions.crypt('x', extensions.gen_salt('bf')),
   now(), null, null, '{}', '{}', now(), now(), '', '', '', '');
```

```sql
-- Customer A registers themselves — the one path allowed to write
-- pin_hash, exercising register_customer_profile() for real.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
select public.register_customer_profile('Customer A', '+919800000001', '1234');
```

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}', true);
select public.register_customer_profile('Customer B', '+919800000002', '5678');
```

```sql
-- The first staff account: this always happens as the table owner (see
-- SETUP.md) — there is no self-service path onto staff_users.
reset role;
insert into public.staff_users (id, full_name, role)
values ('33333333-3333-3333-3333-333333333333', 'Staff One', 'staff');

-- A category, a product, and a test order for Customer A so there's
-- something to read/update below. The order is inserted directly (as
-- table owner) since Phase 2 has no customer-facing order-creation path
-- yet — see 0010_orders.sql.
insert into public.categories (name, slug) values ('Tiffin', 'tiffin');

insert into public.products (category_id, name, price, stock_quantity)
select id, 'Idli (4 pcs)', 60.00, 40 from public.categories where slug = 'tiffin';

insert into public.orders (
  customer_id, subtotal, delivery_fee,
  delivery_address_line, delivery_latitude, delivery_longitude
) values (
  '11111111-1111-1111-1111-111111111111', 60.00, 20.00,
  '12 Test Street', 13.08, 80.27
);
```

## 2. Tests

Each block below is self-contained and safe to run on its own; run them
in order, checking the comment next to each statement.

```sql
-- TEST: anon can read active categories/available products, nothing else.
reset role;
set local role anon;
select count(*) from public.categories;        -- expect 1
select count(*) from public.products;           -- expect 1
select count(*) from public.customer_profiles;  -- expect 0 (no error, zero rows)
select count(*) from public.orders;             -- expect 0
select count(*) from public.staff_users;        -- expect 0
```

```sql
-- TEST: Customer A can see their own profile and order, and nothing
-- belonging to Customer B — not as an error, just as zero matching rows.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
select full_name, phone from public.customer_profiles;  -- expect only the "Customer A" row
select count(*) from public.orders;                      -- expect 1 (their own test order)
select * from public.customer_profiles
  where id = '22222222-2222-2222-2222-222222222222';      -- expect 0 rows, Customer B is invisible
```

```sql
-- TEST: a customer CAN update their own display name.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
update public.customer_profiles set full_name = 'Customer A Updated' where id = auth.uid(); -- expect success (1 row)
```

```sql
-- TEST: a customer CANNOT change their own phone number via a plain
-- update (phone changes need re-verification, not implemented yet).
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
update public.customer_profiles set phone = '+919999999999' where id = auth.uid(); -- expect: permission denied for column "phone"
```

```sql
-- TEST: a customer CANNOT overwrite their own pin_hash directly.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
update public.customer_profiles set pin_hash = 'anything' where id = auth.uid(); -- expect: permission denied for column "pin_hash"
```

```sql
-- TEST: a customer sees zero rows in staff_users (not an error — just
-- nothing visible), confirming there is nothing to read or infer from.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
select count(*) from public.staff_users; -- expect 0
```

```sql
-- TEST: a customer CANNOT insert themselves into staff_users.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
insert into public.staff_users (id, full_name, role) values (auth.uid(), 'Self Promoted', 'admin'); -- expect: permission denied / RLS violation
```

```sql
-- TEST: a customer CANNOT self-promote via provision_staff() either —
-- the function itself checks the caller is already an admin.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
select public.provision_staff(auth.uid(), 'Self Promoted', 'admin'); -- expect exception: "Only an active admin may provision staff accounts"
```

```sql
-- TEST: a customer CANNOT change their own order's status.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
update public.orders set status = 'delivered' where customer_id = auth.uid(); -- expect: 0 rows updated (no policy matches — not staff)
```

```sql
-- TEST: a customer CANNOT touch an order's subtotal, even on their own
-- order (column isn't granted at all, regardless of row ownership).
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
update public.orders set subtotal = 1.00 where customer_id = auth.uid(); -- expect: permission denied for column "subtotal"
```

```sql
-- TEST: a customer CANNOT place an order directly (no checkout function
-- exists yet in this phase — see 0010_orders.sql).
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
insert into public.orders (customer_id, subtotal, delivery_fee, delivery_address_line, delivery_latitude, delivery_longitude)
  values (auth.uid(), 1.00, 0, 'x', 0, 0); -- expect: permission denied / RLS violation
```

```sql
-- TEST: staff can see every customer's orders and profiles.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}', true);
select count(*) from public.orders;            -- expect 1 (Customer A's test order)
select count(*) from public.customer_profiles; -- expect 2
```

```sql
-- TEST: staff CAN legally progress the order: pending -> confirmed.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}', true);
update public.orders set status = 'confirmed'
  where customer_id = '11111111-1111-1111-1111-111111111111'; -- expect success (1 row)
```

```sql
-- TEST: staff CANNOT skip straight to delivered from confirmed.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}', true);
update public.orders set status = 'delivered'
  where customer_id = '11111111-1111-1111-1111-111111111111'; -- expect exception: "Illegal order status transition: confirmed -> delivered"
```

```sql
-- TEST: staff CAN continue the legal path: confirmed -> preparing.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}', true);
update public.orders set status = 'preparing'
  where customer_id = '11111111-1111-1111-1111-111111111111'; -- expect success (1 row)
```

```sql
-- TEST: the audit trail recorded exactly the transitions that actually
-- happened — the rejected confirmed->delivered attempt left no trace.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}', true);
select from_status, to_status from public.order_status_history
  where order_id = (select id from public.orders where customer_id = '11111111-1111-1111-1111-111111111111')
  order by created_at;
-- expect exactly 3 rows: (null, pending), (pending, confirmed), (confirmed, preparing)
```

```sql
-- TEST: a non-admin staff member cannot provision other staff — only an
-- admin can.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}', true);
select public.provision_staff('22222222-2222-2222-2222-222222222222', 'Someone', 'staff'); -- expect exception: "Only an active admin..."
```

## 3. Cleanup

```sql
reset role;
delete from public.orders where customer_id in (
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'
);
delete from public.products where name = 'Idli (4 pcs)';
delete from public.categories where slug = 'tiffin';
delete from public.staff_users where id = '33333333-3333-3333-3333-333333333333';
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
); -- cascades to customer_profiles/customer_addresses
```

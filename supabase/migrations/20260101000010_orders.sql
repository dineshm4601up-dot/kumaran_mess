-- Orders.
--
-- There is deliberately no INSERT policy for `authenticated` on this table
-- yet. Placing an order safely requires validating stock and pricing
-- current products server-side (never trusting a client-submitted price or
-- total), which is checkout business logic for a later phase, not schema.
-- Until that phase adds a SECURITY DEFINER `place_order()`-style function,
-- rows can only be written by the service role (e.g. from the SQL editor,
-- for seeding/testing). What *is* in scope here, and implemented below, is
-- making sure that once an order exists, customers can never tamper with
-- its total, payment state, or status (requirement 14), and that staff
-- status changes are restricted to legal transitions (requirement 15, see
-- 0012_order_status_history.sql for the trigger).

create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  customer_id uuid not null references public.customer_profiles (id) on delete restrict,
  status text not null default 'pending',
  payment_method text not null default 'cod',
  payment_status text not null default 'pending',
  subtotal numeric(10, 2) not null,
  delivery_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) generated always as (subtotal + delivery_fee) stored,
  delivery_address_id uuid references public.customer_addresses (id) on delete set null,
  delivery_address_line text not null,
  delivery_landmark text,
  delivery_latitude numeric(9, 6) not null,
  delivery_longitude numeric(9, 6) not null,
  delivery_instructions text,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_valid check (
    status in ('pending', 'confirmed', 'preparing', 'dispatched', 'delivered', 'cancelled')
  ),
  constraint orders_payment_method_cod_only check (payment_method = 'cod'),
  constraint orders_payment_status_valid check (
    payment_status in ('pending', 'collected', 'refused')
  ),
  constraint orders_subtotal_non_negative check (subtotal >= 0),
  constraint orders_delivery_fee_non_negative check (delivery_fee >= 0),
  constraint orders_delivery_latitude_range check (delivery_latitude between -90 and 90),
  constraint orders_delivery_longitude_range check (delivery_longitude between -180 and 180)
);

comment on table public.orders is 'total is a GENERATED column (subtotal + delivery_fee) so it can never drift from its inputs, by anyone, including staff.';
comment on column public.orders.delivery_address_id is 'Soft reference for convenience only — delivery_address_line/landmark/latitude/longitude below are the authoritative snapshot, so editing or deleting a saved address later never changes a past order (same principle as order_items price snapshots).';

create unique index orders_order_number_key on public.orders (order_number);
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at);

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null then
    new.order_number := 'KM-' || to_char(now(), 'YYYYMMDD') || '-' ||
      lpad(nextval('public.order_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger orders_set_order_number
  before insert on public.orders
  for each row
  execute function public.set_order_number();

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy orders_select_own
  on public.orders
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy orders_select_staff
  on public.orders
  for select
  to authenticated
  using (public.is_staff());

-- Staff can change order state, but only through legal transitions (see
-- the BEFORE UPDATE trigger added in 0012_order_status_history.sql).
create policy orders_update_staff
  on public.orders
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Column-restrict the policy above: staff may change status, payment
-- status, and a cancellation reason, but never the amounts, the customer,
-- the order number, or the delivery snapshot (requirement 14).
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant update (status, payment_status, cancelled_reason) on public.orders to authenticated;

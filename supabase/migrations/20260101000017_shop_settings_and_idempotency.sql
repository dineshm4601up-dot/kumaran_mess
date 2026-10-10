-- Shop-wide checkout settings (delivery fee, minimum order, optional
-- service radius) and the idempotency column on orders that place_order()
-- (next migration) relies on.
--
-- shop_settings is a singleton: `id boolean primary key default true check
-- (id)` only ever allows exactly one row, since `id` can only be `true`.
-- service_radius_km / base_latitude / base_longitude start NULL, meaning
-- "no radius restriction configured" — place_order() only enforces a
-- radius when all three are set, matching "if configured" in the spec.

create table public.shop_settings (
  id boolean primary key default true check (id),
  delivery_fee numeric(10, 2) not null default 0,
  min_order_amount numeric(10, 2) not null default 0,
  service_radius_km numeric(6, 2),
  base_latitude numeric(9, 6),
  base_longitude numeric(9, 6),
  updated_at timestamptz not null default now(),
  constraint shop_settings_delivery_fee_non_negative check (delivery_fee >= 0),
  constraint shop_settings_min_order_non_negative check (min_order_amount >= 0),
  constraint shop_settings_radius_positive check (service_radius_km is null or service_radius_km > 0),
  constraint shop_settings_base_latitude_range check (base_latitude is null or base_latitude between -90 and 90),
  constraint shop_settings_base_longitude_range check (base_longitude is null or base_longitude between -180 and 180)
);

comment on table public.shop_settings is 'Singleton (always exactly one row). Radius enforcement in place_order() only activates when service_radius_km AND both base coordinates are set.';

insert into public.shop_settings (id) values (true);

create trigger shop_settings_set_updated_at
  before update on public.shop_settings
  for each row
  execute function public.set_updated_at();

alter table public.shop_settings enable row level security;

-- Public read: delivery fee / minimum order amount are shown on the
-- checkout page before an order exists, nothing here is sensitive.
create policy shop_settings_select_public
  on public.shop_settings
  for select
  to anon, authenticated
  using (true);

create policy shop_settings_update_staff
  on public.shop_settings
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke insert, delete on public.shop_settings from anon, authenticated;

-- Idempotency: place_order() checks this before creating anything. A
-- partial unique index (not a plain UNIQUE column) so NULL — which other
-- code paths inserting into orders might still use, like old seed/test
-- fixtures — never collides.
alter table public.orders add column idempotency_key text;

create unique index orders_idempotency_key_key
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create or replace function public.haversine_km(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns numeric
language sql
immutable
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

comment on function public.haversine_km(numeric, numeric, numeric, numeric) is 'Great-circle distance in km between two lat/lon points.';

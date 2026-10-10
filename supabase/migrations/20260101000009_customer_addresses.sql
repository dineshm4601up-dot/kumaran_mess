create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles (id) on delete cascade,
  label text not null default 'Home',
  address_line text not null,
  landmark text,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  delivery_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_latitude_range check (latitude between -90 and 90),
  constraint customer_addresses_longitude_range check (longitude between -180 and 180),
  constraint customer_addresses_address_line_not_blank check (btrim(address_line) <> '')
);

comment on table public.customer_addresses is 'Saved delivery addresses, always with a map-pin coordinate pair (requirement 4).';

create index customer_addresses_customer_id_idx on public.customer_addresses (customer_id);

-- At most one default address per customer.
create unique index customer_addresses_one_default_per_customer
  on public.customer_addresses (customer_id)
  where is_default;

create trigger customer_addresses_set_updated_at
  before update on public.customer_addresses
  for each row
  execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;

create policy customer_addresses_select_own
  on public.customer_addresses
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy customer_addresses_select_staff
  on public.customer_addresses
  for select
  to authenticated
  using (public.is_staff());

-- Addresses are an ordinary address book (unlike customer_profiles, no
-- column here is security-sensitive), so customers get full CRUD on their
-- own rows with no column restriction.
create policy customer_addresses_insert_own
  on public.customer_addresses
  for insert
  to authenticated
  with check (customer_id = auth.uid());

create policy customer_addresses_update_own
  on public.customer_addresses
  for update
  to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy customer_addresses_delete_own
  on public.customer_addresses
  for delete
  to authenticated
  using (customer_id = auth.uid());

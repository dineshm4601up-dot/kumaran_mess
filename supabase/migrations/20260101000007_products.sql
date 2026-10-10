create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  image_url text,
  stock_quantity integer not null default 0,
  is_available boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_non_negative check (price >= 0),
  constraint products_stock_non_negative check (stock_quantity >= 0)
);

comment on table public.products is 'Menu items. category_id is RESTRICT so a category with products cannot be deleted outright — deactivate it or reassign its products first.';

create index products_category_id_idx on public.products (category_id);
create index products_is_active_available_idx on public.products (is_active, is_available);

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

alter table public.products enable row level security;

-- Public users may read active, available products only (requirement 12).
-- Note: this means an out-of-stock/unavailable item is not readable at all
-- by anon/authenticated customers at the database level, not just greyed
-- out — if a later phase wants to show "out of stock" items in the public
-- menu UI, that will need a dedicated read path (e.g. a SECURITY DEFINER
-- function) rather than a direct table policy, since this policy is the
-- literal reading of requirement 12.
create policy products_select_available_public
  on public.products
  for select
  to anon, authenticated
  using (is_active and is_available);

create policy products_select_all_staff
  on public.products
  for select
  to authenticated
  using (public.is_staff());

create policy products_write_staff
  on public.products
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

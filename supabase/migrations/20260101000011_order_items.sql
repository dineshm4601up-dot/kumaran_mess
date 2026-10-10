-- Order line items. product_name_snapshot / product_price_snapshot freeze
-- the product's name and price at the moment of ordering (requirement 5),
-- so a later price change or product edit never rewrites order history.
-- product_id is kept as a soft reference (ON DELETE SET NULL) purely for
-- convenience joins; it is never the source of truth for what the
-- customer was actually charged.
--
-- Like orders, there is no insert/update/delete grant for `authenticated`
-- here — line items are written once, by whatever creates the order, and
-- are never edited afterwards by anyone through the API.

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name_snapshot text not null,
  product_price_snapshot numeric(10, 2) not null,
  quantity integer not null,
  line_total numeric(10, 2) generated always as (product_price_snapshot * quantity) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_price_non_negative check (product_price_snapshot >= 0),
  constraint order_items_quantity_positive check (quantity > 0)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create trigger order_items_set_updated_at
  before update on public.order_items
  for each row
  execute function public.set_updated_at();

alter table public.order_items enable row level security;

create policy order_items_select_own
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.customer_id = auth.uid()
    )
  );

create policy order_items_select_staff
  on public.order_items
  for select
  to authenticated
  using (public.is_staff());

revoke all on public.order_items from anon, authenticated;
grant select on public.order_items to authenticated;

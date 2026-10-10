create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.categories is 'Menu categories (e.g. Tiffin, Meals, Bakery).';

create unique index categories_slug_key on public.categories (slug);
create index categories_is_active_idx on public.categories (is_active);
create index categories_display_order_idx on public.categories (display_order);

create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

alter table public.categories enable row level security;

-- Public users may read active categories only (requirement 12).
create policy categories_select_active_public
  on public.categories
  for select
  to anon, authenticated
  using (is_active);

-- Staff may read every category regardless of active state (so they can
-- see and re-activate a deactivated one).
create policy categories_select_all_staff
  on public.categories
  for select
  to authenticated
  using (public.is_staff());

create policy categories_write_staff
  on public.categories
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

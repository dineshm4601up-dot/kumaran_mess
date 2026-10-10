-- Phase 4: schema groundwork for real menu/admin integration.

-- image_url never held a URL in practice (Phase 1/2 only ever had local
-- demo SVGs) — renamed to make its real contract explicit: this column
-- holds a Supabase Storage *path* within the product-images bucket, set
-- only by the admin image-upload route after a validated upload, never an
-- arbitrary client-submitted URL (requirement 6 of the Phase 4 spec). The
-- app computes the actual delivery URL from this path at render time.
alter table public.products rename column image_url to image_path;

alter table public.products
  add column is_featured boolean not null default false,
  add column display_order integer not null default 0;

create index products_is_featured_idx on public.products (is_featured);
create index products_display_order_idx on public.products (display_order);

comment on column public.products.image_path is 'Storage object path within the product-images bucket (e.g. products/<id>/<uuid>.jpg), or null. Never a client-submitted URL.';
comment on column public.products.is_featured is 'Drives the homepage "featured" section.';
comment on column public.products.display_order is 'Lower sorts first within a category / the featured list.';

-- Resolves the open question left in Phase 2's SETUP.md: the public menu
-- should show out-of-stock items (greyed out in the UI), not hide them —
-- there's nothing confidential about an unavailable product's name or
-- price. Only is_active now gates public visibility; is_available is an
-- application-layer "can you order this right now" flag, not a
-- visibility flag.
drop policy products_select_available_public on public.products;

create policy products_select_active_public
  on public.products
  for select
  to anon, authenticated
  using (is_active);

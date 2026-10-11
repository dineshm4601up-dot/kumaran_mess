-- Fix: admin_dashboard_stats()'s "Pending & Active" count wasn't scoped
-- to today at all — it counted every currently-active order in the
-- whole system, regardless of when it was placed, which is why
-- Delivered Today + Cancelled Today could exceed (or simply not equal)
-- Today's Orders: the cards were never meant to reconcile in the first
-- place (they count by different event dates), but "Pending & Active"
-- additionally had a real scoping bug on top of that legitimate
-- difference. Also switches "Delivered Today"/"Cancelled Today" from
-- `orders.updated_at` (bumped by *any* column change — e.g. a COD
-- payment_status edit on an order delivered yesterday would have wrongly
-- counted as "delivered today") to the actual status-transition
-- timestamp recorded in `order_status_history` (written automatically by
-- the existing log_order_status_change() trigger, Phase 2) — the correct
-- "best available source" per the task, with no new column needed.
--
-- Metric definitions (also documented in PROJECT_PROGRESS.md and in the
-- dashboard UI's own StatCard hints):
--   - todays_order_count: orders *placed* today (Asia/Kolkata calendar
--     day), any status. Unchanged from before.
--   - todays_sales: sum of `total` for orders *placed* today, excluding
--     cancelled. Unchanged definition (preserved per the task's "if the
--     current definition is sales from orders placed today, preserve
--     it") — still does not imply COD was actually collected.
--   - active_order_count: **redefined** — orders *placed* today that are
--     still in a non-terminal status (pending/confirmed/preparing/ready/
--     out_for_delivery). Previously counted every active order
--     system-wide; this is the fix.
--   - delivered_today_count: distinct orders whose status *transitioned
--     to* 'delivered' today, per order_status_history — not orders.
--     updated_at.
--   - cancelled_today_count: same, for a transition to 'cancelled'.
--
-- Deliberately NOT forced to reconcile: delivered_today_count and
-- cancelled_today_count can include orders *placed* on an earlier day
-- (e.g. an order placed last night, delivered this morning) — that is
-- correct, not a bug, because they're answering "what happened today",
-- not "what was placed today". The UI makes this explicit per-card.
--
-- "today" is computed once, as a half-open Asia/Kolkata-local
-- [day_start, day_end) timestamptz range, and every count/sum below
-- compares against that same range — never a UTC date cast, and never a
-- different boundary per card.
create or replace function public.admin_dashboard_stats()
returns table (
  todays_order_count bigint,
  todays_sales numeric,
  active_order_count bigint,
  delivered_today_count bigint,
  cancelled_today_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('day', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata' as day_start,
      (date_trunc('day', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata' + interval '1 day' as day_end
  )
  select
    (
      select count(*)
      from public.orders o, bounds b
      where o.created_at >= b.day_start and o.created_at < b.day_end
    ),
    (
      select coalesce(sum(o.total), 0)
      from public.orders o, bounds b
      where o.created_at >= b.day_start and o.created_at < b.day_end
        and o.status <> 'cancelled'
    ),
    (
      select count(*)
      from public.orders o, bounds b
      where o.created_at >= b.day_start and o.created_at < b.day_end
        and o.status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery')
    ),
    (
      select count(distinct osh.order_id)
      from public.order_status_history osh, bounds b
      where osh.to_status = 'delivered'
        and osh.created_at >= b.day_start and osh.created_at < b.day_end
    ),
    (
      select count(distinct osh.order_id)
      from public.order_status_history osh, bounds b
      where osh.to_status = 'cancelled'
        and osh.created_at >= b.day_start and osh.created_at < b.day_end
    );
$$;

comment on function public.admin_dashboard_stats() is
  'Dashboard aggregate counts/sales. "Today" is a half-open Asia/Kolkata-local timestamptz range, computed once and reused by every count. Delivered/cancelled-today use order_status_history''s transition timestamp, not orders.updated_at (which any column edit bumps). active_order_count is scoped to orders placed today, matching the other "today" cards, NOT every currently-active order system-wide. service_role only.';

-- ---------------------------------------------------------------------
-- Admin product search (Task 2) — same pattern as admin_search_orders()
-- (Phase 7): a dedicated function with a plain text parameter, matched
-- via ilike with safe '||' concatenation (no string-built SQL, no
-- injection surface), so Tamil/English text and special characters in
-- the query are all handled the same safe way. Staff already have
-- unrestricted SELECT on products (public menu data), so this adds no
-- new exposure.
-- ---------------------------------------------------------------------
create or replace function public.admin_search_products(p_query text default null)
returns table (
  id uuid,
  name text,
  description text,
  price numeric,
  image_path text,
  category_id uuid,
  is_available boolean,
  is_active boolean,
  is_featured boolean,
  display_order integer,
  stock_quantity integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.description, p.price, p.image_path, p.category_id,
    p.is_available, p.is_active, p.is_featured, p.display_order, p.stock_quantity
  from public.products p
  where p_query is null or btrim(p_query) = ''
     or p.name ilike '%' || p_query || '%'
     or p.description ilike '%' || p_query || '%'
  order by p.display_order asc;
$$;

comment on function public.admin_search_products(text) is
  'Admin product search by name OR description (Task 2) — matches Tamil and English text, case-insensitive, safe against special characters via ilike + parameter binding (no string-built SQL). service_role only, called after the route''s own is_staff() check. Base order is display_order; the page applies its own sort on top of this result set.';

revoke all on function public.admin_search_products(text) from public;
grant execute on function public.admin_search_products(text) to service_role;

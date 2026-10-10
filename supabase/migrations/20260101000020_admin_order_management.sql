-- Phase 7: admin dashboard aggregates, order search, and a dedicated COD
-- collection audit trail that stays separate from the delivery-status
-- timeline (requirement: "COD collection and delivery status remain
-- distinct").
--
-- Status *changes* themselves are NOT a new RPC — staff perform them via
-- a plain UPDATE using their own authenticated Supabase session (not the
-- service_role client this project otherwise uses for admin writes),
-- specifically so order_status_history.changed_by (via auth.uid() in the
-- existing log_order_status_change() trigger) correctly attributes the
-- change to that staff member. Phase 2 already granted
-- `update (status, payment_status, cancelled_reason) on orders to
-- authenticated` restricted by the `orders_update_staff` RLS policy
-- (is_staff()) and enforced by enforce_order_status_transition() — this
-- migration only adds the two payment-attribution columns to that
-- existing grant, it doesn't change the enforcement model at all.

alter table public.orders
  add column payment_updated_at timestamptz,
  add column payment_updated_by uuid references auth.users (id) on delete set null;

comment on column public.orders.payment_updated_at is 'When COD payment_status was last changed by staff — distinct from the delivery-status timeline.';
comment on column public.orders.payment_updated_by is 'Which staff member last changed payment_status.';

grant update (payment_updated_at, payment_updated_by) on public.orders to authenticated;

-- Order search across both the order itself and its customer, without
-- fighting PostgREST's embedded-resource filter syntax for an OR across
-- two tables — a plain SQL join is simpler and easier to verify. Staff
-- already have unrestricted SELECT on both tables (Phase 2/3 policies),
-- so this doesn't expose anything a staff session couldn't already read
-- directly; it exists for the convenience of doing it in one call.
create or replace function public.admin_search_orders(p_query text default null)
returns table (
  id uuid,
  order_number text,
  status text,
  payment_status text,
  total numeric,
  created_at timestamptz,
  customer_name text,
  customer_phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.order_number, o.status, o.payment_status, o.total, o.created_at,
         cp.full_name, cp.phone
  from public.orders o
  join public.customer_profiles cp on cp.id = o.customer_id
  where p_query is null or btrim(p_query) = ''
     or o.order_number ilike '%' || p_query || '%'
     or cp.full_name ilike '%' || p_query || '%'
     or cp.phone ilike '%' || p_query || '%'
  order by o.created_at desc
  limit 200;
$$;

comment on function public.admin_search_orders(text) is
  'Search orders by order number or customer name/phone. service_role only, called after the route''s own is_staff() check.';

revoke all on function public.admin_search_orders(text) from public;
grant execute on function public.admin_search_orders(text) to service_role;

-- Dashboard aggregates, computed with explicit "today" boundaries in the
-- store's own timezone (Asia/Kolkata) rather than the database server's —
-- otherwise "today" would silently drift by its UTC offset. Definitions,
-- stated precisely since the task asked for "clearly defined" statuses:
--   - todays_order_count: every order *placed* today, any status.
--   - todays_sales: sum of `total` for orders *placed* today, excluding
--     cancelled ones (a cancelled order isn't revenue).
--   - active_order_count: orders currently in any non-terminal status,
--     regardless of when they were placed (today or earlier).
--   - delivered_today_count / cancelled_today_count: orders that reached
--     that status *today* (by updated_at), not necessarily placed today.
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
  select
    (
      select count(*) from public.orders
      where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    ),
    (
      select coalesce(sum(total), 0) from public.orders
      where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
        and status <> 'cancelled'
    ),
    (
      select count(*) from public.orders
      where status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery')
    ),
    (
      select count(*) from public.orders
      where status = 'delivered'
        and (updated_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    ),
    (
      select count(*) from public.orders
      where status = 'cancelled'
        and (updated_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    );
$$;

comment on function public.admin_dashboard_stats() is
  'Dashboard aggregate counts/sales, "today" computed in Asia/Kolkata. service_role only.';

revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to service_role;

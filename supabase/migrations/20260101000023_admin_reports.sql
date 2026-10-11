-- Phase 12 (part 2): admin reporting RPCs (requirement 1).
--
-- Every function here is a single aggregate query (GROUP BY / FILTER),
-- never a loop that queries once per customer/product (requirement 9's
-- "avoid expensive repeated queries"). All read order_items'
-- product_name_snapshot (never products.name) so a later product edit
-- never changes a historical report (requirement C's "use order-item
-- snapshots"). "Today"-style date boundaries elsewhere in this schema
-- (admin_dashboard_stats) are computed in Asia/Kolkata, not UTC — these
-- follow the same convention: p_start/p_end are plain dates (the
-- store's own calendar days), compared against orders.created_at
-- converted into Asia/Kolkata first.
--
-- Financial definitions, matching the phase's explicit requirements:
--   - delivered_sales sums `total` only for status = 'delivered' — a
--     cancelled order is never revenue, and a still-pending/preparing
--     order isn't revenue yet either (not "sales" until delivered).
--   - cod_collected sums `total` for status = 'delivered' AND
--     payment_status = 'collected' specifically — a delivered order
--     does NOT imply payment was collected (requirement: "do not treat
--     an order as paid merely because its status is delivered").
--   - cod_pending sums `total` for status = 'delivered' AND
--     payment_status <> 'collected' — calculated independently of
--     delivered_sales, not derived by subtraction, so the two can never
--     silently drift apart.
--   - No column is summed twice: delivery charges come only from
--     orders.delivery_fee, item totals only from order_items.line_total
--     (used solely by the product-wise report), and orders.total is
--     never added on top of its own components.
--
-- p_status filters to one specific order status when provided (null = all
-- statuses). p_payment_method isn't a parameter here even though the UI
-- offers it: payment_method on this schema is `cod`-only by a CHECK
-- constraint (Phase 2) — there is nothing else it could ever filter to,
-- so threading it through every function would be a no-op parameter.
-- The UI still shows the filter (clearly labelled as COD-only) per the
-- phase's "if supported by the existing application" — it's reusable the
-- moment a second payment method is ever added, without a function
-- signature change.

create or replace function public.admin_report_summary(
  p_start date,
  p_end date,
  p_status text default null
)
returns table (
  total_orders bigint,
  delivered_orders bigint,
  cancelled_orders bigint,
  pending_processing_orders bigint,
  delivered_sales numeric,
  total_delivery_charges numeric,
  cod_collected numeric,
  cod_pending numeric,
  avg_delivered_order_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) as total_orders,
    count(*) filter (where status = 'delivered') as delivered_orders,
    count(*) filter (where status = 'cancelled') as cancelled_orders,
    count(*) filter (where status not in ('delivered', 'cancelled')) as pending_processing_orders,
    coalesce(sum(total) filter (where status = 'delivered'), 0) as delivered_sales,
    coalesce(sum(delivery_fee) filter (where status = 'delivered'), 0) as total_delivery_charges,
    coalesce(sum(total) filter (where status = 'delivered' and payment_status = 'collected'), 0) as cod_collected,
    coalesce(sum(total) filter (where status = 'delivered' and payment_status <> 'collected'), 0) as cod_pending,
    coalesce(avg(total) filter (where status = 'delivered'), 0) as avg_delivered_order_value
  from public.orders
  where (created_at at time zone 'Asia/Kolkata')::date between p_start and p_end
    and (p_status is null or status = p_status);
$$;

comment on function public.admin_report_summary(date, date, text) is
  'Monthly/custom-range sales summary. delivered_sales/cod_collected/cod_pending are independent sums, never derived by subtraction. service_role only.';

revoke all on function public.admin_report_summary(date, date, text) from public;
grant execute on function public.admin_report_summary(date, date, text) to service_role;

-- Daily trend within the selected range, for the "monthly sales trend"
-- chart — bucketed by day regardless of the preset chosen (This
-- month/Last month/This year/Custom), so a year-long range simply yields
-- more points rather than needing a second, differently-shaped function.
create or replace function public.admin_report_sales_trend(
  p_start date,
  p_end date,
  p_status text default null
)
returns table (
  trend_date date,
  order_count bigint,
  delivered_sales numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (created_at at time zone 'Asia/Kolkata')::date as trend_date,
    count(*) as order_count,
    coalesce(sum(total) filter (where status = 'delivered'), 0) as delivered_sales
  from public.orders
  where (created_at at time zone 'Asia/Kolkata')::date between p_start and p_end
    and (p_status is null or status = p_status)
  group by (created_at at time zone 'Asia/Kolkata')::date
  order by trend_date asc;
$$;

comment on function public.admin_report_sales_trend(date, date, text) is
  'Daily order_count/delivered_sales within [p_start, p_end], for the sales-trend chart. service_role only.';

revoke all on function public.admin_report_sales_trend(date, date, text) from public;
grant execute on function public.admin_report_sales_trend(date, date, text) to service_role;

-- Customer-wise report (requirement B) — date-ranged, unlike
-- admin_list_customers() (the all-time Customers-page directory, see
-- 20260101000022). Same aggregate-query shape either way.
create or replace function public.admin_report_customer_wise(
  p_start date,
  p_end date,
  p_status text default null
)
returns table (
  customer_id uuid,
  customer_name text,
  customer_phone text,
  order_count bigint,
  delivered_count bigint,
  cancelled_count bigint,
  delivered_sales numeric,
  avg_delivered_order_value numeric,
  last_order_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cp.id as customer_id,
    cp.full_name as customer_name,
    cp.phone as customer_phone,
    count(o.id) as order_count,
    count(o.id) filter (where o.status = 'delivered') as delivered_count,
    count(o.id) filter (where o.status = 'cancelled') as cancelled_count,
    coalesce(sum(o.total) filter (where o.status = 'delivered'), 0) as delivered_sales,
    coalesce(avg(o.total) filter (where o.status = 'delivered'), 0) as avg_delivered_order_value,
    max(o.created_at) as last_order_at
  from public.orders o
  join public.customer_profiles cp on cp.id = o.customer_id
  where (o.created_at at time zone 'Asia/Kolkata')::date between p_start and p_end
    and (p_status is null or o.status = p_status)
  group by cp.id, cp.full_name, cp.phone
  order by delivered_sales desc;
$$;

comment on function public.admin_report_customer_wise(date, date, text) is
  'Per-customer order counts/sales within a date range (requirement B). service_role only.';

revoke all on function public.admin_report_customer_wise(date, date, text) from public;
grant execute on function public.admin_report_customer_wise(date, date, text) to service_role;

-- Product-wise report (requirement C) — grouped by the order_items
-- snapshot name, never products.id/products.name, so a product rename
-- or price edit after the fact never changes what a historical report
-- shows for orders placed before that edit.
create or replace function public.admin_report_product_wise(
  p_start date,
  p_end date,
  p_status text default null
)
returns table (
  product_name text,
  quantity_sold bigint,
  order_count bigint,
  total_sales numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    oi.product_name_snapshot as product_name,
    sum(oi.quantity) as quantity_sold,
    count(distinct oi.order_id) as order_count,
    sum(oi.line_total) as total_sales
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where (o.created_at at time zone 'Asia/Kolkata')::date between p_start and p_end
    and (p_status is null or o.status = p_status)
  group by oi.product_name_snapshot
  order by total_sales desc;
$$;

comment on function public.admin_report_product_wise(date, date, text) is
  'Per-product quantity/order-count/sales within a date range, grouped by order_items.product_name_snapshot so historical reports never change when a product is later renamed or repriced (requirement C). service_role only.';

revoke all on function public.admin_report_product_wise(date, date, text) from public;
grant execute on function public.admin_report_product_wise(date, date, text) to service_role;

-- Order details report (requirement D) — one row per order with its
-- items flattened into a single readable summary column, rather than
-- one row per line item (which would repeat every order-level column
-- once per item and read awkwardly in a spreadsheet).
create or replace function public.admin_report_order_details(
  p_start date,
  p_end date,
  p_status text default null
)
returns table (
  order_id uuid,
  order_number text,
  created_at timestamptz,
  customer_name text,
  customer_phone text,
  items_summary text,
  subtotal numeric,
  delivery_fee numeric,
  tax_amount numeric,
  total numeric,
  status text,
  payment_status text,
  payment_updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id as order_id,
    o.order_number,
    o.created_at,
    cp.full_name as customer_name,
    cp.phone as customer_phone,
    (
      select string_agg(oi.product_name_snapshot || ' x' || oi.quantity, '; ' order by oi.created_at)
      from public.order_items oi
      where oi.order_id = o.id
    ) as items_summary,
    o.subtotal,
    o.delivery_fee,
    o.tax_amount,
    o.total,
    o.status,
    o.payment_status,
    o.payment_updated_at
  from public.orders o
  join public.customer_profiles cp on cp.id = o.customer_id
  where (o.created_at at time zone 'Asia/Kolkata')::date between p_start and p_end
    and (p_status is null or o.status = p_status)
  order by o.created_at desc;
$$;

comment on function public.admin_report_order_details(date, date, text) is
  'One row per order with items flattened into items_summary, for the Order Details report/export (requirement D). "Collected amount" is `total` whenever payment_status = ''collected''; this app has no partial-COD-collection concept. service_role only.';

revoke all on function public.admin_report_order_details(date, date, text) from public;
grant execute on function public.admin_report_order_details(date, date, text) to service_role;

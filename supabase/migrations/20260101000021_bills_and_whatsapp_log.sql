-- Phase 10: schema support for bill generation (shop display details,
-- optional tax) and an audit trail for the WhatsApp click-to-chat action.
--
-- Tax is deliberately simple and off by default: a single
-- tax_rate_percent applied to subtotal only, not a certified GST engine
-- (no CGST/SGST split, no HSN codes, no invoice-numbering-sequence
-- rules). shop_settings.gstin is purely a display field — setting it
-- doesn't validate or register anything. The bill UI treats "gstin and
-- tax_rate_percent both set" as "show this as a tax invoice with a tax
-- breakdown and the GSTIN", and anything else as a plain order receipt —
-- see requirement E.9. This is intentionally conservative: a small
-- shop that isn't GST-registered should see a receipt, not something
-- that looks like a compliant tax document it never promised to be.

alter table public.shop_settings
  add column shop_name text not null default 'Kumaran Mess',
  add column shop_address text,
  add column shop_phone text,
  add column gstin text,
  add column tax_rate_percent numeric(5, 2),
  add column estimated_delivery_minutes integer;

comment on column public.shop_settings.gstin is 'Display-only. Setting this (together with tax_rate_percent) switches the bill from a plain receipt to a tax invoice layout — this project does not validate GSTIN format or register anything with any tax authority.';
comment on column public.shop_settings.tax_rate_percent is 'Percent applied to subtotal only, at order-creation time (see place_order()) — null/unset means no tax, which is the default for a non-GST-registered shop.';
comment on column public.shop_settings.estimated_delivery_minutes is 'Optional. Only included in the WhatsApp confirmation message when actually set (requirement C.4).';

alter table public.shop_settings
  add constraint shop_settings_tax_rate_range check (tax_rate_percent is null or (tax_rate_percent >= 0 and tax_rate_percent <= 100)),
  add constraint shop_settings_estimated_delivery_positive check (estimated_delivery_minutes is null or estimated_delivery_minutes > 0);

-- orders.tax_amount: computed and stored once, at order-creation time, by
-- place_order() below — never recomputed later from a since-changed tax
-- rate, same snapshot principle as every other amount on this table
-- (requirement E.5/E.10: "bill totals consistent with the transaction
-- that created the order", "do not regenerate... using current... rates").
alter table public.orders
  add column tax_amount numeric(10, 2) not null default 0,
  add constraint orders_tax_amount_non_negative check (tax_amount >= 0);

-- `total` is a GENERATED column (Phase 2) and Postgres has no ALTER ...
-- SET EXPRESSION for those — drop and re-add is the standard, safe way to
-- change one. Existing rows are automatically recomputed from their
-- already-stored subtotal/delivery_fee plus the tax_amount default (0),
-- which is numerically identical to their previous total — this does not
-- change any existing order's total.
alter table public.orders drop column total;
alter table public.orders add column total numeric(10, 2) generated always as (subtotal + delivery_fee + tax_amount) stored;

comment on column public.orders.total is 'subtotal + delivery_fee + tax_amount, all three frozen at order-creation time.';

create or replace function public.place_order(
  p_customer_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_idempotency_key text default null,
  p_delivery_instructions text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.orders;
  v_address public.customer_addresses%rowtype;
  v_settings public.shop_settings%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product_name text;
  v_product_price numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_tax_amount numeric(10, 2) := 0;
  v_distance_km numeric;
  v_order public.orders;
  v_snapshot jsonb := '[]'::jsonb;
begin
  if p_customer_id is null then
    raise exception 'p_customer_id is required';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
    from public.orders
    where idempotency_key = p_idempotency_key and customer_id = p_customer_id;

    if v_existing.id is not null then
      return v_existing;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items';
  end if;

  select * into v_address
  from public.customer_addresses
  where id = p_address_id and customer_id = p_customer_id;

  if v_address.id is null then
    raise exception 'address_not_found';
  end if;

  select * into v_settings from public.shop_settings limit 1;

  if v_settings.service_radius_km is not null
     and v_settings.base_latitude is not null
     and v_settings.base_longitude is not null then
    if v_address.latitude is null or v_address.longitude is null then
      raise exception 'address_location_required';
    end if;

    v_distance_km := public.haversine_km(
      v_settings.base_latitude, v_settings.base_longitude,
      v_address.latitude, v_address.longitude
    );

    if v_distance_km > v_settings.service_radius_km then
      raise exception 'outside_service_area';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_product_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid_item';
    end if;

    update public.products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product_id
        and is_active
        and is_available
        and stock_quantity >= v_quantity
      returning name, price into v_product_name, v_product_price;

    if v_product_name is null then
      raise exception 'item_unavailable';
    end if;

    v_subtotal := v_subtotal + (v_product_price * v_quantity);

    v_snapshot := v_snapshot || jsonb_build_object(
      'product_id', v_product_id,
      'name', v_product_name,
      'price', v_product_price,
      'quantity', v_quantity
    );
  end loop;

  if v_subtotal < v_settings.min_order_amount then
    raise exception 'below_minimum_order';
  end if;

  -- Tax, if configured, computed once here from subtotal only and frozen
  -- onto the order — never recalculated later even if tax_rate_percent
  -- changes afterward.
  if v_settings.tax_rate_percent is not null then
    v_tax_amount := round(v_subtotal * v_settings.tax_rate_percent / 100, 2);
  end if;

  insert into public.orders (
    customer_id, subtotal, delivery_fee, tax_amount,
    delivery_address_id, delivery_address_line, delivery_landmark,
    delivery_latitude, delivery_longitude, delivery_instructions,
    idempotency_key
  ) values (
    p_customer_id, v_subtotal, v_settings.delivery_fee, v_tax_amount,
    v_address.id, v_address.address_line, v_address.landmark,
    v_address.latitude, v_address.longitude,
    coalesce(p_delivery_instructions, v_address.delivery_instructions),
    p_idempotency_key
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name_snapshot, product_price_snapshot, quantity)
  select v_order.id, (e ->> 'product_id')::uuid, e ->> 'name', (e ->> 'price')::numeric, (e ->> 'quantity')::integer
  from jsonb_array_elements(v_snapshot) e;

  return v_order;
end;
$$;

revoke all on function public.place_order(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.place_order(uuid, uuid, jsonb, text, text) to service_role;

-- WhatsApp click-to-chat audit trail (requirement E.6). Records only that
-- staff opened the pre-filled compose window — opening the link is not
-- proof the message was sent (requirement C.7/D), so this is "staff
-- triggered the confirmation flow for this order," not "message
-- delivered." Gives the future official-API integration (Phase 10's
-- architecture notes, not implemented here) a natural place to record
-- real send/delivery events later without a schema change.
create table public.order_whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  channel text not null default 'click_to_chat' check (channel in ('click_to_chat')),
  triggered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.order_whatsapp_log is 'Audit trail of the manual click-to-chat action only — not a delivery/read receipt. See requirement D for the planned future official-API extension point.';

create index order_whatsapp_log_order_id_idx on public.order_whatsapp_log (order_id);

alter table public.order_whatsapp_log enable row level security;

create policy order_whatsapp_log_select_staff
  on public.order_whatsapp_log
  for select
  to authenticated
  using (public.is_staff());

create policy order_whatsapp_log_insert_staff
  on public.order_whatsapp_log
  for insert
  to authenticated
  with check (public.is_staff());

revoke all on public.order_whatsapp_log from anon;

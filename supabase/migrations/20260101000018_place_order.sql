-- The one transactional, server-validated path to create an order.
--
-- service_role only, called from the checkout API route with a
-- customer_id taken from that route's own verified session — never from
-- the request body. Takes no price/subtotal/total from the caller at
-- all; every amount is computed here from current `products` rows and
-- `shop_settings`.
--
-- Being a single PL/pgSQL function call, this runs as one statement in
-- one implicit transaction: any `raise exception` anywhere below —
-- unavailable item, below minimum order, outside service area — undoes
-- everything this call has done so far, including stock already
-- decremented earlier in the same loop. That's what satisfies "failed
-- checkout does not leave partial orders" and "no accidental stock
-- decrement for a rejected order" at the same time.

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
  v_distance_km numeric;
  v_order public.orders;
  v_snapshot jsonb := '[]'::jsonb;
begin
  if p_customer_id is null then
    raise exception 'p_customer_id is required';
  end if;

  -- Idempotent replay: the same key for the same customer returns the
  -- order already created by the first call instead of making another
  -- one. This is what stops a double-click (or a client retry after a
  -- slow/ambiguous response) from creating two orders.
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

    -- Atomic, race-safe revalidation + stock decrement in one statement:
    -- re-checks is_active/is_available/stock_quantity against their
    -- *current* values (not whatever the client last saw) under the
    -- row's own lock. Zero rows matched = unavailable right now, however
    -- it looked a moment ago. PL/pgSQL sets the INTO targets to NULL
    -- automatically when a RETURNING query matches no rows (no manual
    -- reset needed), so checking v_product_name below is sufficient.
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

  insert into public.orders (
    customer_id, subtotal, delivery_fee,
    delivery_address_id, delivery_address_line, delivery_landmark,
    delivery_latitude, delivery_longitude, delivery_instructions,
    idempotency_key
  ) values (
    p_customer_id, v_subtotal, v_settings.delivery_fee,
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

comment on function public.place_order(uuid, uuid, jsonb, text, text) is
  'The only way an order is created. service_role only. p_customer_id must come from the caller''s own verified session, never the request body.';

revoke all on function public.place_order(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.place_order(uuid, uuid, jsonb, text, text) to service_role;

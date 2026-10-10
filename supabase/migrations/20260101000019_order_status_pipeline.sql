-- Phase 6: the richer order-status pipeline customer tracking needs, plus
-- customer-initiated cancellation with a configurable, admin-controlled
-- cutoff.
--
-- Status vocabulary changes from Phase 2's (pending, confirmed, preparing,
-- dispatched, delivered, cancelled) to (pending, confirmed, preparing,
-- ready, out_for_delivery, delivered, cancelled) — "dispatched" is split
-- into "ready" (food ready, not yet left) and "out_for_delivery" (actually
-- en route), which is what a customer-facing timeline needs to be useful.
-- Any existing row with the old 'dispatched' value is mapped to
-- 'out_for_delivery' (the closer equivalent) before the constraint
-- changes, so this is safe to run even if real orders already exist.

update public.orders set status = 'out_for_delivery' where status = 'dispatched';

alter table public.orders drop constraint orders_status_valid;
alter table public.orders add constraint orders_status_valid check (
  status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')
);

-- Replaces Phase 2's transition map with the new pipeline. Cancellation
-- is still only reachable from a non-terminal, pre-dispatch state at the
-- database level (pending/confirmed/preparing/ready) — once
-- out_for_delivery, the only legal next step is delivered, same principle
-- as before (a rider already left; cancelling the database row doesn't
-- stop that). This function is `create or replace`, so the existing
-- `orders_enforce_status_transition` trigger picks up the new behavior
-- without needing to be recreated.
create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status in ('delivered', 'cancelled') then
    raise exception 'Order % is in a terminal state (%) and cannot be changed', old.id, old.status;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or
    (old.status = 'confirmed' and new.status in ('preparing', 'cancelled')) or
    (old.status = 'preparing' and new.status in ('ready', 'cancelled')) or
    (old.status = 'ready' and new.status in ('out_for_delivery', 'cancelled')) or
    (old.status = 'out_for_delivery' and new.status = 'delivered')
  ) then
    raise exception 'Illegal order status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

-- Configurable business rule for customer self-cancellation: which
-- statuses a customer may cancel from, admin-editable (see
-- /admin/settings). The <@ check keeps it from ever being misconfigured
-- to allow cancelling an order that's already out for delivery or past
-- it — that's deliberately not in the allowed set at all, not just the
-- default.
alter table public.shop_settings
  add column customer_cancellable_statuses text[] not null default array['pending', 'confirmed'],
  add constraint shop_settings_cancellable_statuses_valid check (
    customer_cancellable_statuses <@ array['pending', 'confirmed', 'preparing', 'ready']::text[]
  );

create or replace function public.cancel_my_order(
  p_customer_id uuid,
  p_order_id uuid,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_allowed_statuses text[];
begin
  select * into v_order
  from public.orders
  where id = p_order_id and customer_id = p_customer_id;

  if v_order.id is null then
    raise exception 'order_not_found';
  end if;

  select customer_cancellable_statuses into v_allowed_statuses
  from public.shop_settings
  limit 1;

  if not (v_order.status = any(v_allowed_statuses)) then
    raise exception 'cancellation_not_allowed';
  end if;

  -- The shared enforce_order_status_transition() trigger still runs on
  -- this UPDATE and independently confirms cancelling is legal from this
  -- status — this function's own check above is a stricter business-rule
  -- gate on top of that general transition legality, not a replacement
  -- for it.
  update public.orders
    set status = 'cancelled',
        cancelled_reason = coalesce(p_reason, 'Cancelled by customer')
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

comment on function public.cancel_my_order(uuid, uuid, text) is
  'Customer self-service cancellation, gated by shop_settings.customer_cancellable_statuses. service_role only; p_customer_id must come from the caller''s own verified session.';

revoke all on function public.cancel_my_order(uuid, uuid, text) from public;
grant execute on function public.cancel_my_order(uuid, uuid, text) to service_role;

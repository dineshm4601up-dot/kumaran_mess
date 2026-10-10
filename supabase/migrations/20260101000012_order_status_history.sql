-- Append-only audit trail of every order status change (requirement 15),
-- plus the trigger that actually validates a transition is legal before
-- it is allowed to happen, and the trigger that records it afterwards.
--
-- Both trigger functions are attached to `orders` even though that table
-- was created in 0010 — ALTER/CREATE TRIGGER on an existing table from a
-- later migration is normal. They are kept here because they only make
-- sense alongside the history table they populate.

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.order_status_history is 'Immutable audit log, written only by the log_order_status_change() trigger — never directly.';

create index order_status_history_order_id_idx on public.order_status_history (order_id);
create index order_status_history_created_at_idx on public.order_status_history (created_at);

create trigger order_status_history_set_updated_at
  before update on public.order_status_history
  for each row
  execute function public.set_updated_at();

alter table public.order_status_history enable row level security;

create policy order_status_history_select_own
  on public.order_status_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and o.customer_id = auth.uid()
    )
  );

create policy order_status_history_select_staff
  on public.order_status_history
  for select
  to authenticated
  using (public.is_staff());

-- No write grants at all: rows only ever appear via the trigger below,
-- which is SECURITY DEFINER and therefore unaffected by this revoke.
revoke all on public.order_status_history from anon, authenticated;
grant select on public.order_status_history to authenticated;

-- Legal transition map. pending -> confirmed/cancelled, confirmed ->
-- preparing/cancelled, preparing -> dispatched/cancelled, dispatched ->
-- delivered only (no cancelling once dispatched). delivered/cancelled are
-- terminal. A no-op update (status unchanged) is always allowed, since
-- other columns on the same row (payment_status, cancelled_reason) can
-- change independently.
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
    (old.status = 'preparing' and new.status in ('dispatched', 'cancelled')) or
    (old.status = 'dispatched' and new.status = 'delivered')
  ) then
    raise exception 'Illegal order status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger orders_enforce_status_transition
  before update on public.orders
  for each row
  execute function public.enforce_order_status_transition();

-- SECURITY DEFINER so it can write into order_status_history despite that
-- table granting no write privileges to anon/authenticated. auth.uid()
-- inside a SECURITY DEFINER function still resolves to the real caller
-- (it reads the request JWT claims, which SECURITY DEFINER does not
-- change), so changed_by correctly records who made the change.
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (new.id, null, new.status, auth.uid(), 'Order created');
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_log_status_change
  after insert or update on public.orders
  for each row
  execute function public.log_order_status_change();

-- Generic trigger function used by every table below to maintain
-- updated_at automatically. Has no dependency on any application table,
-- so it is safe to create first.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at with the current time on every row update.';

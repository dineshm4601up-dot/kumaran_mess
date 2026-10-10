-- Registration (Phase 3) collects a plain-text delivery address, but the
-- map-pin UI (Leaflet, a later phase per the project plan) doesn't exist
-- yet, so there is no real latitude/longitude to store at registration
-- time. Rather than writing a fake (0, 0) coordinate pair into Phase 2's
-- NOT NULL columns, this makes them nullable — the range CHECK
-- constraints still apply whenever a value IS present. The map-pin phase
-- should require coordinates for newly-created/edited addresses at the
-- application layer; this migration only removes the blanket NOT NULL.

alter table public.customer_addresses
  alter column latitude drop not null,
  alter column longitude drop not null;

# Kumaran Mess — Project Progress

## Status: Phase 9 complete (production-readiness audit & deployment prep) — **not yet deployed, not yet unconditionally production-ready; see verdict below**

## Stack
- Next.js 16.4.0 (App Router, Turbopack)
- React 19.3.0, TypeScript 5 (strict)
- Tailwind CSS 4
- ESLint 9 (`eslint-config-next`)
- Leaflet + react-leaflet 5 (map-based address picker), geocoding via a provider-agnostic adapter
  (Nominatim by default, LocationIQ as the production-ready option) — see Phase 5 below.
- Supabase Postgres + Storage: menu, admin product/category management, and now checkout/order placement
  are all real, live-queried/validated data.

## What's done

### Phase 1 — Project setup & responsive UI foundation
- Scaffolded via `create-next-app` (TypeScript, Tailwind, ESLint, App Router, `src/` dir, `@/*` alias).
- Disabled `cacheComponents` / `partialPrefetching` in `next.config.ts` — the app will be dominated by
  per-request session data (auth cookies, cart, orders) from Phase 2 onward, which is simpler under
  standard dynamic rendering than under Next 16's cache-by-default model. See the comment in
  `next.config.ts`.
- Warm bakery/mess design system defined as CSS variables in `src/app/globals.css` (primary/accent/surface/
  border/status colors, light + dark mode), consumed via Tailwind v4's `@theme inline`.
- Route structure:
  - `src/app/(site)/*` — customer-facing pages, wrapped in `src/app/(site)/layout.tsx` (Header + Footer +
    an in-memory `CartProvider`).
  - `src/app/admin/(auth)/login` — standalone admin login, no dashboard chrome.
  - `src/app/admin/(dashboard)/*` — admin dashboard, products, orders, wrapped in their own layout with a
    sidebar (desktop) / horizontal nav (mobile).
  - Root `src/app/layout.tsx` is intentionally minimal (fonts, `<html>`/`<body>` only) so admin routes don't
    inherit the public header/footer.
- Pages created (all placeholders, see "Explicitly not implemented" below): Home, Menu, Cart, Register,
  Login, Checkout, Order tracking, Admin login, Admin dashboard, Admin products, Admin orders.
- Reusable components: `Button`, `InputField`/`TextAreaField`/`SelectField`, `PriceDisplay`, `Badge`/
  `OrderStatusBadge`, `Spinner`, `Skeleton`/`ProductCardSkeleton`, `EmptyState`, `InfoBanner`,
  `ProductCard`, `CategoryTabs`, `QuantityStepper`, admin `AdminNav`/`AdminTopbar`/`StatCard`.
- Demo data (`src/lib/demo-data.ts`) — explicitly commented as static, in-memory, UI-preview-only data.
  Not fetched from or written to any database. Demo product images are generated local SVGs in
  `public/demo/`.
- Cart is a real but **in-memory, client-only** React context (`src/lib/cart-context.tsx`) — adding items on
  Home/Menu and viewing/editing them on Cart/Checkout actually works, but nothing persists across a reload
  and nothing is sent anywhere.
- `.env.example` created with variable names only (Supabase, OTP/SMS provider, geocoding provider, site
  URL). No real secrets anywhere in the repo.

### Explicitly not implemented (per instructions)
- No real authentication. Register/Login/Admin login forms validate input client-side and show a loading
  state, then display an inline "not connected yet" notice — they do not create accounts, verify OTP, issue
  sessions, or store a PIN anywhere.
- No database reads/writes. All product/category/order data on every page is the static demo data.
- No real checkout. "Place Order (COD)" validates the address field, shows a loading state, then shows a
  "not connected yet" notice. No order number is generated, no order is stored.
- No map/geocoding UI yet (address is a plain textarea with a note that pin-drop comes later).
- Admin dashboard routes (`/admin`, `/admin/products`, `/admin/orders`) are **not access-controlled** —
  there is no auth guard yet, so they are reachable by anyone who knows the URL. This is acceptable only
  because they currently show demo data with no real reads/writes; it must be locked down before any real
  data touches these routes.

### Phase 2 — Supabase database, migrations & security
- 12 version-controlled migrations in `supabase/migrations/` (timestamp-prefixed, apply in order): extensions,
  a generic `updated_at` trigger, `staff_users` + role-check helpers (`is_staff()`/`is_admin()`) +
  provisioning functions, `categories`, `products`, `customer_profiles` (+ `register_customer_profile()`),
  `customer_addresses`, `orders` (+ order-number generation, generated `total` column), `order_items`
  (price/name snapshots), `order_status_history` (+ transition-validation and audit-logging triggers).
- RLS is enabled on every table. Public (anon) can read active categories and available products only.
  Customers can read/update only their own profile (full_name/email only — phone/pin_hash are excluded from
  the update grant), manage their own address book fully, and read (not write) their own orders/order
  items/status history. Staff can read everything and change order `status`/`payment_status`/
  `cancelled_reason` only (never totals, customer, or order number — `total` is a generated column, so it's
  structurally impossible to set directly). Status changes must follow a legal transition map enforced by a
  trigger (`pending → confirmed/cancelled → preparing/cancelled → dispatched/cancelled → delivered`, with
  `delivered`/`cancelled` terminal); every change is logged to `order_status_history` automatically.
- `staff_users` has no self-service write path at all — rows can only be created/changed via
  `provision_staff()`/`deactivate_staff()`, both of which require the caller to already be an active admin.
  The very first admin is a one-time manual SQL Editor step (`supabase/docs/SETUP.md`), by design — there is
  no bootstrap-when-empty shortcut, to avoid a race-condition self-promotion window.
- Customer PINs: `register_customer_profile()` is the only way `pin_hash` is ever written, hashing
  server-side with pgcrypto (`crypt()`/`gen_salt('bf')`) — the Next.js layer never sees or sends a hash, and
  a CHECK constraint on the column's format is a second guard against ever storing something that isn't a
  bcrypt hash. The function also cross-checks the submitted phone number against the phone Supabase Auth
  actually verified for that session, so a caller can't register someone else's unverified number.
- `supabase/seed.sql` — optional, dev-only sample categories/products mirroring the Phase 1 demo data (not
  a migration; not for production).
- `supabase/docs/SETUP.md` — how to apply the migrations (CLI and manual SQL Editor paths), the first-admin
  bootstrap step, and a list of open design questions for the next phase.
- `supabase/docs/TESTING.md` — a documented, copy-pasteable unauthorized-access test script (fixtures +
  per-assertion blocks + cleanup) covering anon/customer/staff/cross-customer access and the status-
  transition trigger.

#### Explicitly deferred (per instructions — no customer UI integration this phase)
- No customer-facing way to create an order yet. Placing an order safely needs a function that revalidates
  stock and current prices server-side (never trusting a client-submitted price/total); that's checkout
  business logic for a later phase, not schema. Until it exists, `orders`/`order_items` can only be written
  by the service role.
- PIN login rate-limiting is schema-only. `pin_failed_attempts`/`pin_locked_until` exist on
  `customer_profiles`, but nothing increments or checks them yet — that needs to be designed together with
  how a session actually gets issued after a successful PIN check (see "Open design questions" below).
- No Next.js code talks to Supabase yet (no `@supabase/supabase-js`/`@supabase/ssr`, no server/browser
  client setup, no env vars actually read). That's the next integration phase.

### Phase 4 — Menu & admin product management connected to Supabase

**Two new migrations** (apply after Phase 3's fourteen, in order):
- `20260101000015_product_catalog_enhancements.sql` — renames `products.image_url` → `image_path` (it
  never held a URL, only ever local demo SVGs — now its real contract is explicit: a Storage path, never
  a client-submitted URL); adds `is_featured`/`display_order`; and **resolves Phase 2's open question**
  by dropping `is_available` from the public SELECT policy (`products_select_available_public` →
  `products_select_active_public`) — the menu now shows out-of-stock items (greyed out), not hides them,
  per this phase's explicit requirement. There's nothing confidential about an unavailable product's name
  or price.
- `20260101000016_product_images_storage.sql` — creates the `product-images` Storage bucket (public read,
  since product photos aren't sensitive; `file_size_limit`/`allowed_mime_types` set at the bucket level as
  a second enforcement layer behind the app's own validation) and RLS on `storage.objects` restricting
  writes to `is_staff()`, mirroring every other staff-only table.

**Customer menu** (`/menu`, and the homepage's featured section): now a real Supabase query via a new
anon-key client (`src/lib/supabase/public.ts`) — no session needed, relies entirely on Phase 2/4's RLS.
Search/filter stays client-side over the fetched set (small catalog, no need for server-side search). Two
distinct empty states: "nothing on the menu at all yet" vs. "no results for this search/filter."

**Admin product & category management**: real CRUD, not demo data.
- `/admin/categories` (+ `new`/`[id]/edit`) and `/admin/products` (+ `new`/`[id]/edit`) — list pages fetch
  directly with the service-role client (the dashboard layout already gated access via `is_staff()`);
  forms POST/PATCH to new `/api/admin/categories[/[id]]` and `/api/admin/products[/[id]]` routes, each
  re-checking `getStaffContext()` server-side before touching anything (the same pattern as every Phase 3
  admin action — DB-level RLS also independently blocks non-staff on these tables regardless).
- Product images: `/api/admin/products/[id]/image` (`POST` upload/replace, `DELETE` remove). Every upload
  is validated server-side twice — declared `Content-Type` + size against an allowlist, **and** the
  actual file bytes sniffed against known JPEG/PNG/WEBP signatures (`src/lib/validation/image.ts`), so a
  renamed/mislabeled file is rejected even if its `Content-Type` header lied. A fresh random filename is
  generated per upload (`products/<id>/<uuid>.<ext>`); replacing an image uploads the new file and updates
  the DB row *before* deleting the old file, so a mid-request failure never leaves the product pointing at
  nothing — worst case is one orphaned file, logged, not a broken product.
- `is_featured`/`display_order` drive the homepage's featured section and both the admin and customer
  listing order.

**Why existing orders are unaffected by product edits** (acceptance criterion): this was already true by
construction from Phase 2 — `order_items` snapshots `product_name`/`product_price` at order time and never
reads live product rows again. Phase 4 doesn't change that; the admin product-edit route comments on it
explicitly so it isn't "accidentally" broken by someone adding a live join later.

#### Explicitly out of scope this phase
- Orders/checkout/admin dashboard still show Phase 1's demo data (`DEMO_ORDERS`) — untouched, not this
  phase's job. `demo-data.ts` had its now-unused `DEMO_CATEGORIES`/`DEMO_PRODUCTS` removed (they no longer
  matched the updated `Product`/`Category` types and nothing read them anymore).
- No hard product delete — only Phase 4's explicit list (create/edit/availability/featured/display order)
  was built. "Deactivate" is covered by the existing `is_active` toggle in the edit form.
- No bulk operations, no image cropping/resizing, no CDN cache invalidation handling beyond what Supabase
  Storage's public bucket already does.

### Phase 5 — Cart, delivery address & checkout

**Two new migrations**:
- `20260101000017_shop_settings_and_idempotency.sql` — `shop_settings` (singleton row: delivery fee,
  minimum order amount, optional service radius + store coordinates — radius enforcement only activates
  once *all three* of radius/base-lat/base-lon are set, matching "if configured"), a partial unique index
  on `orders.idempotency_key` (NULL-safe — doesn't collide with rows that never set one), and a
  `haversine_km()` helper.
- `20260101000018_place_order.sql` — `place_order()`, the single transactional, server-validated path to
  create an order. service_role only; takes a customer id that the caller must have already verified
  (never trusted from a request body), item product ids/quantities, an idempotency key, and nothing else —
  no price, subtotal, or total parameter exists for a client to supply.

**How `place_order()` satisfies the acceptance criteria, mechanically**:
- *Invalid/unavailable/manipulated items are rejected*: each item is processed with one atomic
  `UPDATE products SET stock_quantity = stock_quantity - qty WHERE ... AND is_active AND is_available AND
  stock_quantity >= qty RETURNING ...` — this re-checks current availability and decrements stock in the
  same statement, under that row's own lock, so it can't be fooled by stale client-side state or raced by
  a concurrent order for the same last unit. Zero rows matched = reject.
  - *Failed checkout leaves no partial orders*: being one PL/pgSQL function call, it all runs in one
  implicit transaction — any `raise exception` (bad item, below minimum, outside service area) undoes
  everything done so far in that call, including stock already decremented earlier in the same loop.
  - *Double-click doesn't duplicate orders*: `idempotency_key` is generated once per checkout page load
  (client-side, `useState(() => crypto.randomUUID())`) and sent with every placement attempt from that
  load; the function checks for an existing order with that key + customer first and returns it unchanged
  instead of creating a second one.
  - *Server-side pricing*: subtotal is summed from the `price` each `UPDATE ... RETURNING` call actually
  found at that moment, not anything the client sent. `orders.total` is still the Phase 2 generated column
  (`subtotal + delivery_fee`).
  - *Service radius / minimum order, if configured*: delivery fee and minimum order always apply; the
  radius check (`haversine_km()` between the store's coordinates and the address's) only runs when both
  are configured, and rejects with a distinct `address_location_required` error if the chosen address has
  no pinned coordinates to check against.

**Cart**: persisted to `localStorage` (`src/lib/cart-context.tsx`) — hydrates after mount (not during SSR,
to avoid a hydration mismatch) and writes on every change. This is deliberately client-side-only, not a
`cart_items` table: carts are a convenience, and checkout revalidates everything against the live database
regardless of what's cached. Checkout re-fetches current product data for every cart line on load and
flags (with a one-click remove) anything now inactive, unavailable, or short on stock — the UX half of
"revalidate before checkout"; `place_order()`'s atomic per-item check is the half that's actually
enforced.

**Delivery address**: prefills the customer's saved default address on checkout; "Edit" reveals a form
(`AddressForm` + `LocationPicker`) to change it or add a new one. The map (`LocationPicker`/`LeafletMap`,
Leaflet + react-leaflet 5, dynamically imported with `ssr: false` since Leaflet needs `window`) supports
searching an address (via the geocoding adapter), clicking/dragging a pin, or "use my current location" —
which only calls `navigator.geolocation.getCurrentPosition` on an explicit button click, never
automatically, so the browser's native permission prompt only appears when the customer asks for it. GPS
coordinates are never auto-written into the address text and the UI explicitly says the pin is a starting
point to confirm, not an assumed exact address. Address text (and landmark) can always be filled in
manually with no pin at all — coordinates stay optional (nullable since Phase 3's migration 0014) unless a
service radius is configured, in which case both the UI and `place_order()` itself require one.

**Geocoding provider** (`src/lib/geocoding/geocode.ts`, same provider-agnostic-adapter pattern as the
Phase 3 SMS adapter): defaults to the public Nominatim instance (free, no key, but explicitly documented
as NOT for production volume — 1 request/sec limit, no heavy/automated use, requires a descriptive
User-Agent per its usage policy at operations.osmfoundation.org/policies/nominatim — which is itself why
this has to be a server-side route, since browsers refuse to let JS override that header). LocationIQ is
implemented as the concrete production-ready alternative (`GEOCODING_PROVIDER=locationiq` +
`LOCATIONIQ_API_KEY`) — check its current pricing/limits before relying on it. **Verified live** against
the real Nominatim endpoint during this phase (see below) — this is the one piece of Phase 5 actually
confirmed working end-to-end before the user runs anything.

**Checkout**: requires a customer session (redirects to `/login?next=/checkout`, same pattern as
`/orders`); shows items/quantities/subtotal/delivery fee/total (delivery fee from `shop_settings`, read
publicly since none of it is sensitive); COD-only (no payment method UI exists, matching the schema's
hard constraint); "Place Order" posts to `/api/checkout/place-order`, which resolves `customer_id` from
the verified session — never the request body — before calling `place_order()`.

**Admin**: a minimal `/admin/settings` page to edit delivery fee / minimum order / service radius / store
coordinates — added because otherwise `shop_settings` would be permanently stuck at its seeded defaults
with no way to configure it; kept to one plain form, nothing beyond what checkout's validation needs.

#### Explicitly out of scope / deferred this phase
- No "multiple saved addresses with a picker" UI — one default address, editable, matching "prefill...
  allow adding or editing" read literally rather than a full address-book feature.
- No reverse geocoding (coordinates → address text) — only forward search (text → coordinates) was asked
  for; lat/lng are displayed numerically instead, as specified.
- Admin orders/dashboard still show Phase 1's demo data — order *viewing*/status-management wiring is a
  separate next step from order *placement*, which is what this phase built.
- No sliding/absolute cap on how old an idempotency key can be reused — in practice it's scoped to one
  page load's lifetime by how the client generates it, but nothing server-side enforces an expiry on it.

### Phase 6 — Customer orders & order tracking

**One new migration** (`20260101000019_order_status_pipeline.sql`), and it's a real breaking schema
change the task required: the status vocabulary moved from Phase 2's `(pending, confirmed, preparing,
dispatched, delivered, cancelled)` to `(pending, confirmed, preparing, ready, out_for_delivery, delivered,
cancelled)` — `dispatched` splits into `ready` (cooked, not yet left) and `out_for_delivery` (actually en
route), which is what a customer-facing timeline needs to be useful. Any existing `dispatched` row is
remapped to `out_for_delivery` before the constraint changes, so this is safe even if real orders already
exist. `enforce_order_status_transition()` (Phase 2's trigger) is `create or replace`d with the new
pipeline's legal-transition map — cancellation is only reachable from `pending`/`confirmed`/`preparing`/
`ready`; once `out_for_delivery`, the only legal next step is `delivered`.

**Customer self-cancellation** (`cancel_my_order()`, service_role only, same pattern as every other
customer-facing RPC — `p_customer_id` comes from the caller's verified session, not the request body):
gated by a new, genuinely admin-configurable `shop_settings.customer_cancellable_statuses` (a CHECK
constraint keeps it from ever including `out_for_delivery`/`delivered`/`cancelled`, regardless of how
it's configured — added to `/admin/settings` as a set of checkboxes). The function re-checks ownership and
the configured cutoff independently of the shared trigger's general transition legality — two layered
checks, not one doing both jobs. `cancelled_reason` is recorded (defaults to "Cancelled by customer" if
none given).

**Pages**: `/orders` (enhanced — real status badges, totals, links to detail) and a new `/orders/[id]`
showing the order number, full item snapshot (name/price/qty from `order_items`, immune to later product
edits — unchanged from Phase 2's design, just now actually displayed), subtotal/delivery fee/total, COD
payment status, a status timeline built from `order_status_history`, and a cancel button when the
`shop_settings`-configured cutoff allows it. Cancelled orders show the reason prominently; delivered
orders show a clear completion message and stop polling (see below) — both are terminal, nothing to watch
for anymore.

**"Appropriate refresh", chosen deliberately over Supabase Realtime**: the order detail page polls
`GET /api/orders/[id]` every 20 seconds while the order is non-terminal, not a WebSocket subscription.
Supabase Realtime's Postgres Changes feed is gated by the same RLS policies as the REST API, which
requires a real Supabase JWT identifying the viewer — but customers in this app never hold one (the whole
point of the custom session architecture since Phase 3). A browser-side Realtime subscription would have
no session to satisfy that RLS check with. Polling a same-origin route that re-verifies the session
server-side on every call is the mechanism that actually fits this architecture, not a workaround for
lacking something better.

**Security, satisfied by explicit scoping, not obscurity**: `orders.id` was already a `gen_random_uuid()`
(never sequential) since Phase 2, but the real guarantee is that every query — the list page, the detail
page, the cancel RPC — filters by `customer_id = <this session's own id>` explicitly. **Verified live**:
registered two disposable test customers, inserted a test order for the first (directly, since
`place_order()` isn't applied yet — see below), confirmed the first customer's `/orders` and
`/orders/[id]` render it correctly (order number, item, total, status timeline all real), confirmed an
unauthenticated request redirects to login, and confirmed the **second** customer's session hitting the
exact same order UUID via `/api/orders/[id]` gets `{"error":"not_found"}` — not the order, not a
different error that would reveal it exists. This is the acceptance criterion ("another customer cannot
access the order by guessing its ID") confirmed with a real second account against a real UUID, not just
reasoned about.

**No public order-number + phone tracking was built.** The task made this conditional ("if ... offered")
and explicitly preferred authenticated history; building it would have meant a rate limiter, a
verification mechanism (realistically another OTP flow), and careful redaction of what an unauthenticated
visitor can see — real work for a feature that was optional and de-prioritized by the task's own wording.
Deliberately not built this phase, not an oversight.

#### Explicitly out of scope / deferred this phase
- No admin UI to actually move an order through the new statuses yet — `/admin/orders` still shows Phase
  1's demo data (unaffected by this phase, consistent with the Phase 5 roadmap note that this is the next
  phase's job). In practice, until that exists, a real order placed through Phase 5's checkout stays
  `pending` forever unless advanced directly in the database.
- `changed_by` on a customer self-cancellation's `order_status_history` row is `NULL` (the logging trigger
  reads `auth.uid()`, which is unset in this service-role-driven call, same as every other service-role
  path) — the cancellation and its reason are still fully recorded, just not explicitly attributed to
  "customer" vs. "staff" in that one column. Judged not worth a cross-function actor-passing mechanism for
  this phase.
- No automated tests; the live verification above was manual, via `curl` against the real project.

### Phase 7 — Shop-owner/staff dashboard

**One new migration** (`20260101000020_admin_order_management.sql`): two new `orders` columns
(`payment_updated_at`, `payment_updated_by`) giving COD collection its own, separate audit trail from the
delivery-status timeline; `admin_search_orders()` (order number / customer name / phone search, a plain
SQL join rather than fighting PostgREST's embedded-resource filter syntax for an OR across two tables);
`admin_dashboard_stats()` (five aggregate numbers, "today" computed explicitly in `Asia/Kolkata` rather
than the database server's own timezone, with exact definitions below). **No new RPC for status/payment/
cancel changes** — those go through a plain `UPDATE` using the *staff member's own authenticated Supabase
session*, not the `service_role` client this project otherwise uses for admin writes everywhere else.
That's a deliberate, one-off exception: `order_status_history.changed_by` resolves from `auth.uid()` in
Phase 2's existing trigger, which only has a real value when the actual staff member's session performs
the write — a `service_role` call would leave it `NULL`, same gap already accepted for customer
self-cancellation. Everything else (products, categories, settings) stays on `service_role`, unchanged.

**Dashboard metrics, defined precisely** (the task asked for "clearly defined" statuses, so stating them
exactly rather than leaving them implicit):
- *Today's Orders*: every order placed today, any status.
- *Today's Sales*: sum of `total` for orders placed today, **excluding cancelled** — a cancelled order
  isn't revenue.
- *Pending & Active*: orders currently in any non-terminal status, regardless of when placed.
- *Delivered Today* / *Cancelled Today*: orders that **reached** that status today (by `updated_at`), not
  necessarily placed today.

**Order management** (`/admin/orders` list with search, `/admin/orders/[id]` detail): status-advance
buttons only ever show the legal next action(s) for the current status (`src/lib/order-transitions.ts`,
a UI-hint mirror of the database trigger — the trigger remains the actual enforcement, so a mismatch
there fails safe into a rejected request, never an illegal write); a staff cancel action, separately
authorized from the customer's own `cancel_my_order()` and not limited by `shop_settings.
customer_cancellable_statuses` (staff may cancel from any non-terminal status — that setting only governs
customer self-service); a read-only map (the existing `LeafletMap` component, now with a `readOnly` prop
added) plus an "Open in navigation app" link using Google Maps' `dir/?api=1&destination=lat,lon` — raw
coordinates, not an address lookup, so it opens the customer's actual pinned point even where no address
matches it; and a status timeline resolving `changed_by`/`payment_updated_by` to staff names via a small
join against `staff_users`.

**"COD collection and delivery status remain distinct"**, enforced at more than one layer: separate
columns (`payment_status` vs `status`), separate API routes (`/api/admin/orders/[id]/payment` vs
`/status`), separate UI sections and buttons, and separate audit columns
(`payment_updated_at`/`payment_updated_by` vs `order_status_history`). Marking an order delivered never
touches payment fields and vice versa — there's no code path where one action affects the other.

**"Do not allow staff to change prices on an existing order"**: there is no price-adjustment action
anywhere in this phase's UI or API, and there structurally can't be one by accident — `order_items` still
has zero write grants to `authenticated` from Phase 2 (only `place_order()`'s `service_role` bypass can
ever write it), and the staff column-grant on `orders` only ever covered
`status`/`payment_status`/`cancelled_reason`(+ this phase's two payment-audit columns) — `subtotal`/
`total`/`delivery_fee` were never grantable to `authenticated` at all. The order detail page says this
explicitly rather than leaving it implicit.

**"Never expose customer details to the public menu"**: checked, not just assumed — `/menu` and the
homepage query only `categories`/`products` via the anon-key public client
(`src/lib/supabase/public.ts`), which has no access to `customer_profiles`/`orders` regardless (Phase 2's
RLS denies it to `anon` outright). Nothing in this phase touches that read path.

**Verified live** (working around the still-unapplied migration, same approach as Phases 5/6): confirmed
`admin_dashboard_stats()`/`admin_search_orders()` are genuinely absent from the live schema (the build
itself surfaced this — `/admin`'s page tried calling them during Next's build-time page-data collection
and got real `PGRST202` errors back, caught and logged rather than crashing the build); confirmed
`/admin/orders`, `/admin/orders/[id]`, and all three new `/api/admin/orders/[id]/*` routes correctly
reject a request with **no session** (307/403); and — going further than that — confirmed they **also**
reject a request from a **real, logged-in customer session** (registered a disposable test customer,
hit every new admin route with their session cookie, got 403/307 every time). That specifically exercises
"a customer session cannot reach admin endpoints," not just "an anonymous visitor can't."

#### Explicitly out of scope / deferred this phase
- **Migrations 0017–0020 are still not applied to the live project** — none of checkout, order placement,
  customer cancellation, or now staff order management has been exercised through its real RPC/UPDATE
  path yet.

  **Update from Phase 9: this is now resolved.** All 20 migrations are confirmed applied to the live
  project, and the full order lifecycle (`place_order()`, idempotency, `cancel_my_order()`, staff status
  transitions, COD collection) was exercised live with real disposable test fixtures — see
  `docs/PRODUCTION_READINESS.md` for the complete list of what was tested and how. The two real customer
  accounts/orders already in the project (from the user's own earlier testing) were left untouched.
- No bulk actions (e.g. "mark all ready orders as out for delivery" in one click) — each order is managed
  individually, matching the task's action list literally.
- No price-adjustment workflow was built (deliberately — see above); if one is ever wanted, it needs its
  own explicit design (likely a staff-authorized "add adjustment line" rather than editing the locked
  snapshot), not a loosening of the current grants.

### Phase 9 — Production-readiness audit & deployment prep

No new features this phase — an audit of everything built so far, two real fixes it surfaced, and the
deployment paperwork. Full detail lives in three new docs rather than duplicated here:

- **`docs/PRODUCTION_READINESS.md`** — the security review (RLS, API authz, service-role-key bundle check,
  rate limiting, upload validation, log audit, `npm audit`) and the complete live test run (registration,
  login/lockout, PIN recovery, checkout rejection cases, idempotency, customer isolation, the full admin
  order-status pipeline with staff attribution, COD collection, image upload/replace/remove) — including
  an explicit "not verified" section (mobile/accessibility/real deployment/real SMS/real concurrent load)
  and cost estimates for Supabase/Vercel/Twilio/LocationIQ.
- **`docs/DEPLOYMENT.md`** — environment variable names, migration/bucket/admin-bootstrap steps, the
  Vercel deployment steps (which I cannot execute myself — no Vercel access from this sandbox), production
  auth-redirect configuration, and rollback guidance.
- **`docs/FINAL_TESTING_CHECKLIST.md`** — every item above marked `[verified]`, plus everything that
  still needs a human with a real browser/phone (explicitly not something this sandbox can do).

**Two real bugs fixed, found by actually exercising the app, not by review:**
1. The dev-mode `console` SMS adapter logs the raw OTP code — correct for local dev, but a real leak risk
   if `SMS_PROVIDER` were ever left unconfigured in production (server logs are typically visible to more
   people than the app's own data is). Now refuses to log (and fails the send) when `NODE_ENV=production`.
2. Staff cancelling an order that's already `out_for_delivery` hit an "Illegal order status transition"
   error the cancel route didn't recognize (it only checked for "terminal state"), producing a confusing
   500 instead of a clean rejection. Fixed to recognize both.

Also fixed: the admin product-image file input had no accessible name (no `label`, no `aria-label`) —
found by an accessibility-focused code sweep, not a visual test (none was possible here).

**Explicitly not done, and said so rather than claimed otherwise:** no actual Vercel deployment, no real
SMS provider configured/tested, no real browser/device testing, no automated load/concurrency testing.
See `docs/PRODUCTION_READINESS.md`'s "Not verified" section for the complete, honest list.

## Environment variables (see `.env.example`)
| Variable | Used for | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase project access | **Consumed** throughout, since Phase 3. `.env.local` holds real values for a live project — see the note below. |
| `SMS_PROVIDER` | Selects the adapter in `src/lib/sms/send-sms.ts` | **Consumed.** `console` (default, dev-safe) or `twilio`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Twilio Programmable Messaging (plain SMS, not Verify) | **Consumed** when `SMS_PROVIDER=twilio`. Not yet filled in with real values. |
| `GEOCODING_PROVIDER` / `LOCATIONIQ_API_KEY` | Selects the adapter in `src/lib/geocoding/geocode.ts` | **Consumed, as of Phase 5.** `nominatim` (default, no key, verified live) or `locationiq` (needs the key, not yet filled in). |
| `NEXT_PUBLIC_SITE_URL` | Links/redirects | Not yet consumed |

`.env.local` exists in the repo root (gitignored, confirmed — never committed) with real Supabase
credentials for a live project. **These were briefly committed to the wrong file** (`.env.example`, which
*is* tracked) earlier in this phase and were immediately moved to `.env.local` and scrubbed from
`.env.example` before anything was committed to git — no secret ever reached git history. Mentioned here
so it isn't a surprise later; see the start of the Phase 3 conversation for the full detail.

## Verification performed this phase
- `npm run typecheck` (`tsc --noEmit`) — passes.
- `npm run lint` (ESLint via `eslint-config-next`) — passes, no warnings.
- `npm run build` — succeeds; all 12 routes prerender as static (`○`).
- Started `next start` and checked every route returns HTTP 200, and spot-checked rendered HTML for
  expected content (e.g. demo product names on Home/Menu/Admin Products, order numbers on Admin Orders,
  empty states on Cart/Orders).
- Note on `/menu`: it uses `useSearchParams()` (to support `?category=` links from the Home page category
  grid), which per Next.js requires a `<Suspense>` boundary. The static HTML shell for that one route
  therefore contains the `ProductCardSkeleton` loading state rather than the live grid; real content
  renders immediately on client hydration. This was verified by inspecting the build output and the
  server-rendered HTML, not by visually testing in a browser (no browser was available in this session) —
  worth a quick manual check in an actual browser to confirm the swap feels instant on a real device.
- Mobile responsiveness (header hamburger menu, admin horizontal nav, grid column counts) was built
  mobile-first with Tailwind breakpoints but was not visually verified on a real device/viewport in this
  session — recommend a manual check at common breakpoints (375px, 768px, 1280px).

## Verification performed this phase (Phase 2)
No Supabase CLI, Docker, or local Postgres was available in this sandbox, so the migrations could **not**
be executed against a real database here — that is the main gap to be aware of. What was done instead:
- Careful manual read-through of every migration for SQL/PL/pgSQL correctness, FK/dependency ordering
  (each migration only references objects created in an earlier one), and privilege logic (column-level
  `REVOKE`/`GRANT` combined with RLS `USING`/`WITH CHECK`, SECURITY DEFINER search_path pinning, and the
  `extensions` schema for pgcrypto so `crypt()`/`gen_salt()` resolve regardless of ambient `search_path`).
- Traced through the documented test script (`TESTING.md`) by hand for each assertion, including a fix for
  a real bug found this way: pasting multiple statements into one SQL Editor "Run" executes them as one
  implicit transaction, so an expected-failure statement followed by an expected-success statement in the
  same block would wrongly fail the second one too (transaction already aborted) — the script was
  restructured to one assertion per block to avoid this.
- **Not done, and needs to happen before relying on this**: actually running `SETUP.md` and `TESTING.md`
  against a real development Supabase project. Please do this and report back anything that errors —
  the most likely failure point is the `auth.users` fixture insert in `TESTING.md`, since that table's
  exact required columns vary by Supabase/Postgres version (a fallback using the dashboard's "Add user" UI
  is documented there).

## Verification performed this phase (Phase 3)
This sandbox turned out to have real network access to the live Supabase project (the credentials in
`.env.local`). After the user applied migrations 0013/0014 (confirmed by re-querying), the **entire
customer auth flow was exercised end-to-end with real HTTP requests against the actual route handlers**,
using a disposable test account (`+919876543210`) that was deleted afterward via the Admin API (cascaded to
its profile/address/sessions):
- **Registration** (no OTP, per the mid-phase change below): `POST /api/auth/register` created a real
  `auth.users` row, a `customer_profiles` row with a correctly-formatted bcrypt hash
  (`$2a$06$...`), and a `customer_addresses` row with `is_default: true` — confirmed by querying all three
  directly with the service-role key.
- **Login**: correct PIN → `{"ok":true}` + an HttpOnly `km_customer_session` cookie set; `/api/auth/me`
  correctly resolved that cookie back to the right customer.
- **Rate limiting / lockout (acceptance criterion)**: 5 cumulative wrong PIN attempts → the 5th response
  switched to `{"error":"locked","lockedUntil":...}` ~15 minutes out; the **correct** PIN was then also
  rejected with the same lockout response, exactly as designed.
- **Forgot-PIN**: request-otp for the registered number logged a real 6-digit code to the dev server
  console (confirmed by reading the log); verify with that code + a new PIN logged the user in
  immediately; the old PIN then failed and the new one worked — and critically, the lockout from the step
  above was cleared by the reset (`pin_failed_attempts`/`pin_locked_until` reset), confirmed live.
- **Logout**: cleared the cookie; `/api/auth/me` returned `{"customer":null}` afterward.
- **Admin isolation (requirement 11)**: a real customer session cookie hitting `/admin` got a 307 to
  `/admin/login` — confirmed against a real provisioned admin account found in `staff_users`.
- **A real bug was found and fixed by this live testing, not by review**: the wrong-PIN response included
  `attemptsRemaining` (a number) while the nonexistent-phone response had `attemptsRemaining: null` —
  byte-different JSON that a caller hitting the API directly (not through the UI, which never showed this
  field) could have used to enumerate which phone numbers are registered. Fixed by dropping the field
  entirely from that response; both cases are now byte-for-byte identical.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
- Also caught and fixed, by reasoning rather than running: `src/proxy.ts` (formerly `middleware.ts`, renamed
  per Next 16's convention) must not import `customer-session.ts`, since that module uses Node's `crypto`
  and this file can run on a restricted runtime — the cookie-name constant is duplicated locally instead.

**Not yet tested**: the admin login *success* path (no admin password was available to test with, only the
redirect-when-unauthenticated path); two simultaneous real customer sessions in two different browsers;
mobile/visual/accessibility checks (no browser available in this sandbox, only `curl`). See
`docs/PHASE3_AUTH_TESTING.md` for the checklist covering these.

## Verification performed this phase (Phase 4)
Checked live against the same real Supabase project: **migrations 0015/0016 are confirmed NOT yet
applied** (`products.image_path does not exist`; the `product-images` bucket doesn't exist either), so
none of Phase 4's actual data flow — real menu data, admin create/edit, image upload — has been exercised
end-to-end yet. What was confirmed instead, against the still-running dev server from Phase 3 (pre-migration,
so against the old schema):
- `/` and `/menu` both return 200 — the failed `products.image_path` column query degrades to an empty
  `[]` (rather than throwing), which happens to render the "Nothing on the menu yet" empty state rather
  than crashing, but it's accidental graceful degradation: the underlying query error isn't surfaced or
  logged anywhere. Not a problem once the migration is applied, but worth knowing this page wouldn't tell
  you *why* the menu was empty if a real query error ever happened in production.
- `/admin/categories`, `/admin/products`, `/admin/products/new` all correctly 307-redirect to
  `/admin/login` with no session cookie — the new admin routes inherit the dashboard layout's `is_staff()`
  gate correctly.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

**Needed before trusting this further**: apply `20260101000015_product_catalog_enhancements.sql` and
`20260101000016_product_images_storage.sql`, then actually exercise, live: creating a category, creating a
product, uploading/replacing/removing its image, confirming it appears correctly on `/menu` and in a
different (unauthenticated) session, and confirming an unauthenticated request to the admin API routes is
rejected. Ask to have this run the same way Phase 3's was, once the migrations are applied.

## Verification performed this phase (Phase 5)
Checked live against the real Supabase project:
- **Phase 4's migrations are now applied and working** (confirmed `products.image_path`/`is_featured`
  exist and return data) — they weren't yet when Phase 4's own report was written; noted here rather than
  going back to edit that section.
- **Phase 5's two new migrations (0017/0018) are confirmed NOT yet applied** — `shop_settings` and
  `place_order()` both come back as "not found" via the REST API. None of checkout's actual order-placement
  flow has been exercised end-to-end yet.
- **The geocoding adapter was verified live and for real** — not just "doesn't crash": a real request to
  `/api/geocode/search?q=Chennai+Central` against the actual public Nominatim endpoint returned five real,
  sensible Chennai results with correct coordinates. This is the one piece of Phase 5 that's genuinely
  confirmed working, not just reviewed.
- `/menu`, `/cart` return 200; `/checkout` and `/admin/settings` correctly 307-redirect to their
  respective logins with no session cookie present.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass. Lint caught three real issues worth
  naming rather than just fixing quietly: this project's ESLint config includes React 19's newer
  `react-hooks/set-state-in-effect` and `react-hooks/refs` rules, which flagged (1) the idempotency key
  generation originally using a `useRef` guard pattern — switched to a `useState(() => crypto.randomUUID())`
  lazy initializer instead, which is the correct idiomatic replacement; (2) a `setIsRevalidating(true)` call
  sitting directly in an effect body before its async fetch — moved inside the async callback, which the
  linter accepts since it's no longer part of the effect's synchronous execution; (3) the cart's
  localStorage-hydration effect, which is the one case that's a genuinely correct pattern the rule is too
  broad to recognize — given a scoped, commented `eslint-disable-next-line` rather than restructured
  around.

**Needed before trusting this further**: apply `20260101000017_shop_settings_and_idempotency.sql` and
`20260101000018_place_order.sql`, then exercise live: placing a real order (confirm it appears correctly,
confirm stock actually decrements, confirm the order number comes back), double-submitting the same
checkout to confirm no duplicate is created, attempting to order more than available stock, and setting a
service radius in `/admin/settings` to confirm an out-of-area address is rejected. Ask to have this run
the same way Phases 3/4's were, once the migrations are applied. The map/geolocation/pin-dragging UI
itself also still needs a real browser on a real device — no browser was available in this sandbox, only
`curl` for the geocoding API specifically.

## Verification performed this phase (Phase 6)
Checked live against the real project: **Phase 5's migrations (0017/0018) are still not applied** —
`shop_settings` as a table doesn't exist yet (though, oddly, `orders.idempotency_key` does — a partial
apply happened somewhere between phases; `shop_settings` and `place_order()`/`cancel_my_order()` are
confirmed absent). This means **none of checkout/order-placement/cancellation has been exercised through
their real RPCs yet** — still outstanding from Phase 5, now joined by Phase 6's `cancel_my_order()`.

What *was* verified live, working around the missing RPCs: registered two disposable customers via the
real registration endpoint, inserted a test order directly (service-role, bypassing the not-yet-applied
`place_order()`) for the first, and confirmed against the real running app — not just by reading the
code — that:
- `/orders` lists it correctly (order number, status badge, total).
- `/orders/[id]` renders the full detail correctly: order number, the item snapshot, total, a "Status
  timeline" section, and the "Pending"/"Order placed" status label.
- An unauthenticated request to that exact order URL redirects to login.
- **A second, different real customer's session, given the exact same order UUID, gets
  `{"error":"not_found"}` from `/api/orders/[id]`** — the specific acceptance criterion this phase asked
  for, confirmed with two real accounts rather than reasoned about from the code alone.
- All test data (the order, both customer accounts) was deleted afterward.

`npm run typecheck`, `npm run lint`, and `npm run build` all pass with the full Phase 6 code added.

**Needed before trusting this further**: apply `20260101000017`, `20260101000018`, and
`20260101000019` (in that order), then exercise live: place a real order through checkout, confirm its
detail page and timeline populate correctly as its status changes (advanced manually in the database,
since the admin UI to do this doesn't exist yet), and exercise `cancel_my_order()` for real — both a
successful cancellation from an allowed status and a rejected one from a disallowed status.

## Outstanding issues / known gaps

**As of Phase 9, this list is down to genuinely real gaps** — the migration-not-applied/not-exercised
items that dominated this section in Phases 5–8 are resolved (all 20 migrations applied; the full order
lifecycle, admin auth, and upload validation all exercised live with real fixtures — see
`docs/PRODUCTION_READINESS.md`). What's left:

- **No real browser/device testing** — mobile responsiveness and accessibility were built carefully
  (mobile-first Tailwind, real `<label>`/`aria-label` associations, one gap found and fixed this phase by
  code reading) but never visually confirmed, because this sandbox has no browser. See
  `docs/FINAL_TESTING_CHECKLIST.md` section 7.
- **No real deployment** — nothing has run on Vercel; everything has been `next dev`/`next build` against
  the real Supabase project. `docs/DEPLOYMENT.md` is the runbook for this, written but not executed by me
  (no Vercel access).
- **No real SMS provider configured** — `SMS_PROVIDER` is still `console`. OTP delivery is confirmed by
  reading server logs, never by a real text message arriving on a real phone.
- **Registering with a phone number you don't own is still possible** — the Phase 3 user-directed
  tradeoff, unchanged. The OTP machinery to close this exists and is unused by registration (only by
  forgot-PIN).
- No automated test suite anywhere — every verification in this project, including this phase's, has been
  manual (`curl` against a real environment) or code review.
- `npm audit` reports 5 high-severity advisories in transitive dev-only lint dependencies (not a runtime
  exposure) — unchanged since Phase 1, left as-is (the fix downgrades `eslint-config-next` to a version
  incompatible with Next 16).
- No staff account management UI (`provision_staff()`/`deactivate_staff()` from Phase 2 have no page
  calling them); no bulk order actions; no price-adjustment workflow (deliberate, see Phase 7's notes);
  session sliding-renewal doesn't exist (fixed 30-day customer session expiry only).

### Phase 3 — Customer registration & authentication
Full write-up of the architecture is in the Phase 3 chat explanation; summary here.

**Two new migrations** (apply after Phase 2's twelve, in order):
- `20260101000013_phone_auth.sql` — `phone_otps` (custom, hashed, rate-limited OTP — not Supabase's native
  phone-auth feature), `customer_sessions` (our own session table, not a Supabase Auth session),
  `verify_customer_pin()` (the deferred-from-Phase-2 rate-limited PIN check), `register_customer_profile_for_user()`
  and `set_customer_pin_for_user()` (service_role-only completion paths). Every new function is restricted
  to `service_role` — none of this is callable directly from a browser.
- `20260101000014_customer_addresses_nullable_coordinates.sql` — drops the `NOT NULL` on
  `customer_addresses.latitude/longitude`, since registration collects a plain-text address and the
  map-pin UI doesn't exist yet. Range CHECKs still apply whenever a value is present.

**Architecture** (why, not just what):
- Customers never get a real Supabase Auth session. `auth.users` is used only as the identity anchor
  (created via the Admin API, `phone_confirm: true`) so `customer_profiles.id` keeps its Phase 2 FK.
- OTP is fully custom (own table, own 6-digit codes, 10-minute expiry, 5 attempts, 60s cooldown, 5/hour
  cap) specifically so it isn't tied to Supabase's dashboard-configured SMS provider list or to a
  transient Supabase session that would then need to be "laundered" into this app's own session system.
  **As of a mid-phase change, OTP is only used for forgot-PIN now — see below.**
- Everyday login is phone + PIN, verified by `verify_customer_pin()` (5 wrong attempts → 15-minute
  lockout), never another OTP round-trip — OTP is reserved for registration and forgot-PIN only.
- Sessions are a custom `customer_sessions` table: a random 256-bit token, SHA-256 hashed before storage,
  raw token in an HttpOnly/Secure(prod)/SameSite=Lax cookie (`km_customer_session`), 30-day fixed expiry,
  no sliding renewal yet.
- Staff keep real Supabase Auth (email + password via `@supabase/ssr`) — a structurally separate
  cookie/mechanism from customers, which is what makes "a customer session can't reach admin endpoints"
  true by construction. Admin route protection (middleware-equivalent presence check in `src/proxy.ts` +
  a real `is_staff()` check in `src/app/admin/(dashboard)/layout.tsx`) was added in this phase too, even
  though it wasn't explicitly asked for, because requirement 11 has nothing to verify against otherwise —
  Phase 1 left `/admin/*` completely open.
- `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`; migrated as part of this phase, see Next.js's
  own migration codemod) only does a cheap cookie-presence/JWT-validity redirect for UX. The real
  authorization decision is always a database-backed check in the page/layout/route handler that owns the
  data — treating a proxy/middleware file as the actual security boundary is a known Next.js footgun, and
  this app doesn't rely on it being one.
- SMS sending is a provider-agnostic adapter (`src/lib/sms/send-sms.ts`), switched by `SMS_PROVIDER`.
  Defaults to `console` (logs the code instead of sending — safe for local dev, never pretends to send a
  real SMS). A `twilio` adapter (plain Messaging API, not Twilio Verify) is implemented as the one concrete
  example. India-targeted SMS requires TRAI DLT registration with whichever provider is chosen, regardless
  of which one — that's a real multi-day business process, not an API key.

**New API routes** (`src/app/api/auth/**`): `register` (single-step, no OTP), `login`, `logout`, `me`,
`forgot-pin/request-otp`, `forgot-pin/verify`, `admin/login`, `admin/logout`.

**UI wired to the real backend**: Register (single step: details → account created immediately), Login,
new Forgot PIN page (2-step: phone → OTP+new PIN — this is the only place OTP still appears in the UI),
Header (shows "Hi, `<name>`" + working logout when logged in), Admin login (real Supabase Auth), Admin
topbar logout. `/orders` is now a session-gated server component doing a real (currently always-empty,
since order placement still doesn't exist) query scoped explicitly to the logged-in customer's id.

### Mid-phase change: OTP removed from registration (user-directed)
Registration originally had a two-step OTP flow (`register/request-otp` + `register/verify`, with a
"Verify your mobile number" screen), matching the original spec's explicit "verify mobile ownership during
registration using OTP" requirement. Partway through this phase, the user asked to remove OTP from
registration for a simpler flow, after being shown the tradeoff explicitly and choosing it anyway. This was
implemented: those two routes were deleted and replaced with a single `POST /api/auth/register` that
creates the account directly from the submitted form (see `src/app/api/auth/register/route.ts` and the
single-step `src/app/(site)/register/page.tsx`).

**Known consequence, stated plainly**: nothing confirms a registering caller actually controls the phone
number they type in. Since phone is the unique login identifier, this means (a) someone could register
using a number they don't own, and (b) doing so would block the real owner of that number from ever
registering with it (the uniqueness constraint would already be taken). Forgot-PIN still requires OTP
verification, so an attacker who registered someone else's number couldn't *keep* control of it if the real
owner later uses forgot-PIN — but the real owner would first need to realize their number was already
registered. This tradeoff was made consciously, not accidentally; revisit if that risk becomes a real
business problem (e.g. by re-adding OTP specifically to registration, which the `phone_otps` table and
`request_phone_otp()`/`verify_phone_otp()` functions already support unchanged — `purpose = 'register'` is
still a valid value, just unused).

**Security choices worth flagging explicitly**:
- Login never reveals *why* something failed in a way that aids enumeration: the response is
  `{"error":"invalid_credentials"}` whether the phone doesn't exist or the PIN is wrong — confirmed
  byte-identical live, after fixing a real leak (the response briefly included an `attemptsRemaining` field
  that was a number for a real account and `null` otherwise). Forgot-PIN's request-otp always says "if that
  number is registered, a code has been sent," and only actually sends one if the account exists (confirmed
  live: no OTP was logged for an unregistered number). Lockout state **is** revealed on login (a specific
  "try again after HH:MM" message) — a deliberate tradeoff favoring legitimate-user UX, since knowing "this
  phone has an account" isn't especially sensitive for a food-ordering app.
- `register` rolls back the `auth.users` row it created (via `admin.deleteUser`) if profile/address
  creation fails afterwards, to avoid orphaned identities blocking that phone number from ever registering
  again. A partial failure *before* this rollback logic runs (e.g. the process crashing between steps) is
  a known, accepted edge case — not handled by a cleanup job in this phase.
- Phase 2's `register_customer_profile()` (the `auth.uid()`-session-based one) is now unused dead code,
  superseded by `register_customer_profile_for_user()`. Left in place rather than dropped — dropping it is
  a schema change, which the project rules ask to confirm before doing.

#### Explicitly deferred / open questions carried forward
- **Nothing in this phase has been run against the live database yet** — see "Verification performed"
  below for exactly what was and wasn't checked, and what's needed before trusting this.
- No session sliding-renewal (fixed 30-day expiry only); no account lockout notification email/SMS; no
  "log out of all other devices" — all reasonable additions, none required by the acceptance criteria.
- Checkout/order placement is still untouched — `/orders` will keep showing "no orders yet" for every real
  account until that phase exists.
- The map-pin UI is still not built; registration collects a plain-text address only (see migration 0014).

## Next phase
**Deploy for real, then close the remaining gaps in `docs/PRODUCTION_READINESS.md`'s "Not verified"
list** — in order: (1) follow `docs/DEPLOYMENT.md` to actually deploy to Vercel against a decided
Supabase project; (2) choose and configure a real SMS provider (budget real time for India's TRAI DLT
registration, not just an API signup); (3) run `docs/FINAL_TESTING_CHECKLIST.md` end to end on a real
phone/browser, both locally and against the deployed URL; (4) fix whatever that surfaces. Only after that
is "production ready" something I'd actually sign off on rather than qualify. After that: a staff account
management UI for `provision_staff()`/`deactivate_staff()` (Phase 2, still has no UI), bulk order actions,
and order-confirmation notifications (SMS/email) are reasonable next feature candidates — additions, not
prerequisites.

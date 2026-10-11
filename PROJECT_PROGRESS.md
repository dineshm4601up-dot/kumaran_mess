# Kumaran Mess — Project Progress

## Status: a fix for the admin dashboard's inconsistent order counts, plus admin product search and inline sorting — code written, typechecked/linted/built cleanly, and live-verified against the real Supabase project by hand-tracing the new SQL against real current order data (see "Verification performed (dashboard metrics + product search/sort)" below). **One more migration, `20260101000024`, is now pending** on top of `20260101000021`/`22`/`23` (all three already applied, per the previous update below) — until it's applied, the dashboard keeps showing the old (buggy) numbers and the admin Products page's search/sort UI is visible but search doesn't actually filter yet (confirmed live: the page gracefully falls back to showing every product rather than breaking, but ignores the search term until the migration lands — sorting itself already works today, since it runs in JavaScript over whatever the page fetches). Phase 9's "not yet deployed" caveat still stands, unchanged.

Previous update, still accurate: Phase 12 complete, plus a follow-up fix removing OTP from the customer-facing "Forgot PIN" flow — migrations `20260101000021`, `20260101000022`, and `20260101000023` are applied to the live project (confirmed live — `orders.tax_amount`, `customer_profiles.pin_reset_required`, and the `admin_report_summary` RPC are all present and returning real data). Reports/Customers/PIN-reset are confirmed working against real data.

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

### Phase 10 — Bill generation, printing & manual WhatsApp order confirmation

**One new migration**, not yet applied to the live project:
- `20260101000021_bills_and_whatsapp_log.sql` — adds bill-relevant columns to `shop_settings`
  (`shop_name`, `shop_address`, `shop_phone`, `gstin`, `tax_rate_percent`, `estimated_delivery_minutes`),
  adds `orders.tax_amount numeric(10,2) not null default 0`, drops and recreates the `GENERATED` `total`
  column as `subtotal + delivery_fee + tax_amount` (unchanged behaviour when `tax_amount = 0`), updates
  `place_order()` to compute and freeze `tax_amount` from `shop_settings.tax_rate_percent` at order-creation
  time (never recalculated later), and creates `order_whatsapp_log` (staff-only `select`/`insert` via RLS) —
  a pure audit trail of when a staff member opened the click-to-chat compose window for an order, not proof
  that WhatsApp delivered anything.

**A. Customer bill** (`/orders/[id]/bill`) — session-gated page (customer must own the order, `notFound()`
otherwise), renders `BillDocument` (shop header, "Tax Invoice" vs "Order Receipt" heading, status badge,
cancelled-reason banner if applicable, customer/delivery details, itemized table, subtotal/delivery
fee/tax(only if > 0)/total, COD payment line) with `BillActions` (Print Bill / Save as PDF, both calling
`window.print()`). Linked from the customer order-detail page and from the checkout success screen.

**B. Admin bill** (`/admin/orders/[id]/bill`) — same `BillDocument`/`BillActions` components, staff-gated,
no customer-side ownership filter (relies on the existing admin layout's `is_staff()` gate). Linked from
the admin order-detail page. The existing "Mark COD collected"/"Mark refused" buttons already on the admin
order-detail page serve as the required separate COD-collection action — not duplicated onto the bill page,
since the bill is a read-only document by design (requirement E: "no customer or admin ability to mutate a
bill").

**No PDF-generation library was introduced.** Both bill pages use the native browser print path
(`window.print()` + an `@media print` block in `globals.css` that isolates `.bill-print-area` as the only
visible content and hides everything marked `.no-print`) exactly as the instructions preferred — a user
choosing "Save as PDF" in their browser's print dialog produces the PDF. This keeps the bill route a plain
server-rendered page with zero new runtime dependencies.

**C. Manual WhatsApp order confirmation** — a "Send WhatsApp Confirmation" section on the admin order-detail
page, shown once an order is past `pending` and not `cancelled`. The confirmation message
(`src/lib/whatsapp/message.ts`) is built entirely server-side from the authoritative order/shop data (order
number, status, items, subtotal/delivery/tax/total, COD note, delivery address, and an estimated-delivery
line only when `shop_settings.estimated_delivery_minutes` is set) — nothing the browser supplies feeds into
it. `src/lib/whatsapp/click-to-chat.ts` validates/normalizes the customer's stored phone into the digits-only
form `wa.me` expects (`toWhatsAppPhoneDigits`, returns `null` for anything that doesn't look like a real
Indian mobile number) and builds the `https://wa.me/<digits>?text=<encoded>` URL. If the phone is missing or
invalid, the UI shows a plain "can't do this" warning instead of a broken link — no silent failure. The
button opens that URL in a new tab and fires a fire-and-forget audit-log POST; it is explicitly labelled
"this only opens WhatsApp with the message pre-filled — it does **not** send anything automatically. You
still need to tap Send inside WhatsApp," with Copy-message/Copy-phone fallback buttons via the Clipboard API.

**D. Architecturally isolated from any future official API, by design.** `click-to-chat.ts` only ever
builds a `wa.me` link — it has no concept of the WhatsApp Business Platform (Graph) API (access tokens,
phone-number IDs, template approval, delivery-status webhooks), and never will. If/when real automatic
sending is built, it belongs in a new, separate `src/lib/whatsapp/provider.ts`-style adapter with its own
server-only secrets and a webhook route — nothing in this phase's code would need to change to add that
alongside it. No secret of any kind is involved in click-to-chat (it's just a public URL scheme), so there
is nothing to leak to the browser in the first place.

**E. Bill-integrity requirements, how each is satisfied:**
- Server-side auth on every bill route (customer session + ownership filter, or staff session) — no
  client-supplied order id alone is ever trusted.
- No mutation surface on any bill page — `BillDocument`/`BillActions` take data in, render it, and print;
  there is no form, button, or API call on either bill page that writes anything.
- Snapshot preservation — bills read `order_items` (which already freezes product name/price at order
  time, since Phase 5) and the new `orders.tax_amount` (frozen at order-creation time by `place_order()`),
  never the live `products` table. `BillData`/`getCustomerBillData`/`getAdminBillData` have no code path
  that reads current product prices.
- Audit logging — `order_whatsapp_log` records every click-to-chat open, with `triggered_by` set to the
  actual staff member's id from their own session (not a client-supplied value).
- HTML escaping — `BillDocument` is a normal React/JSX component; every piece of customer/product/address
  text is rendered through ordinary JSX interpolation (React's automatic escaping), and
  `dangerouslySetInnerHTML` is not used anywhere in this phase's code.
- No guessable URLs — both bill routes key off the order's UUID (`orders.id`), not a sequential/public
  order number, and both still require a valid session on top of that.
- Receipt vs. tax-invoice distinction is driven by data stored **on the order** (`isTaxInvoice =
  Boolean(shop.gstin) && taxAmount > 0`), not just the shop's current configuration, so an order placed
  before GSTIN/tax was configured keeps showing "Order Receipt" forever, even if the shop later adds a
  GSTIN — exactly the historical-correctness requirement asked for.
- Totals are never recalculated from current prices anywhere in the bill path — `BillData.total` comes
  straight from the order row's own `total` (the `GENERATED` column), which Postgres computed once, at
  order-creation time, from the frozen `subtotal`/`delivery_fee`/`tax_amount`.

**Supporting changes**: `src/lib/shop-settings.ts` (new) centralizes the `shop_settings` column list and a
`DEFAULT_SETTINGS` fallback used by both the checkout page and the admin settings page (previously each had
its own inline query); `ShopSettingsForm`/`/api/admin/settings` gained the new fields (shop name/address/
phone/GSTIN/tax rate/estimated delivery) with validation (tax rate 0–100, estimated delivery a positive
integer, GSTIN uppercased, display-only — not validated against any GSTIN format or registry).

**No new environment variables.** WhatsApp confirmation is pure click-to-chat (a public URL scheme); it
needs no API key, token, or configuration of any kind.

### Phase 11 — Green theme, light/dark mode, responsive mobile UI

No schema, auth, or business-logic changes — this phase is UI/CSS only, as instructed. Every color in the
app was already routed through the semantic CSS variables in `globals.css` (`bg-background`, `text-foreground`,
`bg-surface`, `border-border`, `bg-primary`, etc. — confirmed by grepping the whole `src/` tree for raw hex
values and `bg-white`/`bg-black`/`text-white`/`text-black`: zero matches outside `globals.css` itself), so
the re-skin and the dark-mode work both happened almost entirely in that one file plus a small root-layout
addition — no component had to be rewritten to use tokens it wasn't already using.

**A. Green palette + full light/dark token coverage** (`src/app/globals.css`) — replaced the warm
orange/cream palette with the requested green-based one (primary `#15803D`, light surface `#F8FAFC`, dark
background `#0B1220`, dark surface `#111827`, dark border `#374151`, dark text `#F9FAFB`, etc.), and, while
doing so, fixed a real gap the old palette had: the previous `@media (prefers-color-scheme: dark)` block only
overrode `background`/`foreground`/`primary`/`surface`/`border`/`muted-foreground` — `accent`, `success`,
`warning`, and `danger` (and their `-foreground` pairs) had **no** dark-mode override at all, so status
badges and the danger button would have rendered with light-mode hex values against a dark surface. Every
token now has an explicit, contrast-checked dark value.

**B. Manual light/dark/system theme toggle**, not just OS-preference-following — this didn't exist before
this phase (the codebase had `prefers-color-scheme` only, no toggle, no `next-themes`, no `.dark` class
anywhere). Implemented exactly as Next.js's own bundled guide for this version recommends (per `AGENTS.md`'s
instruction to read `node_modules/next/dist/docs/` before writing code — the relevant page is
`01-app/02-guides/preventing-flash-before-hydration.md`, "Themes" section):
- A `[data-theme]` attribute strategy: no attribute at all = follow the OS setting (the
  `@media (prefers-color-scheme: dark)` block, scoped with `:root:not([data-theme="light"])` so an explicit
  light override still wins even on a dark-mode OS); `[data-theme="dark"]` forces dark regardless of OS;
  `[data-theme="light"]` forces light regardless of OS.
- `src/app/layout.tsx` gained a tiny inline `<script>` in `<head>`, reading a `theme` cookie and setting the
  attribute **before first paint** (not in `useEffect`, which the guide explains still shows a flash — the
  script runs synchronously during HTML parsing, before React is even involved) — and `suppressHydrationWarning`
  on `<html>`, since the script intentionally changes an attribute the server-rendered markup doesn't have.
  A cookie rather than `localStorage` specifically because the guide warns that reading the preference with
  `cookies()` *server-side* in the root layout would opt the whole app out of static prerendering — reading
  it only in the client-side inline script avoids that entirely.
- `src/components/theme/ThemeToggle.tsx` (new) — a single compact icon button (not a 3-way segmented
  control) that cycles System → Light → Dark → System, so it fits the same 40×40 slot as the other icon
  buttons in the customer header's mobile icon row and the admin topbar without crowding either at 320px.
  Each click updates `data-theme` directly and persists the choice to the same `theme` cookie (1 year, or
  deletes it for "System"). Includes the `useLayoutEffect` re-apply the guide calls out explicitly for this
  pattern: React's Strict Mode remounts once in dev and clears attributes on `<html>` that JSX doesn't
  itself own, which would otherwise undo what the inline script already set — a no-op in production, where
  that double-render doesn't happen.
- Added to both the customer `Header` and the admin `AdminTopbar`, so both surfaces have it.
- No new dependency — no `next-themes` or similar was added; the whole mechanism is the cookie + one inline
  script + one small client component shown above.

**C. Responsive/mobile pass**, informed by a full-codebase inventory done first (every `src/components/ui/`
primitive, every page, every nav/layout file, both map components, searched for hard-coded colors and wide
tables) rather than guessing at what needed fixing:
- **Customer header** (`Header.tsx`/`Logo.tsx`): the wordmark text now hides below `sm:` (640px) so the
  icon badge, theme toggle, cart button, and hamburger button all fit in the icon row at 320px without
  crowding the logo — verified by hand-computing the worst-case 320px width budget, since there's no browser
  available here to screenshot it directly (see "Not verified" below).
- **Admin mobile nav** (`AdminNav.tsx`, `admin/(dashboard)/layout.tsx`): replaced the horizontal
  scrollable pill-tab bar with a real fixed bottom navigation bar (`position: fixed`, icon + label, 5 tabs,
  `env(safe-area-inset-bottom)` padding for notched phones) below `md:` — a closer match to the phase's
  explicit "mobile drawer or bottom navigation" requirement than a top scroll bar. `<main>` gained `pb-20`
  on mobile (`md:pb-6` restores the old padding once the bar disappears) so page content never sits
  underneath it.
- **4 admin data tables converted to responsive table+card pairs** (dashboard "Recent orders", the full
  orders list, products list, categories list) — each now renders a normal `<table>` from `md:` upward and
  a stacked card list below it, instead of relying solely on `overflow-x-auto` horizontal scrolling on
  phones. The two order tables (dashboard + orders list) share one new component,
  `src/components/admin/OrdersTable.tsx`, so they can't drift out of sync; products/categories got
  purpose-built card markup inline since their columns differ enough that a shared component would've added
  an abstraction for no real reuse.
- **Cart row wrapping** (`cart/page.tsx`): the single non-wrapping `flex` row (thumbnail + name/price +
  quantity stepper + remove button) now wraps the stepper/remove group onto its own line below ~small
  widths (`flex-wrap` + the control group forced `w-full` under `sm:`), so long product names no longer
  cramp the stepper and remove button at 320–375px.
- **Bill table overflow** (`BillDocument.tsx`, used by both the customer and admin bill pages): the 4-column
  items table (Item/Qty/Unit price/Line total) is now wrapped in its own `overflow-x-auto` with a
  `min-w-[420px]` floor, so a long product name scrolls horizontally within the table instead of forcing the
  whole bill page to overflow.
- **Map containers** (`LeafletMap.tsx` and its two loading-skeleton fallbacks in `LocationPicker.tsx`/
  `OrderLocationMap.tsx`): height is now `220px` below `sm:` and `280px` at `sm:` and up (previously a flat
  `280px`), giving phones more usable page height without the map becoming unusably small; the loading
  skeletons use the identical breakpoint so there's no layout jump when the real map mounts.
- **Touch targets**: `Button`'s `md`/`lg` sizes gained `min-h-11` (44px) — used for every primary/standalone
  action (add to cart, place order, confirm/cancel, status changes) — while `sm` stays compact for dense
  inline actions (table "Edit" links, "Copy message") where 44px would look oversized. `ProductCard`'s "Add"
  button moved from `sm` to `md` specifically because it's the single most-tapped control in the whole
  customer app. `QuantityStepper`'s +/− buttons grew from 32px to 40px.
- **Visible keyboard focus states**: `Button`, `Badge`, `FormField`, and `InfoBanner` already had
  `focus-visible` rings from earlier phases; this phase added matching `focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-primary` rings to every plain `<button>`/`<a>` that
  was missing one — the customer header's nav links, logout buttons, cart link, hamburger button, and
  mobile dropdown links; the admin nav's horizontal and vertical link lists; `CategoryTabs`; the cart page's
  "Remove" button; and the location-search result list in `LocationPicker`.
- **Reduced motion**: added a global `@media (prefers-reduced-motion: reduce)` rule in `globals.css` that
  collapses all CSS transitions/animations to near-zero duration for anyone with that OS preference set.
- **`WhatsAppConfirmationButton`**'s "Copy message"/"Copy phone number" button row gained `flex-wrap` as a
  defensive fix — at exactly 320px the two buttons combined were close enough to the container width that
  they could've clipped without it.

**Explicitly considered and deliberately left unchanged**, with the reasoning stated rather than silently
skipped:
- **No new confirmation-dialog/modal primitive was built.** The codebase has no modal/dialog component
  anywhere (confirmed by search); customer and admin order-cancellation flows instead use an inline
  expand-in-place form (type a reason, then a separate "Confirm cancellation" button) gated behind a
  `showCancelForm` boolean. That pattern already requires an explicit second action before anything
  destructive happens, which is what the phase's "prevent accidental destructive actions" requirement asks
  for — rewriting tested, working cancellation flows into a new modal primitive for this phase would have
  added risk without closing an actual gap.
- **No sticky/floating mobile checkout action bar was added.** `CheckoutClient.tsx` already shows a
  full-width "Place Order (COD)" button inline at the end of the mobile-stacked form (a second copy sits in
  the desktop sidebar, hidden on mobile) — prominent and reachable without needing to float above content
  that a sticky bar could otherwise cover.
- **`ProductForm`/`CategoryForm`/`ShopSettingsForm`'s `grid-cols-2` field pairs** (price/stock, latitude/
  longitude, etc.) were left as fixed 2-column grids rather than switching to single-column on mobile — each
  pairs two short inputs (numbers, short text) that fit comfortably side by side even at 320px; this was
  checked by hand against each field's expected content width, not assumed.
- **No theming library was introduced** (no `next-themes`, no CSS-in-JS runtime) — Tailwind v4's existing
  CSS-first `@theme inline` setup plus the small amount of new code described above was enough, matching the
  phase's "avoid unnecessary dependencies" / "use a compatible theme library only if necessary" guidance.

### Fix — customer product search ignored Tamil product names

**The bug**: every real product in this catalog has a Tamil product name with an English description (e.g.
`பரோட்டா (1)` / `Parotta (1 piece)`, confirmed by querying the live `products` table directly — this isn't
a hypothetical, the entire menu is built this way). `MenuBrowser.tsx`'s search box only ever checked
`product.name.toLowerCase().includes(query)`, so searching "Parotta", "parotta", "piece", or "1 piece"
matched nothing, even though the description plainly says "Parotta (1 piece)" — only typing the Tamil name
itself ever worked.

**The fix** (`src/app/(site)/menu/MenuBrowser.tsx`, new `src/lib/product-search.ts`): extracted the matching
logic into a small, pure, framework-free module and now check the product's name, description, *and*
category name together, word-by-word — every word in the (trimmed, whitespace-collapsed, lower-cased) query
must appear as a substring somewhere across all three fields combined, so a query can match any of them
independently. This is still 100% client-side filtering over data the page already fetches in full (the
existing `menu/page.tsx` Supabase query already selects every product with no pagination — there is no
server-side search query to touch here, and the phase instructions' "if search is performed in
Supabase/requires server-side filtering" clauses don't apply to this app's existing architecture). The
`description` column was already being selected by `menu/page.tsx`; no column or query changed.

No product data was touched — Tamil names remain exactly as stored; nothing was translated, renamed, or
overwritten. No schema change. Existing category-tab filtering, the `is_available`/`is_active` display
behavior (unavailable products still show with their "Out of stock" overlay rather than being hidden —
unchanged), sorting (`display_order`, untouched), and the empty-search-shows-everything behavior are all
unaffected — the new matching function only replaces the single `matchesQuery` line's logic, nothing around
it moved.

**Tests added** (`src/lib/product-search.test.ts`, 15 cases, Node's built-in `node:test` runner — no new
test-framework dependency): matching the real Tamil name directly; matching the English description
case-insensitively (`Parotta`/`parotta`/`PAROTTA`); matching a single word from inside the description
(`piece`); matching a multi-word phrase spanning it (`1 piece`); matching by category name; rejecting
unrelated text; requiring *every* word in a multi-word query to match (not just one); empty and
whitespace-only queries matching everything; leading/trailing space trimming; repeated-internal-space
collapsing; a product with a `null` description still matching on name alone; an "unavailable" product
still matching on text (confirming search doesn't accidentally hide it — that's a display concern handled
elsewhere, unchanged); and the two small normalization helpers directly. Added a `"test": "node --test
src/**/*.test.ts"` script to `package.json` (no new dependency — Node 24's built-in test runner, already
the Node version in this environment) and `"allowImportingTsExtensions": true` to `tsconfig.json` (required
for Node to resolve the `.ts` import between the test file and the module under test; safe here because
`noEmit` is already `true` project-wide, which is this option's documented precondition).

No new component-level/integration test was added for the category-filter-plus-search interaction itself
(that logic is a few lines inside the `MenuBrowser` React component, not the extracted module) — this
codebase has no React/DOM testing library (`@testing-library/react`, `jsdom`, etc.) installed, and adding
one just for this fix would be a disproportionate new dependency for a two-line interaction; that combination
was instead checked by reading the updated `filteredProducts` logic directly (category filter is checked
first and short-circuits before the search match runs, exactly as before) and is reasoned through, not
machine-verified — stated plainly rather than claimed as tested.

### Phase 12 — Admin reports, customer management, PIN reset, and calling features

Everything in this phase reuses the existing schema/auth/components/theme per the instructions — no new payment
method, no OTP/SMS provider, no WhatsApp Business API, and (with one necessary exception, explained below) no
weakening of RLS. Three new migrations, all additive (no destructive `alter`/`drop` of existing data).

**New migrations:**
- `20260101000022_customer_management_and_pin_reset.sql` — `shop_settings.whatsapp_number` (new column, optional,
  E.164-format-checked); a format check added to the already-existing `shop_phone` column (Phase 10 left it
  unconstrained free text; this phase starts actually using it for a `tel:` link, so it needs the same shape
  every other phone column enforces); `shop_phone`'s default set to `+919344689836` and backfilled onto the
  existing singleton row **only if it's still null** (an admin who already configured a different number keeps
  it); `customer_profiles.pin_reset_required boolean`; a `customer_pin_resets` audit table (staff id + customer
  id + timestamp — **never** the PIN itself); `verify_customer_pin()` dropped and recreated with an added
  `pin_reset_required` output column (Postgres has no `ALTER FUNCTION` for a changed table-returning signature,
  same as Phase 10's `total` column change); `admin_reset_customer_pin()` (the admin-assisted reset itself);
  `change_own_customer_pin()` (the customer's own forced change afterward); `admin_list_customers()` (the
  all-time customer directory, one aggregate query).
- `20260101000023_admin_reports.sql` — five read-only aggregate RPCs for the Reports page:
  `admin_report_summary`, `admin_report_sales_trend`, `admin_report_customer_wise`, `admin_report_product_wise`,
  `admin_report_order_details`. All `security definer`/`stable`, `service_role`-only, single `GROUP BY`/`FILTER`
  queries (never a loop per customer/product — requirement 9). This migration's `admin_report_order_details`
  reads `orders.tax_amount`, so it depends on Phase 10's `20260101000021` already being applied — **apply
  0021, then 0022, then 0023, in that order.**

**No RLS policy was weakened.** The one deliberate exception to "don't bypass RLS for reports" is that every
new RPC/route in this phase reads through the existing service-role client (`getSupabaseAdmin()`), exactly the
same pattern every other admin feature in this app already uses (products, categories, order management,
settings, bills) — staff already have unrestricted `SELECT` on every table these queries touch, via existing
`is_staff()` RLS policies from Phase 2/3, so nothing here is newly exposed to anyone who couldn't already read
it through the ordinary admin UI. No table's RLS was altered to make this phase's features work.

**A. Admin Reports** (`/admin/reports`) — a single page with four tabs (Monthly Sales, Customer-wise,
Product-wise, Order Details), a GET filter form (date-range preset — This month/Last month/This year/Custom —
plus an order-status filter and a COD-only payment-method indicator), and an "Export to Excel" button per tab.
Deliberately a server-rendered page reading `searchParams` rather than a client-side fetch-driven dashboard —
consistent with how `/admin/orders`'s search box already works, and it means every tab's data and its export
are driven by the exact same resolved date range, never two slightly different computations. Date-range presets
are resolved in Asia/Kolkata (`src/lib/report-dates.ts`), matching the `admin_dashboard_stats()` convention from
Phase 7 — "this month" computed from the server's/browser's local clock would silently drift by whatever offset
that clock is in.
  - **Monthly Sales**: total/delivered/cancelled/pending-processing order counts, delivered sales, total
    delivery charges, COD collected vs. COD pending (computed as two independent sums, never one derived by
    subtracting the other from delivered sales — this is deliberate: "do not treat an order as paid merely
    because its status is delivered" means a delivered order can be in *either* bucket, and the two columns
    must never silently drift apart), average delivered order value, and a daily sales-trend chart.
  - **Sales trend chart**: no charting library exists in this project and the phase says not to add one unless
    reusing something already present, so this is a small dependency-free inline SVG bar chart
    (`src/components/admin/reports/SalesTrendChart.tsx`) plus the same data as a plain table underneath — the
    table isn't a fallback, it's what's actually screen-reader-readable and mobile-usable, since SVG `<rect>`
    bars aren't.
  - **Customer-wise**: per-customer order counts/delivered sales/avg. order value/last-order-date within the
    selected range, linking through to the full customer detail page.
  - **Product-wise**: grouped by `order_items.product_name_snapshot` — **never** `products.name`/`products.id`
    — so renaming or repricing a product later never changes what a historical report shows for orders placed
    before that edit (requirement C, tested explicitly — see below).
  - **Order Details**: one row per order with its items flattened into a readable summary string, subtotal/
    delivery fee/tax/total, status, and COD status. "Collected amount"/"collection date" aren't separate stored
    columns (this app has no partial-COD-collection concept) — they're derived as `total`/`payment_updated_at`
    whenever `payment_status = 'collected'`, computed in the export route rather than stored redundantly.

**B. Excel export** (`src/lib/xlsx-export.ts`, one route per report under `/api/admin/reports/*/export`) —
real `.xlsx` workbooks via `exceljs`, not a CSV with a renamed extension. **`xlsx`/SheetJS was deliberately not
used**, despite being the instructions' suggested example: at the time of writing, the `xlsx` package on npm has
two unpatched high-severity advisories (prototype pollution, GHSA-4r6h-8v6p-xvw6; ReDoS, GHSA-5pgg-2g8v-p4x9)
with "no fix available". `exceljs` was chosen instead — same end result (a real, Excel-openable `.xlsx`), MIT
licensed, actively maintained, and its only new advisory is one *moderate* transitive `uuid` buffer-bounds-check
issue (GHSA-w5hq-g745-h8pq) used purely for `exceljs`'s own internal id generation, never fed attacker-controlled
input. Every export: is staff-gated (`getStaffContext()`, same as every other admin route); fetches the full
matching dataset fresh via the same RPCs the on-screen report uses (never just "whatever's currently rendered");
includes a "Report Info" sheet stating the report name, date range, status filter, payment-method note, and a
generation timestamp; uses real currency (`"₹"#,##0.00`) and date (`dd-mmm-yyyy`) cell formats, not plain text;
and uses the exact filename patterns given (`monthly_sales_2026-10.xlsx`, `customer_wise_sales.xlsx`,
`product_wise_sales.xlsx`, `order_details_2026-10-01_to_2026-10-31.xlsx`) — all four confirmed live (see
Verification below). No Supabase credentials of any kind reach the browser — the export routes run entirely
server-side and stream back only the finished binary.

**C. Admin Customer Management** (`/admin/customers`, `/admin/customers/[id]`) — a searchable (name/phone)
directory (`admin_list_customers()`, all-time, unlike the date-ranged Customer-wise *report*) and a detail page
showing profile, saved addresses, and order history (reusing the existing `OrdersTable` component). **Editing
is limited to `full_name`/`email`** — the exact two columns customers themselves are already allowed to edit
(Phase 2's `grant update (full_name, email) to authenticated`). **Phone is deliberately never editable from
this page.** Reasoning, stated here because the phase explicitly asked for it to be: phone is the login
identifier, and `admin_search_orders()`/the bill pages join **live** to `customer_profiles.phone` rather than
storing a per-order snapshot (unlike `order_items`, which already snapshots product name/price) — so changing
a customer's phone here would retroactively change how that phone displays on *past* orders and bills too. Only
`full_name`/`email`/PIN-reset-adjacent columns were ever in scope for admin editing — adding a phone-snapshot
column to fix the retroactive-display issue properly is a larger schema change than "edit permitted profile
information" calls for, so phone editing is simply not offered rather than half-solved. No duplicate customer
records can be created from this page — it only edits existing rows, there is no "create customer" action here
at all (customers can still only register themselves, unchanged from Phase 3). Account status isn't shown
because `customer_profiles` has no such column — "if supported by the existing schema" is read literally here
rather than adding one.

**D. Admin PIN Reset — no OTP/SMS** (`src/components/admin/ResetPinDialog.tsx`, `POST
/api/admin/customers/[id]/reset-pin`) — reuses the exact PIN-hashing approach Phase 3's `set_customer_pin_for_user()`
already established (`crypt()`/`gen_salt('bf')`, bcrypt) rather than inventing a new one. Flow: admin clicks
"Reset Customer PIN" on the customer detail page → a dialog (`role="dialog"`, `aria-modal`, Escape-to-close,
focus moved to the panel on open) shows the customer's name and a partially masked phone (`+91••••••3210`) →
a randomly-generated-but-editable 4-digit PIN field → "Confirm reset" → success state offering **Call** (a
`tel:` link) and **Open WhatsApp** (server-built, requires the admin to review and manually tap Send inside
WhatsApp — opening the link is never treated as proof anything was sent) buttons, using the just-set PIN. The
temporary PIN is **never** stored in `localStorage`, logs, or any table — it lives only in React component
state until the dialog closes, and the only persistent trace of the whole event is `customer_pin_resets`'
(staff id, customer id, timestamp) row, which the `admin_reset_customer_pin()` RPC writes itself — the PIN
value is never passed to, logged by, or returned from the API route (the client already has it; the response
only contains a `whatsAppUrl`). Setting `pin_reset_required = true` forces a change: the next successful login
(`verify_customer_pin()`, now returning that flag) makes the login route respond `mustChangePin: true`, and the
customer is redirected to a new `/change-pin` page requiring the current (temporary) PIN again plus a new one —
the current-PIN re-check is a deliberate defense-in-depth step (a stolen session cookie alone still can't
silently take over the account), and it shares `verify_customer_pin()`'s exact lockout columns, so a brute-force
attempt against the *change* endpoint is throttled by the same 5-attempts/15-minute rule as ordinary login, not
a separate, easy-to-miss mechanism. **Side effect, stated plainly**: because `change_own_customer_pin()` doesn't
itself check `pin_reset_required` (only that the current PIN is correct), any logged-in customer can reach
`/change-pin` to voluntarily change their PIN at any time, not only after an admin reset — a reasonable, low-risk
bonus of how the mechanism had to be built securely, not a feature added separately or a gap introduced.

**E. Admin Order Page — Call Customer** (`CallButton`, `src/components/shared/CallButton.tsx`) — a `tel:` link
styled as a `Button`, added next to the status-change/cancel actions on the admin order detail page and as its
own column/row-sibling on the admin orders table and cards (**deliberately never nested inside** the existing
row-level `<Link>` to the order detail page — an `<a>` inside an `<a>` is invalid HTML and makes clicks
unpredictable). Label reads `Call {first name}` as specified. Shows "No phone number" instead of a broken link
when the stored phone doesn't look like a real Indian mobile number.

**F. Customer Header — Call Kumaran Mess** (`Header.tsx`) — a phone-icon button using the shop's configured
contact number (`shop_settings.shop_phone`, fetched once in `(site)/layout.tsx` and passed down as a prop —
**not** hard-coded into Header, the admin pages, or anywhere else; every call site goes through the one
`buildTelLink()` helper in `src/lib/phone-link.ts`). Icon-only at `<sm:` widths (keeps the already-tight mobile
header icon row — logo, Call, theme toggle, cart, hamburger — from overflowing at 320px; verified by hand-
computing the worst-case width budget, same approach used for the Phase 11 header changes), full "Call Kumaran
Mess" label from `sm:` up. Styled as a tinted green pill (`bg-primary/10 text-primary`), matching the green
theme rather than introducing an unrelated accent color. Falls back to the phase's specified default
(`+919344689836`) even if `shop_settings` can't be queried at all (pre-migration or otherwise) — confirmed live,
see Verification below — so the button never silently disappears before an admin has configured anything.

**G. Shop Settings — editable contact details** (`ShopSettingsForm.tsx`) — the existing "shop phone" field
(Phase 10, previously just a bill-display string with no validation) is now explicitly labelled as the
customer-facing contact number and is validated/normalised through the same `normalizeIndianMobile()` Phase 3
built for customer registration, rejecting anything that doesn't look like a real Indian mobile number rather
than saving it as-is. A new optional "WhatsApp contact number" field was added alongside it, validated the same
way. Both share one update route (`PATCH /api/admin/settings`) with its existing loading/success/error-banner
states, now also surfacing `invalid_shop_phone`/`invalid_whatsapp_number` as specific messages instead of a
generic failure.

**H. WhatsApp helpers** — fully reused, nothing rebuilt: `buildWhatsAppClickToChatUrl`/`toWhatsAppPhoneDigits`
(Phase 10's click-to-chat primitives) and a new `buildPinResetMessage()` alongside the existing
`buildOrderConfirmationMessage()` in `src/lib/whatsapp/message.ts`. The PIN-reset WhatsApp link is built
**server-side**, in the `reset-pin` API route — never in the browser — because `click-to-chat.ts`/`message.ts`
are both `"server-only"` modules (the same reason Phase 10's order-confirmation WhatsApp button receives an
already-built URL as a prop rather than building it client-side); `ResetPinDialog` only ever receives the
finished `whatsAppUrl` string back from the API response. No paid WhatsApp Business API integration was added or
considered — this remains exactly the manual click-to-chat mechanism from Phase 10.

**Responsive/theme**: every new page/component uses the existing semantic color tokens and `OrdersTable`-style
table-on-desktop/cards-on-mobile pattern (`CustomersTable`, `CustomerWiseReport`, `ProductWiseReport`,
`OrderDetailsReport` all follow it) — nothing introduces a new color or a wide table with only horizontal
scroll as its mobile fallback. The admin bottom navigation bar (Phase 11) now holds 7 items (Dashboard,
Categories, Products, Orders, **Customers**, **Reports**, Settings) instead of 5 — denser at 320px than before,
flagged honestly below rather than assumed fine.

### Fix — removed OTP from the customer-facing "Forgot PIN" flow

**Why**: Phase 12 already built a complete, secure, non-OTP admin-assisted PIN reset (`ResetPinDialog`,
`admin_reset_customer_pin()`), but the *customer-facing* `/forgot-pin` page still ran the older Phase 3
self-service flow underneath it — a phone number, then a 6-digit OTP, then a new-PIN form, backed by
`POST /api/auth/forgot-pin/request-otp` and `POST /api/auth/forgot-pin/verify`. That left two parallel ways
for a PIN to change: the intended admin-assisted one, and the old self-service OTP one still reachable from
the customer side. This fix removes the second path entirely rather than just hiding its UI.

**What changed**:
- `src/app/(site)/forgot-pin/page.tsx` — rewritten from a stateful two-step client form into a plain **server
  component** with no form, no client state, and no API calls at all. It fetches `getShopSettings()`, shows
  the required message ("For security reasons, customers cannot reset their PIN directly. Please contact the
  shop admin to reset your PIN."), and renders three plain links: **Call Admin** (a `tel:` link built from
  `shop_settings.shop_phone` via `buildTelLink()` — the same shared helper Phase 12 built for every other call
  button in the app, so this number is never hard-coded here or anywhere else), **Contact Admin on WhatsApp**
  (shown only when `shop_settings.whatsapp_number` is actually configured — confirmed live that it's correctly
  hidden when that field is null, see Verification below — built server-side with Phase 10's existing
  `buildWhatsAppClickToChatUrl`/`toWhatsAppPhoneDigits`, reused rather than rebuilt, with a generic
  "I'd like help resetting my PIN" message, never a PIN or other sensitive data), and **Back to Login**
  (`Link` to `/login`). Because there's no form and no mutation path on this page at all, there is no code
  path by which simply opening it could change anything — satisfying "do not reset a customer's PIN simply
  because they open this page" by construction, not by a runtime check.
- **`src/app/api/auth/forgot-pin/` deleted entirely** (`request-otp/route.ts` and `verify/route.ts`) — not
  just disconnected from the UI. Leaving either route live would have meant a customer (or anyone who could
  reach the API directly) could still self-service reset a PIN via OTP even with the UI gone, which directly
  contradicts "keep PIN resets restricted to the authorised admin PIN-reset workflow." Removing the routes
  closes that path completely rather than just hiding it.
- `src/lib/validation/phone.ts` — removed `isValidOtp()`, which became unused once both callers were deleted
  (confirmed via a repo-wide search before removing it).

**Deliberately left unchanged** (schema/infrastructure, not essential to change for this fix, same
"leave unused code in place rather than drop it" precedent Phase 3 set for `register_customer_profile()`):
- The `phone_otps` table and `request_phone_otp()`/`verify_phone_otp()` functions (Phase 3) are now **fully
  unused** by the application (confirmed — nothing in `src/` calls them anymore), but were not dropped. They
  were already unused for registration since Phase 3's OTP-removal decision; this fix just removes their
  last remaining caller. Dropping them is a real schema change the instructions didn't ask for ("preserve
  database schema unless a change is essential") — essential here means "stop the self-service reset path,"
  not "remove every trace of the OTP machinery from the database."
- `src/lib/sms/send-sms.ts` (the provider-agnostic SMS adapter) is now also unused by the application for the
  same reason, and was left in place for the same reason.
- The admin-assisted PIN reset workflow (`ResetPinDialog`, `admin_reset_customer_pin()`,
  `change_own_customer_pin()`, `/change-pin`) — **completely untouched** by this fix. It was already the
  correct, secure path; this fix only removed the competing insecure one.

### Fix — admin dashboard metrics, plus admin product search and inline sorting

**One new migration**: `20260101000024_dashboard_stats_and_product_search.sql` — `create or replace`s
`admin_dashboard_stats()` (same output columns/types as before, so no drop-and-recreate needed this time)
and adds a new `admin_search_products(p_query text)` function, same pattern as the existing
`admin_search_orders()`.

**Task 1 — the dashboard's inconsistent counts, root-caused with real live data, not guessed at.** Querying
the real project directly found the *exact* numbers quoted in the task (Today's Orders 7 / Delivered 5 /
Cancelled 3 / Pending & Active 1) and traced the actual cause: `active_order_count` was never scoped to
"today" at all — it counted every currently-active order in the whole system, regardless of when it was
placed. The real "1" came from a single order placed the previous Asia/Kolkata calendar day (confirmed by
fetching it directly: `created_at` fell before that day's local midnight) that happened to still be
`confirmed`. Separately, `delivered_today_count`/`cancelled_today_count` read `orders.updated_at`, which
*any* column edit bumps (e.g. a COD `payment_status` change on an order delivered yesterday would wrongly
inflate "Delivered Today") — today's real data didn't happen to expose that specific divergence, but it's a
real latent bug independent of the reconciliation issue, fixed by switching to `order_status_history`'s
actual transition timestamp instead (that table already exists, written automatically since Phase 2 by the
`log_order_status_change()` trigger — no schema change needed beyond the function body).

New definitions (also now shown as per-card hints in the dashboard UI, so the cards are never expected to
silently reconcile when their event dates legitimately differ):
- **Today's Orders** — orders *placed* today (Asia/Kolkata calendar day), any status. Unchanged.
- **Today's Sales** — sum of `total` for orders *placed* today, excluding cancelled. Unchanged definition,
  preserved per the task's "if the current definition is sales from orders placed today, preserve it" — the
  hint now explicitly says this isn't the same as COD actually being collected.
- **Pending & Active** — **redefined**: orders *placed* today that are still in a non-terminal status
  (`pending`/`confirmed`/`preparing`/`ready`/`out_for_delivery` — the same set `lib/order-transitions.ts`
  already uses). Previously counted every active order system-wide; this is the actual fix.
- **Delivered Today** / **Cancelled Today** — distinct orders whose status *transitioned* to
  delivered/cancelled today, read from `order_status_history.created_at` (the transition event), not
  `orders.updated_at`. These **can** include orders placed on an earlier day — confirmed with real data: two
  of today's three real cancellations were orders placed the previous day. That's correct, not a bug, and
  the UI hint for both cards now says so explicitly ("may include orders placed earlier").
- All five values come from half-open `[day_start, day_end)` Asia/Kolkata-local `timestamptz` bounds,
  computed once in a CTE and reused by every count in the function — never a per-card `::date` cast, and
  never a UTC comparison (requirement: "use consistent timezone boundaries for all cards").
- Every count is `count(*)`/`count(distinct order_id)` over a single filtered query — no join that could
  silently multiply rows, and the `order_status_history` counts specifically use `distinct order_id` even
  though the status machine shouldn't ever produce more than one `to_status='delivered'` row per order (it's
  a terminal status) — defensive, not required by the data, but cheap insurance (requirement: "use distinct
  order IDs in counts").

**Task 2 — admin product search** (`src/lib/admin-products.ts`, `admin_search_products()`): matches product
name OR description, case-insensitive, Tamil and English both (it's a plain `ilike`, which doesn't care what
script the text is in) — reusing the exact same safe-parameter-binding pattern `admin_search_orders()`
already established (Phase 7) rather than building a filter string by hand, so special characters in the
search box can't do anything unexpected to the query. **No category filter or pagination exists on this
page today** (confirmed by reading the current code before changing it), so the task's "work together with
existing category filters and pagination" has nothing to integrate with yet — not skipped, just genuinely
not applicable. The admin Products page gained: a search box (`?q=`, GET form, preserves the current sort
when submitted), a "Clear search" action, and an empty state that distinguishes "no products at all" from
"no products match this search". **Graceful fallback, added deliberately**: if `admin_search_products()`
isn't available yet (confirmed live — it isn't, until `20260101000024` is applied), `getAdminProducts()`
falls back to the exact plain unfiltered query this page used before this change, rather than returning
nothing. Without this fallback, a page that worked perfectly well before this change would start showing
"No products yet" for *every* product, search or not, the moment this code shipped — a regression this fix
didn't need to introduce just because one new RPC isn't live yet. Confirmed live: pre-migration, the real
product list still renders in full (real Tamil/English names, prices, stock — nothing hidden), but a
nonsense search term doesn't filter anything, since the fallback path has no way to filter — search
*appears* but doesn't yet *work* until the migration lands. This is stated plainly rather than glossed over.

**Task 3 — inline column sorting** (`src/lib/product-sort.ts`, `SortableHeader.tsx`): Product/Category/
Price/Stock/Status, toggled by clicking a small ▲/▼/⇕ indicator beside each desktop column heading (plain
`<Link>`s with `?sort=&dir=`, no client JS) — a different column always starts ascending, matching values
tie-break to their original order (explicit index-based tie-break, not just relying on V8's
spec-guaranteed-since-ES2019 stable sort), numeric columns (price/stock) compare as numbers not strings, and
"Status" uses a logical rank (active+available, then active+unavailable, then inactive regardless of
availability) rather than plain alphabetical, since "Active"/"Inactive"/"Available"/"Unavailable" badge text
alone doesn't have an obviously useful alphabetical order. `stock_quantity` is `integer not null` at the
schema level (checked before writing this, not assumed) — there is no null-stock case in this app to handle,
stated as a limitation rather than inventing handling for a value that structurally cannot occur; the
comparator still defensively sorts a `NaN` last if one ever appeared. **Sorting runs in JavaScript, server-
side, over every row the page already fetched** (not client-side in the browser, and not a second database
round-trip) — correct and sufficient because this page has no pagination to begin with, so "all matching
products" and "the currently visible page" are already the same set; the task's "if server-side pagination
is used, perform sorting server-side" doesn't currently apply, for the same reason the category-filter
clause doesn't. **Mobile**: the sortable header icons only exist in the desktop `<table>` — the mobile layout
is cards with no column headings at all (Phase 11), so a separate, plain GET `<select>`-based "Sort by" /
"Direction" control (`md:hidden`) gives phones an equivalent way to actually reach sorting, rather than
silently having no way to use a feature the desktop view advertises.

**Preserved, unaffected by this fix**: product editing, availability/stock, delete/deactivate, and
image-upload all still go through their existing, untouched routes (`/admin/products/[id]/edit`,
`/api/admin/products/[id]`, `/api/admin/products/[id]/image`) — this fix only changed how the product *list*
is fetched, filtered, and ordered, never how an individual product is written. RLS/staff permissions are
unchanged (`admin_search_products()` is `service_role`-only, same as every other admin RPC, called only after
the page's existing staff-session gate in the admin layout).

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

**Phase 12: no new environment variables.** Admin reports, customer management, PIN reset, and both calling
features all use data already in `shop_settings`/`customer_profiles`/`orders`, the existing Supabase
credentials, and `tel:`/`wa.me` links that need no API key. **One new dependency**: `exceljs` (MIT), for the
Excel export (requirement E) — see that section above for why it was chosen over the suggested `xlsx`/SheetJS.

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

## Verification performed this phase (Phase 10)
- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- **Live-verified against the real Supabase project**, using disposable fixtures (a test customer, a test
  staff account, and a real order with one line item) created via the Admin API/service-role REST calls and
  deleted again afterward — the same discipline used in every previous phase:
  - `GET /admin/orders/[id]` for a real confirmed order returned HTTP 200 with the server-built WhatsApp
    message and `wa.me` URL containing exactly the expected content: shop name, order number, "Confirmed"
    status, the itemized line ("Masala Dosa x2"), Subtotal ₹140 / Delivery ₹30 / Total ₹170, "Cash on
    Delivery", the real delivery address, and the thank-you line — with the tax line and the
    estimated-delivery line both correctly omitted, since neither is configured for this shop yet.
  - `POST /api/admin/orders/[id]/whatsapp-log` authorization: unauthenticated → `403 forbidden`; a
    **customer** session (not staff) → `403 forbidden`; a staff session → reaches the insert (fails only
    because `order_whatsapp_log` doesn't exist yet pre-migration — see below). Confirms the route's
    staff-only gate works correctly before the migration is even in play.
  - `toWhatsAppPhoneDigits()`/`buildWhatsAppClickToChatUrl()` exercised directly against the real stored
    phone format (`+91XXXXXXXXXX`) and confirmed to produce a correct digits-only `wa.me` link.
- **Blocked on migration `20260101000021`, confirmed to be the only reason, not a code bug** (reproduced the
  exact Postgres error directly via REST, the same way every prior phase's pre-migration gaps were
  confirmed):
  - `getShopSettings()`/the checkout and admin-settings pages: querying the new `shop_settings` columns
    before the migration returns `42703` (column does not exist); `getShopSettings()` catches this and
    falls back to `DEFAULT_SETTINGS`, so these pages don't crash pre-migration — confirmed live.
  - `getCustomerBillData()`/`getAdminBillData()` (which select `orders.tax_amount`): pre-migration this
    404s cleanly via the bill pages' `notFound()` path rather than throwing — confirmed by requesting a real
    order's bill URL before the migration was applied.
  - `POST /api/admin/orders/[id]/whatsapp-log`'s insert: pre-migration returns Postgres `PGRST205` ("table
    `order_whatsapp_log` not found in the schema cache"), caught and turned into a clean `{"error":
    "log_failed"}` 500 rather than crashing — confirmed live, error logged server-side as expected.
- **Not yet verified, because it requires the migration applied first**: actual rendered bill content
  (itemized table, tax line display, tax-invoice vs. receipt heading) against real data; a
  product-price-changed-after-order-placed check (confirming the bill still shows the frozen order-time
  price, not the product's current price); the COD payment-status line on the bill in combination with an
  actual "Mark COD collected" action; the `order_whatsapp_log` insert actually succeeding and being
  queryable afterward.
- All disposable test fixtures (test order + its items, test customer, test staff account) were deleted via
  direct `DELETE` REST calls / the Admin API after testing; no real user data was touched at any point.

## Verification performed this phase (Phase 11)
- `npm run typecheck`, `npm run lint`, `npm run build` all pass with no new errors or warnings — confirmed
  after every batch of changes, not just once at the end.
- **Confirmed live** (started the dev server, fetched real rendered output — the same approach used for
  every other phase's live checks, since this sandbox has no browser to screenshot with):
  - The inline theme-init `<script>` is present verbatim in the `<head>` of the server-rendered HTML for
    `/` — confirmed by fetching the page and grepping for it, rather than assuming the JSX produced what was
    intended.
  - The compiled CSS actually contains the new green/dark hex values (`#15803d`, `#16a34a`, `#0b1220`,
    `#dc2626`, etc.) — confirmed by fetching the real built stylesheet chunk Next.js served and grepping it,
    not just reading the source `globals.css`.
  - `/`, `/menu`, `/cart`, `/login`, and `/admin/login` all returned HTTP 200 after every page in this
    phase's change set was touched.
- **Not verified, and said so rather than claimed otherwise**: no real browser or device was available in
  this sandbox, so none of the following were visually confirmed — only reasoned through against the actual
  Tailwind classes and pixel values used:
  - The light/dark/system toggle's actual appearance and click-through behavior in a real browser (cookie
    read/write, `data-theme` attribute changes, and the dev-mode Strict Mode re-apply were all read
    carefully against Next.js's own documented pattern for this, but never clicked in an actual UI).
  - Real OS dark/light switching being picked up live (`prefers-color-scheme` media query behavior).
  - Any layout at the four named breakpoints (320/375/390/430px) in an actual viewport — the header/cart-row/
    admin-table/bill-table fixes were sized by hand-computing worst-case content widths against the Tailwind
    classes applied, not by visually resizing a browser window.
  - Keyboard-only navigation through the new focus-visible rings, or screen-reader behavior of anything in
    this phase.
  - The admin fixed bottom nav's interaction with the mobile on-screen keyboard (a known rough edge for
    fixed-position bottom bars on some mobile browsers when a form input is focused) — not something this
    sandbox can reproduce without a real mobile browser.
  - Print output specifically re-checked after this phase's CSS changes (the `.bill-print-area`/`.no-print`
    rules were not touched, only colors elsewhere in the file, but a real print-preview pass wasn't re-run).
- Carried forward from the Phase 11 instructions directly: Supabase schema, RLS policies, and the
  authentication flow were not touched at all this phase (nothing in this phase's diff touches any
  `supabase/migrations/` file, any API route's auth check, or any RLS policy) — this is a styling/responsive
  phase only, by design.

## Verification performed (customer search fix)
- **`npm test` (`node --test src/**/*.test.ts`) — all 15 new tests pass**, run and actually observed passing,
  not assumed:
  ```
  ✔ matches the Tamil product name
  ✔ matches the English description, case-insensitively
  ✔ matches a single word from inside the description
  ✔ matches a multi-word phrase spanning the description
  ✔ matches a category name even when it's in neither the name nor description
  ✔ does not match unrelated text
  ✔ requires every word to match (AND across words), not just one
  ✔ an empty query matches everything
  ✔ a whitespace-only query matches everything
  ✔ leading/trailing spaces are trimmed
  ✔ repeated internal spaces are collapsed
  ✔ a product with no description (null) still matches on name only
  ✔ matching does not depend on availability
  ✔ normalizeSearchText lowercases, trims, and collapses whitespace
  ✔ getSearchQueryWords splits normalized text into words
  tests 15, pass 15, fail 0
  ```
- `npm run typecheck`, `npm run lint`, `npm run build` all pass with this change included.
- **Confirmed live against the real Supabase project** (read-only — no data written or changed): queried
  the real `products` table directly and confirmed the exact bug scenario exists in production data today
  (`பரோட்டா (1)` / `"Parotta (1 piece)"`, among many other Tamil-name/English-description products — this
  is the norm for this catalog, not an edge case). Then fetched the real running `/menu` page's
  server-rendered HTML and confirmed the full product list — Tamil names, English descriptions, and Tamil
  category names (e.g. `பரோட்டா வகைகள்` / "Parotta varieties") — reaches `MenuBrowser` exactly as the fix
  assumes, confirming the data shape the unit tests exercise matches real production data exactly, not a
  guessed shape.
- **Not independently verified**: the actual browser click-and-type search experience (typing "Parotta"
  into the real search box and watching the Tamil product appear) — there is no browser in this sandbox, so
  this was verified at the level the sandbox allows (the pure matching function, proven correct against the
  real product's exact strings) rather than end-to-end in a UI. The reasoning for why this is sufficient:
  the only thing standing between "the function is correct" and "the UI works" is the handful of lines
  wiring `query`/`activeCategory` into `matchesProductSearch`, which were read carefully rather than assumed
  (see "No new component-level/integration test was added" above) — but this is still a statement of
  confidence from code reading, not a substitute for an actual manual check in a browser before relying on
  this in production.

## Verification performed (Phase 12)
- `npm run typecheck`, `npm run lint`, `npm run build` all pass — checked after every batch of changes, and
  again at the end; the build output lists every new route (`/admin/reports`, `/admin/customers`,
  `/admin/customers/[id]`, `/change-pin`, the 4 export routes, the 2 customer routes, `/api/auth/change-pin`).
- **Live-tested against the real Supabase project**, with one disposable test staff account created via the
  Admin API and deleted again afterward. **No real customer or order data was ever created, modified, or
  deleted** — every check against real orders/customers below was a plain `GET` (read-only); the one `POST`
  against a real customer (`reset-pin`) failed before touching anything, for the reason explained next.
- **Confirmed pre-migration graceful degradation** (none of `20260101000021`/`22`/`23` are applied yet) —
  reproduced the exact Postgres/PostgREST errors live, the same discipline as every previous phase:
  - `/admin/reports` returns **200** with every stat card showing `0`/`₹0` and "No orders in this range" for
    the trend table, instead of crashing — server logs show the expected `PGRST202` ("Could not find the
    function public.admin_report_summary...") for each of the 5 new RPCs, confirming this is the missing
    migration, not a code bug.
  - `/admin/customers` returns **200** with "No customers yet" (same `PGRST202` pattern for
    `admin_list_customers`).
  - `/admin/customers/[id]` for a real customer id returns a clean **404** — `getAdminCustomerDetail()`'s
    profile `select` includes `pin_reset_required`, which doesn't exist yet, so the whole query fails and the
    page correctly treats "no profile" as not-found rather than crashing.
  - `POST /api/admin/customers/[id]/reset-pin` against a real customer returns a clean **500**
    (`PGRST202` for `admin_reset_customer_pin`) — confirmed **no row was touched**, since the function call
    never got far enough to run its `UPDATE`.
  - The customer-facing **"Call Kumaran Mess" button already works today**, pre-migration — confirmed live by
    fetching the real homepage and finding `tel:+919344689836` in the rendered HTML. This works because
    `getShopSettings()`'s existing try/fallback (Phase 10) returns `DEFAULT_SETTINGS` — updated this phase to
    include the phase's specified default phone number — the moment the `shop_settings` query fails for any
    reason, migration-related or not.
- **Confirmed already working today, no migration needed** — these don't depend on any new column/function:
  - **Call Customer** on a real order: fetched a real admin order detail page and found `Call Arun` rendered
    with `tel:+919876543211` — the order's actual customer phone, correctly formatted. The admin orders list
    page showed the same pattern across multiple real orders.
  - **Unauthenticated/unauthorized access** is rejected everywhere it should be: `/admin/reports` and
    `/admin/customers` redirect (**307**) to login when there's no staff session (same mechanism as every
    other admin page); the `reset-pin`, export, and customer-edit API routes all return **403 `forbidden`**
    with no session.
  - The Shop Settings page renders the new "Customer-facing contact number" and "WhatsApp contact number"
    fields correctly (confirmed by inspecting the rendered HTML) — the form was not submitted against the
    live database to avoid touching the real shop's settings row without the owner's intent.
  - **Excel export works completely, right now, independent of the pending migrations** — because
    `getReportSummary()`/`getSalesTrend()`/etc. in `src/lib/reports.ts` all catch the RPC error and return
    empty/zero data rather than throwing, the export routes still produce a complete, valid file. All 4 were
    downloaded and checked: the `file` command identifies each as "Microsoft Excel 2007+" (not a renamed
    CSV); each is a well-formed OOXML zip (`[Content_Types].xml`, `xl/workbook.xml`, per-sheet XML, a
    `sharedStrings.xml` all present and parseable); `Content-Disposition`/`Content-Type` headers are correct;
    and the filenames exactly match the patterns given in the instructions
    (`monthly_sales_2026-10.xlsx`, `customer_wise_sales.xlsx`, `product_wise_sales.xlsx`,
    `order_details_2026-10-01_to_2026-10-31.xlsx`) — all confirmed by extracting and reading the actual XML,
    not just trusting the file extension. The Monthly Sales workbook's "Report Info" sheet was read directly
    and shows exactly the expected content (report name, resolved date range, "All statuses", "Cash on
    Delivery (only method supported)", a real generation timestamp).
  - A malformed/missing export request (`start`/`end` omitted) returns a clean **400 `invalid_date_range`**
    rather than crashing.
- **Not verified, because it requires the pending migrations applied first**: the actual reset-PIN → forced
  `/change-pin` → successful relogin flow end to end; `pin_reset_required` actually round-tripping through
  `verify_customer_pin()`'s new output column; `admin_report_product_wise()`'s "historical report unaffected
  by a later product rename/reprice" guarantee against real data (the SQL grouping logic was written and
  reviewed carefully — see that section above — but not exercised against a live database); the 4 export
  routes' content once real orders/customers/products exist to report on (checked above only against empty
  data, which is the correct degradation but not the same as checking real numbers add up correctly);
  `customer_pin_resets` actually being written by a successful reset; and the "every word must match" edge
  cases of the reporting status/payment-method filters against real varied data.
- **Not verified at all in this sandbox** (no browser, same limitation as every UI-heavy phase since Phase 9):
  the Reports page's filter form/tab navigation/mobile card layouts actually used in a browser; the
  ResetPinDialog's keyboard/Escape/focus behavior; the sales-trend SVG chart's visual appearance; the admin
  bottom nav's now-7-items density at 320px (flagged above as a real, not-yet-confirmed concern).

## Verification performed (forgot-PIN OTP removal + migration status update)
- `npm run typecheck`, `npm run lint`, `npm run build` all pass. One real build-cache issue hit and fixed
  along the way: deleting the two API route files left stale generated type-validator files in `.next/`
  referencing the now-gone routes, which made `tsc --noEmit` fail on its own until a clean `next build`
  regenerated them — not a code bug, just a stale-cache artifact resolved by clearing `.next/` and rebuilding
  (the build itself, which doesn't share that cache problem, passed throughout).
- **Live-tested against the real Supabase project**, with one more disposable test staff account created and
  deleted the same way as every previous phase. The real `/forgot-pin` page's rendered HTML was fetched and
  checked directly:
  - **Zero occurrences** of "verification code", "Verify", "OTP", or "one-time-code" anywhere on the page.
  - `Call Admin` renders with `tel:+919344689836` — the shop's actual configured contact number from
    `shop_settings`, read via `getShopSettings()`, not a value written into this page's own source.
  - `Contact Admin on WhatsApp` is **correctly absent** — confirmed live by querying `shop_settings` directly
    (`whatsapp_number` is currently `null` for the real shop), proving the "only show if configured" logic
    actually works both ways, not just when a number happens to be set.
  - `Back to Login` is present and the existing `/login` page's own "Forgot PIN?" link still points at
    `/forgot-pin` unchanged — confirmed the login page itself still returns 200 and wasn't affected.
  - The exact required message text ("For security reasons, customers cannot reset their PIN directly...")
    is present verbatim.
- **Important incidental finding, confirmed live, not caused by this fix**: while re-checking the project's
  migration status for this task, all three of Phase 12's migrations (`20260101000021`, `20260101000022`,
  `20260101000023`) turned out to **already be applied** to the live project — `orders.tax_amount`,
  `customer_profiles.pin_reset_required`, and the `admin_report_summary`/etc. RPCs all exist and return real
  data now. This must have happened between Phase 12 finishing and this task starting (presumably the shop
  owner applying them and trying the new admin features — one real customer now has
  `pin_reset_required = true`, consistent with the admin-assisted reset having actually been used for real).
  Taking advantage of this, a quick **read-only** re-check (same disposable-staff-account method) confirmed
  `/admin/reports` now shows real numbers (`Total orders: 12`, `Delivered orders: 7`, matching
  `admin_report_summary`'s own output exactly) and `/admin/customers` now lists real customers instead of
  "No customers yet" — Phase 12's features are confirmed working end-to-end against real data, not just the
  correct-degradation state that phase shipped and tested. **No data was changed by this check** — only
  `GET` requests were made against real records; the one real mutation this task made (creating/deleting its
  own disposable test staff account) never touched customer/order data.
- **Not verified**: the admin-assisted reset → forced `/change-pin` → relogin cycle still wasn't run
  end-to-end this round either (would require a real customer's actual current PIN, which this sandbox
  correctly has no way to obtain) — but the code path is unchanged from Phase 12 and the schema it depends on
  is now confirmed live, so this is the lowest-risk remaining gap, not an unknown one.
- **Not verified at all in this sandbox**: the page's visual appearance/contrast in light and dark mode, and
  on a real phone — same recurring no-browser limitation as every UI phase.

## Verification performed (dashboard metrics + product search/sort)
- `npm test` (24/24, including 9 new `product-sort.test.ts` cases: name/price/stock/category/status sorting
  in both directions, numeric-not-string price ordering, stable ties, a null-column no-op, and the
  `isProductSortColumn`/`isSortDirection` guards), `npm run typecheck`, `npm run lint`, `npm run build` all
  pass.
- **The new `admin_dashboard_stats()` SQL was not executed live** (migration `20260101000024` isn't applied
  yet), so it could not be called and checked the normal way. Instead, every real order placed/updated/
  cancelled/delivered "today" on the live project was fetched directly and the new SQL was **hand-traced
  against those real rows**, row by row, with a concrete predicted result stated before checking it against
  the data (not reverse-fitted afterward):
  - Confirmed the real bug first: the live (still-deployed, unpatched) `admin_dashboard_stats()` returns
    exactly the numbers in the task description (`7`/`₹1,580`/`1`/`5`/`3`) — this bug report was written
    against this exact project's real data, not a hypothetical.
  - Fetched the real order behind "Pending & Active: 1" directly: its `created_at` is `2026-10-10T18:15:34Z`,
    which is before that day's Asia/Kolkata midnight (`2026-10-10T18:30:00Z`) — i.e. placed on the
    **previous local day**, confirming the exact root cause (an old active order counted as if it mattered
    for "today").
  - Fetched the 7 real orders placed "today" (half-open Asia/Kolkata bounds) directly: 5 `delivered`, 2
    `cancelled`, 0 in any active status — so the new, correctly-scoped `active_order_count` would be **0**,
    not 1, for this exact live snapshot (predicted by hand-tracing the new SQL, not observed from a running
    function).
  - Fetched `order_status_history` rows for `to_status = 'delivered'`/`'cancelled'` within today's bounds
    and compared them against the old `orders.updated_at`-based query: for delivered orders the two methods
    happen to agree in this snapshot (expected — `delivered` is terminal, so nothing can ever update a
    delivered order's `updated_at` again after the delivery transition itself, meaning the two timestamps
    can never diverge for that specific status). For cancelled orders, **two of the three real
    cancellations found were orders placed the previous day** — a live, real-data demonstration of exactly
    the "orders delivered/cancelled today that were placed earlier" scenario the task asked to test, and
    confirmation that `order_status_history`-based counting handles it correctly (it doesn't care when the
    order was placed, only when the transition happened).
  - Based on this trace, the predicted new output for this exact moment is `todays_order_count=7,
    todays_sales=1580, active_order_count=0, delivered_today_count=5, cancelled_today_count=3` — stated here
    as a falsifiable prediction to check once the migration is applied, not claimed as an observed result.
- **`admin_search_products()` likewise isn't live yet** — confirmed via a direct RPC call returning the
  expected `PGRST202` ("Could not find the function"). To verify the *logic* without the function existing,
  the exact `ilike`-OR expression the function uses was run directly against the real `products` table via
  PostgREST: searching `Parotta` (English) correctly matched 5 real products via their descriptions,
  including the Tamil-named `பரோட்டா (1)`; searching `பரோட்டா` (Tamil) correctly matched 2 real products via
  their names. Both confirm the search logic is correct against real bilingual catalog data.
- **Confirmed live, with a disposable test staff account (created and deleted the same way as every previous
  phase)**: the admin Products page still renders the full real product list (real Tamil/English names,
  correct prices/stock, nothing hidden) even with the migration missing — the fallback in `getAdminProducts()`
  works exactly as designed, confirmed by checking the server log for the expected `PGRST202` immediately
  followed by a successful fallback query, and confirming the rendered page does **not** show "No products
  yet". Also confirmed, as the explicitly-documented tradeoff of that same fallback: searching for a
  deliberately nonexistent term still returned all 60 real products rather than filtering — search is visibly
  present but inert until the migration lands, exactly as stated above, not silently broken or crashing.
  Sorting was confirmed fully working today, independent of the migration: `?sort=price&dir=desc` against
  the real catalog returned prices in correct descending numeric order (`180, 140, 140, 130, 120, 120, 110,
  100, 100, 100, …`), and the column header's indicator correctly showed `▼` in the active color with an
  aria-label reading "currently descending — click for ascending".
- **No real data was changed.** Every check above was a `GET`/read-only RPC call; the one disposable test
  staff account used to reach the staff-gated pages was deleted afterward, the same discipline as every prior
  phase.
- **Not verified**: the new `admin_dashboard_stats()` and `admin_search_products()` functions actually
  executing (as opposed to hand-traced/logic-checked) — needs the migration applied first. The mobile sort
  `<select>` control and the sortable header icons' actual appearance/contrast in a real browser, in both
  themes — no browser in this sandbox, same recurring limitation as every UI-facing change.

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

**New: migration `20260101000024` is pending** (the dashboard-metrics fix and `admin_search_products()`).
Until it's applied: the dashboard shows the old, inconsistent numbers (confirmed live — see "Verification
performed (dashboard metrics + product search/sort)" above); the admin Products page's search box is
visible but doesn't filter (falls back to showing every product rather than breaking); sorting already
works regardless, since it runs in JavaScript over whatever the page fetched.

**Update, confirmed during the forgot-PIN OTP-removal fix: all three migrations Phase 12 needed
(`20260101000021`, `20260101000022`, `20260101000023`) are now applied to the live project** — the paragraph
below describing them as "pending" is now out of date and kept only for history. Reports, Customer
Management, and admin-assisted PIN reset are confirmed working against real data now (see "Verification
performed (forgot-PIN OTP removal + migration status update)" above), not just the graceful-degradation
state Phase 12 shipped and tested against. The admin bottom nav is still denser (7 items instead of 5) and
still hasn't been checked on a real 320px phone.

~~**As of Phase 12, three migrations are pending on the live project, in order: `20260101000021` (Phase 10),
`20260101000022`, and `20260101000023` (this phase)** — until all three are applied, Reports, Customer
Management, and admin-assisted PIN reset all run in their documented graceful-degradation state (zero/empty
data, clean 404s, clean error responses — confirmed live, see "Verification performed (Phase 12)" above),
not their real, working state.~~

**As of Phase 11, no real browser/device was available to visually confirm the new theme toggle, the
320–430px responsive layouts, or the admin bottom-nav/keyboard interaction** — see "Verification performed
this phase (Phase 11)" above for the complete list of what was reasoned through from the actual code
instead of seen. This is the same sandbox limitation noted in every previous phase, now specifically
affecting the one phase where a real viewport matters most.

**As of Phase 10, migration `20260101000021` is not yet applied to the live project** — see "Verification
performed this phase (Phase 10)" above for exactly what that blocks (bill content rendering, the
WhatsApp audit-log insert, the new `shop_settings` fields). Everything else in this section predates
Phase 10 and is otherwise unchanged:

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
**First: apply migration `20260101000024_dashboard_stats_and_product_search.sql`** (Supabase SQL Editor,
same as always — no CLI/Docker/psql access in this sandbox), then confirm the dashboard actually shows the
predicted numbers from this fix's hand-traced verification above (as of this writing: `todays_order_count=7,
active_order_count=0, delivered_today_count=5, cancelled_today_count=3` — though by the time this is read,
real orders will have moved on, so re-derive the expected numbers from whatever "today" actually looks like
then rather than expecting these exact figures), and confirm product search actually filters (try "Parotta"/
"பரோட்டா" on the real admin Products page — already confirmed correct at the SQL level, just needs the
function to exist).

**Then, the remaining gap is still a real device/browser** (the recurring theme across Phases 9-14, since
this sandbox has none). On one: run a full admin-assisted reset-PIN → forced `/change-pin` → relogin cycle
against a real test customer end to end; click through `/forgot-pin` itself and the new Products page
search/sort controls (including the mobile `<select>` sort control, never visually confirmed) in both light
and dark mode; resize the app at 320/375/390/430px, paying particular attention to the admin bottom nav (7
items) and the customer header's Call button at exactly 320px; click through the Reports page's filter
form/tabs and the ResetPinDialog's keyboard/Escape behavior; and open a downloaded export `.xlsx` in actual
Microsoft Excel or Google Sheets to confirm it opens cleanly (confirmed so far only via file-type detection
and reading the raw XML). Also worth a real spot-check: `admin_report_product_wise()`'s "historical report
unaffected by a later product rename/reprice" guarantee, against a real product edited after a real order.

**After that, the Phase 9 deployment plan still stands, unchanged:** (1) follow `docs/DEPLOYMENT.md` to
actually deploy to Vercel against a decided Supabase project; (2) choose and configure a real SMS provider
(budget real time for India's TRAI DLT registration, not just an API signup); (3) run
`docs/FINAL_TESTING_CHECKLIST.md` end to end on a real phone/browser, both locally and against the deployed
URL, now including every phase through this one; (4) fix whatever that surfaces. Only after that is
"production ready" something I'd actually sign off on rather than qualify. After that: a staff account
management UI for `provision_staff()`/`deactivate_staff()` (Phase 2, still has no UI), bulk order actions,
and — only if explicitly requested — real automatic WhatsApp sending via the official WhatsApp Business
Platform API (a genuinely separate, much larger integration from Phase 10's manual click-to-chat) are
reasonable next feature candidates — additions, not prerequisites.

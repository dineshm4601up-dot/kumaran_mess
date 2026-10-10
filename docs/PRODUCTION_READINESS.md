# Production readiness — Phase 9

**Verdict: not yet production-ready, but closer than any previous phase —
most of the core flow has now been exercised live for real, not just
reviewed.** The specific gaps are listed under "Not verified" below; they
are the reason this isn't an unqualified "yes," not a formality.

This document is the honest record of what was actually checked in this
phase and how, so "production ready" isn't a claim resting on having
written the code carefully — per the explicit instruction not to claim
readiness without the checks having actually passed.

## What changed this phase (real fixes, not just review)

Two genuine issues were found and fixed, not just confirmed-fine:

1. **OTP codes could leak into production logs.** The `console` SMS
   adapter (`src/lib/sms/send-sms.ts`) logs the raw OTP code — correct and
   necessary for local dev, but if `SMS_PROVIDER` were ever left
   unconfigured in a real deployment, every registration/recovery OTP
   would be printed to Vercel's log viewer (or whatever aggregates it) in
   plaintext. Fixed: the adapter now refuses to log (and fails the send
   instead) when `NODE_ENV=production` and no real provider is
   configured, rather than silently leaking codes.
2. **Staff cancelling an order already out for delivery returned a
   confusing 500.** The cancel route only recognized the trigger's
   "terminal state" error message, not its "Illegal order status
   transition" one — so cancelling a non-cancellable-but-not-yet-terminal
   order fell through to a generic `cancel_failed` 500 instead of a clean
   400. Caught by actually attempting it live (see below), not by review.
   Fixed to recognize both.

A third, minor accessibility gap was also fixed: the admin product-image
file input had no accessible name at all (no `label`, no `aria-label`) —
given one.

## Security review

### RLS policies — reviewed across all 20 migrations
Every table has RLS enabled; there is no table in this schema without it.
Pattern used throughout: public/anon gets read-only access to exactly
`categories`/`products` (active/available only) and `shop_settings`
(non-sensitive config); every other table denies `anon` entirely. Within
`authenticated`, customers can only ever read/write rows matching their
own id (`customer_id = auth.uid()` for direct-RLS tables, or — since
customers don't hold real Supabase sessions, see below — explicit
`customer_id = <session's own id>` filtering in application code for
everything else). Staff get broad read access gated by `is_staff()`, and
narrow, column-restricted write access (`status`/`payment_status`/
`cancelled_reason`/the two payment-audit columns on `orders` — never
`subtotal`/`total`/`delivery_fee`, never anything on `order_items`).

### API authentication/authorization — reviewed across all ~30 routes
Every route under `/api/admin/*` and `/api/orders/*`/`/api/addresses/*`/
`/api/checkout/*` starts with an explicit session check
(`getStaffContext()` or `getCustomerSession()`) before touching anything,
confirmed by reading each file, not by sampling. The one architecturally
load-bearing fact worth restating: **customers never hold a real Supabase
Auth session** (a deliberate choice since Phase 3 — see that phase's
architecture notes) — every customer-facing read/write is scoped
explicitly in application code to the session's own `customer_id`, using
the service-role client. Staff status/payment/cancel actions deliberately
use the *staff member's own* Supabase session instead (Phase 7), so audit
attribution (`changed_by`/`payment_updated_by`) is correct.

### Service-role key never reaches the browser — verified, not assumed
`grep` confirms exactly one file (`src/lib/supabase/admin.ts`, guarded by
`import "server-only"`) references `SUPABASE_SERVICE_ROLE_KEY`, and every
file importing it is a Server Component, Route Handler, or server-only lib
— none is a `"use client"` file. Beyond that static check, a **real
production build was run** and `.next/static/` (the only part of a Next.js
build actually served to browsers) was searched for the key's unique
signature suffix — not found. A control search for the anon key's
equivalent suffix *did* find it (correctly, since that one is meant to be
public), confirming the search methodology itself works rather than
silently failing to match anything.

### Rate limiting / account lockout — re-read, then exercised live
`verify_customer_pin()`: 5 wrong attempts locks for 15 minutes — **live
confirmed** this phase (and in Phase 3): the 5th wrong attempt returns
`locked`, and the *correct* PIN is then also rejected until the window
passes. `request_phone_otp()`: 60-second cooldown + 5/hour cap — re-read,
logic unchanged since Phase 3 where it was last exercised live.

### Upload validation — re-read, then exercised live this phase
`src/lib/validation/image.ts` checks declared size, declared
Content-Type, **and** sniffs the actual file's magic bytes against
known JPEG/PNG/WEBP signatures. **Live confirmed this phase**: a text file
renamed `.png` with a spoofed `image/png` Content-Type was rejected
(`content_mismatch`); a 6 MB file was rejected (`file_too_large`); a real
1×1 PNG uploaded, replaced (old file cleaned up — confirmed via the
Storage object-list API, not the CDN-cached public URL, which can still
briefly 200 a just-deleted object), and removed correctly.

### Order total manipulation / unauthorized status changes — exercised live
Sent a real checkout request with `total: 1, subtotal: 1, price: 1`
injected into the body alongside real items — `place_order()` has no
parameter for any of those at all, and the created order's total came
back correctly computed from the current product price
(2 × ₹70 + ₹30 delivery = ₹170), not the injected ₹1. Separately confirmed
a logged-in customer session gets `403 forbidden` hitting
`/api/admin/orders/[id]/status` and `/payment` directly — not just
unauthenticated requests, a real customer's own valid session.

### Logs — audited for PIN/token/PII exposure
Every `console.error`/`console.log` call in `src/` was read. All but one
log a generic Postgres/Supabase error object (`{message, details, hint,
code}`) or a route label string — never a raw request body, PIN, or
session token. The one exception was the OTP-logging issue above, now
fixed.

### `npm audit`
5 high-severity advisories, all in the `braces`→`micromatch`→`fast-glob`→
`@next/eslint-plugin-next`→`eslint-config-next` chain — a **dev-only lint
dependency**, never shipped to production or exposed to untrusted input.
Unchanged since Phase 1; the suggested fix downgrades `eslint-config-next`
to a version incompatible with Next 16, so left as-is.

## Testing — what was actually exercised live this phase, with real fixtures

All of the following used disposable test accounts/orders/images created
via the Admin API and deleted afterward — the two real customer accounts
and orders already in the project (from your own earlier testing) were
never touched.

- **Registration**: success, duplicate-phone rejection, missing address,
  invalid phone format, PIN mismatch — all correct.
- **Login**: success, 5-attempt lockout, correct PIN rejected while
  locked, enumeration-safe identical response for a wrong PIN vs. a
  nonexistent number.
- **PIN recovery**: OTP delivered (console-logged) only for a registered
  number, identical response either way, successful reset clears the
  lockout, old PIN stops working, new PIN works.
- **Checkout**: unavailable product rejected, over-stock quantity
  rejected, out-of-service-radius address rejected (a real admin-configured
  5 km radius around a real store location), price-manipulation attempt
  ignored (server-computed total used instead), **duplicate submission
  with the same idempotency key returned the original order and did not
  decrement stock a second time**.
- **Customer isolation**: a second customer's session gets `not_found`
  (not a different error) reading *and* attempting to cancel the first
  customer's order by its real UUID.
- **Admin order management**: full status pipeline
  pending→confirmed→preparing→ready→out_for_delivery→delivered exercised
  in order; an illegal jump (pending→delivered) rejected with a clear
  message; cancelling an out-for-delivery order rejected (after the fix
  above); COD collection recorded as a separate action from delivery
  status; the order detail page's timeline correctly attributed every
  change to the test staff account by name; the customer's own tracking
  page reflected the final "Delivered"/"Collected" state.
- **Admin authorization**: every new admin route and page rejects both an
  unauthenticated request and a real logged-in *customer's* session
  (403/307), not only "no session at all."
- **Product images**: upload, replace (with confirmed cleanup of the
  orphaned old file), remove, content-type spoofing rejection, oversized
  rejection — all against the real Storage bucket.

## Not verified — be clear-eyed about this before calling it done

- **Mobile responsiveness and accessibility on a real device/browser.**
  This sandbox has no browser, only `curl` — everything above is API/page
  response verification, not visual or touch-interaction testing. The
  code was built mobile-first with Tailwind breakpoints and real
  `<label>`/`aria-label` associations throughout (spot-checked this
  phase, one gap found and fixed), but that is not the same as someone
  actually using it on a phone.
- **A real Vercel deployment.** Nothing in this phase was deployed — see
  `docs/DEPLOYMENT.md` for the runbook. Everything above was tested
  against `next dev` / `next build` pointed at the real Supabase project,
  not a deployed production build behind Vercel's edge network.
- **A real SMS provider.** `SMS_PROVIDER` is still `console` in
  `.env.local`. OTP delivery has only ever been confirmed by reading the
  dev server's log, never by receiving a real text message.
- **Real concurrent load.** The stock-decrement race-safety (atomic
  `UPDATE ... WHERE stock_quantity >= qty`) was designed to be correct
  under concurrency and reasoned about carefully, but this sandbox cannot
  actually fire two simultaneous requests at the same last unit of stock
  to prove it under real contention.
- **Supabase/Vercel's own infrastructure-level guarantees** (backups
  actually restoring, uptime, etc.) — out of scope for this project's own
  testing; that's what their respective SLAs/docs cover.

## Known limitations (carried forward, not new to this phase)

- Registering with a phone number you don't own is possible (Phase 3,
  user-directed change) — the OTP machinery to close this still exists
  and is unused by registration, only by forgot-PIN.
- No public order-tracking-by-phone feature (Phase 6, deliberately not
  built — task made it conditional and preferred authenticated history).
- No staff account management UI — `provision_staff()`/`deactivate_staff()`
  (Phase 2) have no admin page calling them yet; new staff are provisioned
  via direct SQL for now.
- No price-adjustment workflow for existing orders (Phase 7, deliberate —
  see that phase's notes on why this isn't a gap so much as a boundary).
- Session sliding-renewal doesn't exist (fixed 30-day customer session
  expiry only).
- No automated test suite anywhere in this project — every verification
  to date, including this phase's, has been manual (`curl` against a
  real environment) or code review.

## Estimated third-party costs

Treat all of these as rough, and check the providers' own current pricing
pages before budgeting — they change, and I'm working from a mix of
official and third-party sources gathered during this phase, not a live
account on any of them.

| Service | Free tier | Paid, if you outgrow free |
|---|---|---|
| **Supabase** | 2 projects, 500 MB DB, 50K MAU — but free projects **pause after a week of inactivity**, which matters for a real store that needs to always be reachable | Pro: ~$25/mo base + compute (~$10/mo minimum for the smallest instance) — realistically $35–60+/mo once compute is included |
| **Vercel** | Hobby tier is free but explicitly **personal/non-commercial use only** — a real business storefront doesn't qualify | Pro: $20/seat/month, includes $20 usage credit, 1 TB bandwidth, 10M edge requests/mo |
| **Twilio (SMS, if chosen)** | None | Per-message, varies by country; India specifically requires TRAI DLT registration (a multi-day business process, not just signing up) before you can send to Indian numbers at all, regardless of provider |
| **LocationIQ (geocoding, if chosen over Nominatim)** | 5,000 requests/day, 2/sec, 60/min, forever — likely sufficient for a single store's checkout search volume | Paid plans are prepaid flat-rate (e.g. ~$45/mo for the next tier), not pay-per-use |
| **Nominatim (geocoding, default)** | Free, but its own usage policy caps it at 1 request/sec and explicitly prohibits "heavy use" — fine for a single small store's checkout volume in practice, but not something to rely on on principle for a commercial deployment | N/A (self-hosting Nominatim is the usual "upgrade path," which is its own infrastructure project) |

Bottom line for a single small mess/bakery: realistically **$0–25/month**
to start (Supabase free tier accepted with its pause caveat, or straight
to Pro; Vercel Hobby is not technically licensed for this use so budget
its Pro tier; Nominatim free; no SMS cost until a provider is chosen and
DLT-registered).

Sources consulted this phase (third-party aggregators, not official
pricing pages — verify before committing budget):
- [Supabase Pricing 2026 Guide — JetAdmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [Supabase Pricing Explained — FocusReactive](https://focusreactive.com/blog/supabase-price/)
- [Vercel Cost in 2026 — MakerKit](https://makerkit.dev/blog/saas/vercel-cost)
- [LocationIQ pricing — help.locationiq.com](https://help.locationiq.com/support/solutions/articles/36000061110-what-s-pricing-like-)

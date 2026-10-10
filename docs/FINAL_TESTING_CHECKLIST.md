# Final manual testing checklist

Everything marked **[verified]** was actually exercised live this phase
(via `curl` against the real Supabase project, with disposable test
fixtures created and cleaned up) — see `docs/PRODUCTION_READINESS.md` for
exactly how. Everything else needs a human with a real browser and phone,
which this sandbox doesn't have. Run this checklist once against
`next dev` locally, and again after a real Vercel deploy (URLs differ —
don't skip the second pass).

## 1. Registration, verification, PIN login, recovery

- [x] **[verified]** Register with valid details → account created, no
      OTP step (per the Phase 3 mid-phase change).
- [x] **[verified]** Register again with the same phone → rejected,
      clear message.
- [x] **[verified]** Missing address / invalid phone / mismatched PIN →
      each rejected with a specific message.
- [x] **[verified]** Login with correct PIN → works.
- [x] **[verified]** 5 wrong PINs → locked for 15 minutes; correct PIN
      also rejected until the lock clears.
- [x] **[verified]** Forgot-PIN: code only sent for a registered number
      (confirmed via server log), identical response either way, reset
      clears the lockout, old PIN stops working.
- [ ] On a real phone: the registration/login/forgot-PIN forms are usable
      one-handed, the numeric keypad appears for phone/PIN fields
      (`inputMode="numeric"` is set — confirm it actually triggers the
      numeric keyboard on both iOS and Android).
- [ ] With a screen reader (VoiceOver/TalkBack/NVDA): every field announces
      its label, every error message is announced when it appears.

## 2. Cart and checkout

- [x] **[verified]** Unavailable product rejected; over-stock quantity
      rejected; address outside the configured service radius rejected;
      injected fake `total`/`subtotal`/`price` ignored (server computes
      the real one); duplicate submission (same idempotency key) returns
      the original order, doesn't double-decrement stock.
- [ ] Add items on the Menu page, navigate away, come back — cart
      persists (localStorage). Close the tab entirely and reopen — still
      persists.
- [ ] On the checkout page's map: search for a real address, confirm
      results appear and selecting one moves the pin; try "use my
      location" and confirm the browser's **native** permission prompt
      appears (not a custom one) and only appears after clicking the
      button, never on page load; drag the pin and confirm the
      lat/lng display updates.
- [ ] Complete a real checkout end to end in a browser (not `curl`):
      confirm the loading state shows on the Place Order button, confirm
      the success screen shows a real order number, confirm double-
      clicking the button doesn't visibly submit twice.

## 3. Product image uploads

- [x] **[verified]** Valid upload succeeds; replacing an image cleans up
      the old file (confirmed via the Storage API, not the
      possibly-cached public URL); removing an image works; a
      content-type-spoofed file is rejected; an oversized file is
      rejected; unauthenticated upload attempts are rejected.
- [ ] In the browser: select an image in the admin product form, confirm
      the preview actually shows the picked file before saving (not just
      after).

## 4. COD order creation and status transitions

- [x] **[verified]** Full pipeline pending→confirmed→preparing→ready→
      out_for_delivery→delivered exercised in order; illegal jumps
      rejected; cancelling an out-for-delivery order rejected; COD
      collection recorded as a action separate from delivery status; the
      status timeline correctly attributes every change to the staff
      member who made it; the customer's own order page reflects the
      final state.
- [ ] In the browser, as staff: confirm only the *legal* next action
      button(s) are visible at each stage (not a full list that then
      errors on the wrong ones).
- [ ] In the browser: the delivery-location map on the admin order page
      renders, and "Open in navigation app" actually opens Google Maps
      (or the device's map app) centered on the correct pin.

## 5. Customer isolation and admin authorization

- [x] **[verified]** A second customer's session gets `not_found` (not a
      different error) reading or cancelling the first customer's order
      by its real UUID. Every new admin route/page rejects both an
      unauthenticated request and a real logged-in *customer's* session.
- [ ] In two different real browser profiles (or one normal + one
      incognito), log in as two different customers simultaneously and
      confirm neither ever sees a flash of the other's data.

## 6. Invalid input, duplicates, unavailable products

- [x] **[verified]** Covered above (registration validation, checkout
      rejection cases, duplicate order prevention).
- [ ] Try submitting forms with the browser's JS disabled or slow network
      throttling (DevTools → Network → Slow 3G) — confirm loading states
      and disabled buttons prevent obvious double-submission, and that
      nothing crashes outright on a slow response.

## 7. Mobile responsiveness and accessibility — not verified this phase, needs a human

- [ ] At 375px, 768px, and 1280px widths: Home, Menu, Cart, Checkout,
      Register, Login, Orders, Order Detail, and every `/admin/*` page
      render without horizontal scrolling or overlapping elements.
- [ ] The admin dashboard's sidebar (desktop) / horizontal nav (mobile)
      both work and show the same links.
- [ ] Run an automated accessibility scan (axe DevTools browser extension,
      or Lighthouse's Accessibility audit) against at least the
      Home/Menu/Register/Checkout/Admin-dashboard pages. This project's
      forms use real `<label>` associations throughout (one gap — the
      product-image file input — was found and fixed this phase by code
      reading; an automated scan may catch others a human reader missed).
- [ ] Tab through the Register, Login, and Checkout forms using only the
      keyboard — confirm focus order is logical and every interactive
      element (including the map's search results dropdown) is reachable.

## 8. Post-deployment only (after following `docs/DEPLOYMENT.md`)

- [ ] Every item above, re-run against the real production URL, not
      `localhost`.
- [ ] A real SMS actually arrives on a real phone for registration/
      recovery (if a real `SMS_PROVIDER` is configured — confirm it's not
      silently still `console`, which Phase 9 made refuse to send in
      production rather than leak the code to logs, so this would show up
      as a clear "couldn't send a verification code" error, not a silent
      failure).
- [ ] The bootstrapped admin account can actually log in at the real
      production URL.
- [ ] Clean up any test accounts/orders created during this pass the same
      way every test in this project has been cleaned up — delete them
      via the Admin API or SQL Editor afterward, don't leave disposable
      test data in the production database.

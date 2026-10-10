# Phase 3 manual test checklist — customer registration & authentication

Run these against a **development** Supabase project, with `SMS_PROVIDER=console`
(the default) so forgot-PIN codes print to the terminal running `npm run dev`
instead of requiring a real SMS account. Registration no longer uses OTP at
all (see PROJECT_PROGRESS.md's "Mid-phase change" note) — OTP only appears
in the forgot-PIN flow now.

Items marked **✅ confirmed live** were already exercised with real HTTP
requests against the actual route handlers and a real (since-deleted) test
account on the live Supabase project, as part of building this phase — they
don't need to be re-run, just worth knowing they're not hypothetical. The
rest (mostly visual/UX/browser-only checks, and anything needing two
simultaneous browser sessions or a real admin password) still needs a human
with a browser.

## 0. Setup (once)

- [x] Apply `supabase/migrations/20260101000013_phone_auth.sql` and
      `20260101000014_customer_addresses_nullable_coordinates.sql` — **done**,
      confirmed applied on the live project.
- [x] At least one admin exists in `staff_users` — **confirmed**, one active
      admin row exists already.
- [x] `.env.local` has real Supabase credentials — **confirmed**.
- [ ] `npm run dev`, keep the terminal visible — forgot-PIN codes print there
      as `[dev-sms] ... Message: Your Kumaran Mess ... code is XXXXXX ...`.

## 1. Registration — happy path

- [ ] Go to `/register`. Leave every field empty and submit — every field
      shows an inline, specific validation message (not a generic banner),
      and the labels read correctly with a screen reader / by tabbing
      through (each field has a visible, associated `<label>`).
- [ ] Enter a full name, a **valid** 10-digit Indian mobile number
      (starts 6-9), a 4-digit PIN, a different confirm-PIN — see the
      "PINs do not match" error specifically.
- [ ] Fix the confirm-PIN, leave address blank — see the address-required
      error.
- [x] Fill in a valid address, submit → account created immediately (no OTP
      step). **✅ confirmed live**: a real `auth.users` row, a
      `customer_profiles` row with a correctly-formatted bcrypt hash, and a
      `customer_addresses` row with `is_default: true` were all created by
      one real `POST /api/auth/register` call.
- [x] After submitting, you're redirected to the homepage, logged in, header
      shows "Hi, `<first name>`". **✅ confirmed live** (session cookie set,
      `/api/auth/me` resolved it back to the right customer).
- [ ] In the browser devtools → Application/Storage → Cookies, confirm the
      `km_customer_session` cookie exists, is marked **HttpOnly**, and is
      **not** readable from `document.cookie` in the console. (The HttpOnly
      flag itself was confirmed live via a raw cookie-jar inspection; actually
      checking `document.cookie` in a real browser console hasn't been done.)

## 2. Registration — duplicate phone number

- [x] Registering again with the same mobile number returns
      `{"error":"already_registered"}` rather than creating a second
      account. **✅ confirmed live.** In the UI, this shows as "already
      registered... log in instead" without creating anything.

## 3. Login

- [x] Correct phone + PIN logs in (session cookie set). **✅ confirmed live.**
- [x] Wrong PIN on a real account → `{"error":"invalid_credentials"}`.
      **✅ confirmed live.**
- [x] A mobile number that was **never registered** → **byte-identical**
      `{"error":"invalid_credentials"}` response (no distinguishing field).
      **✅ confirmed live** — this is also where a real bug was caught and
      fixed: the response used to include `attemptsRemaining` (a number for
      a real account, `null` otherwise), which would have let a caller
      hitting the API directly tell accounts apart. Fixed before this was
      ever shipped. In the browser UI, both cases show the same "Incorrect
      mobile number or PIN" text regardless.

## 4. PIN lockout (rate limiting — acceptance criterion)

- [x] Five cumulative wrong PIN attempts on one account → the response
      switches to `{"error":"locked","lockedUntil":"<~15 min out>"}`, and
      the **correct** PIN is then also rejected with the same lockout
      response until the window passes. **✅ confirmed live**, exactly as
      designed.
- [ ] In the browser UI specifically: confirm the message reads "Too many
      incorrect attempts. Try again after `<time>`." and that the time
      shown is formatted sensibly (this wraps the same confirmed-live API
      behavior, just checking the UI text renders it correctly).

## 5. Logout

- [x] Logging out clears the session: `/api/auth/me` returns
      `{"customer":null}` immediately after. **✅ confirmed live.**
- [ ] In the browser: clicking "Log out" in the header (desktop) or mobile
      menu visibly reverts to "Login", and navigating directly to `/orders`
      afterward redirects to `/login?next=/orders`.

## 6. Forgot PIN

- [x] Request-otp for a **registered** number: a real 6-digit code gets
      logged to the server console, and the API returns the generic "if
      that number is registered..." message. **✅ confirmed live** (read the
      actual code from the dev log and used it).
- [x] Request-otp for an **unregistered** number: the exact same generic
      message comes back, and — confirmed by reading the log — **no code is
      generated or logged** for that number, so no SMS cost is ever incurred
      probing for accounts that don't exist. **✅ confirmed live.**
- [x] Verifying with the correct code + a new PIN logs you in immediately,
      and crucially **also clears any PIN lockout** from section 4 (reset
      `pin_failed_attempts`/`pin_locked_until`). **✅ confirmed live**: the
      same account that was locked in section 4 logged in normally with its
      new PIN right after resetting.
- [x] The old PIN stops working after a reset; the new one works.
      **✅ confirmed live.**
- [ ] In the browser UI: the two-step phone → code+newPIN flow renders and
      submits correctly, loading states show on both steps.

## 7. Customer session isolation

- [ ] Register/log in as Customer A in one browser (or a normal window).
      Log in as Customer B in a second, fully separate browser profile or
      incognito window. Both independently reach `/orders` (empty for
      both — order placement doesn't exist yet) without any indication of
      the other's account. *(Not run — needs two real simultaneous browser
      sessions, which this sandbox couldn't simulate meaningfully beyond
      what the single-account testing above already covered.)*
- [x] There is no page or API in this phase that takes another customer's id
      as input, so there's nothing to directly probe for cross-customer
      leakage; `/orders` explicitly filters every query by the session's own
      `customer_id` (see `src/app/(site)/orders/page.tsx`) — confirmed by
      code review, consistent with the single-account live testing above.

## 8. Customer sessions cannot reach admin (requirement 11)

- [x] A real customer session cookie hitting `/admin` gets redirected to
      `/admin/login` (307). **✅ confirmed live**, against a real
      provisioned admin account.
- [ ] In the browser: confirm the same for `/admin/products` and
      `/admin/orders` directly, and for a fully logged-out visitor (no
      cookies at all).

## 9. Admin login

- [ ] At `/admin/login`, try an email/password that doesn't correspond to
      any account — "Incorrect email or password." *(Not run — no admin
      password was available in this sandbox to test the success path or a
      deliberately-wrong one against a real account.)*
- [ ] Log in with the real admin account — lands on `/admin` dashboard,
      topbar shows the staff email, sidebar/nav works.
- [ ] Click "Log out" in the admin topbar — returns to `/admin/login`, and
      navigating back to `/admin` redirects to login again (session
      actually cleared, not just a UI state change).

---

Anything still unchecked above is a real gap, not a formality — please run
it and report back anything that doesn't match.

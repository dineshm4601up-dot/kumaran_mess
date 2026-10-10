# Deployment guide

This covers getting the current state of this repo onto a production
Supabase project and Vercel deployment. It is a runbook for you to follow —
I have no Vercel account access and no way to execute a deploy from this
sandbox, so none of the Vercel steps below have been run by me. The
Supabase migration steps *can* be run from the SQL Editor regardless of who
does it; I've verified their SQL carefully but the actual `supabase db
push`/CLI path is also untested by me (no CLI available in this sandbox —
see `supabase/docs/SETUP.md`).

## 1. Decide: same Supabase project, or a fresh one?

Everything in this repo has so far been built and tested against one
Supabase project (the one in your current `.env.local`), which **already
has real data in it** — at least two real customer accounts and several
real orders as of this phase. Decide deliberately:

- **Promote this project to production** (simplest — nothing to migrate,
  real data already proven to work) — skip to step 3.
- **Start a fresh production project** and treat the current one as
  dev/staging — continue with step 2.

Either way, **do not skip applying migrations to whichever project goes to
production** — step 2 assumes a project with *none* of this repo's
migrations applied yet.

## 2. Apply database migrations (new project only)

In order, via the SQL Editor (Supabase Dashboard → SQL Editor) or
`supabase db push` if you have the CLI linked — see
`supabase/docs/SETUP.md` for both paths in detail:

```
supabase/migrations/20260101000001_extensions.sql
supabase/migrations/20260101000002_utility_functions.sql
... (all files, in filename order — they are timestamp-prefixed and
     already sorted correctly by `ls`)
supabase/migrations/20260101000020_admin_order_management.sql
```

There are 20 files as of this phase. Apply them **in order** — later ones
depend on objects earlier ones create. If you're using the SQL Editor
manually, paste and run one file at a time; don't concatenate them (a
failure partway through a concatenated paste is harder to diagnose than a
failure on a single file).

After applying all 20, verify with a couple of REST calls (replace
`<project-url>`/`<anon-key>`):

```bash
curl "<project-url>/rest/v1/shop_settings?select=*" -H "apikey: <anon-key>"
# expect a permission-denied-ish response is WRONG here — shop_settings is
# publicly readable, so this should return the one settings row.

curl -X POST "<project-url>/rest/v1/rpc/admin_dashboard_stats" -H "apikey: <service-role-key>" -H "Authorization: Bearer <service-role-key>"
# expect five numbers back, not a PGRST202 "function not found" error.
```

## 3. Create the storage bucket and policies

Already handled by migration `20260101000016_product_images_storage.sql`
— it creates the `product-images` bucket (public read, 5 MB limit,
JPEG/PNG/WEBP only) and its RLS policies as part of the normal migration
run above. There is no separate manual bucket-creation step as long as
that migration ran. Verify:

```bash
curl "<project-url>/storage/v1/bucket/product-images" -H "apikey: <service-role-key>" -H "Authorization: Bearer <service-role-key>"
```

should return the bucket's config (`"public":true`, `"file_size_limit":5242880`, `"allowed_mime_types":["image/jpeg","image/png","image/webp"]`), not a 404.

## 4. Bootstrap the first admin

See `supabase/docs/SETUP.md`'s "One-time manual step: creating the first
admin" section — create the owner's auth user via Dashboard →
Authentication → Users → **Add user**, then insert one row into
`staff_users` via the SQL Editor. There is no self-service way to become
the first admin by design (see Phase 2's notes on why).

**Verify it worked** before moving on — sign in at `/admin/login` with
that email/password locally (pointed at the production project via
`.env.local`, before you even deploy) and confirm you land on `/admin`
with the dashboard rendering real numbers (even if they're all zero).

## 5. Environment variables

Exact names, copied from `.env.example` — set every one of these in
Vercel (Project → Settings → Environment Variables), scoped to
**Production** (and Preview, if you want preview deployments to work
against the same or a separate project — your call):

| Variable | Value source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | Public, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API | **Server-only.** Verified in this phase that it's never bundled into client JS (see `docs/PRODUCTION_READINESS.md`) — but that guarantee only holds if it's set as a plain (non-`NEXT_PUBLIC_`) Vercel env var, same as locally. |
| `SMS_PROVIDER` | `twilio` (or your chosen provider) | **Do not deploy to production with this unset/`console`** — Phase 9 added a guard that refuses to send (rather than leaking the OTP to logs) if `SMS_PROVIDER` is `console` and `NODE_ENV=production`, but that's a safety net, not a substitute for actually configuring a real provider. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Twilio Console | Only if `SMS_PROVIDER=twilio`. Remember: India SMS needs TRAI DLT registration first (see Phase 3 notes) — budget days for that, not minutes. |
| `GEOCODING_PROVIDER` | `nominatim` (default) or `locationiq` | `nominatim` works with no key but is explicitly not for production volume (1 req/sec, no heavy use, per its usage policy). For a single small store, `nominatim` may genuinely be fine — see cost notes below. |
| `LOCATIONIQ_API_KEY` | locationiq.com account | Only if `GEOCODING_PROVIDER=locationiq`. |
| `NEXT_PUBLIC_SITE_URL` | Your production URL, e.g. `https://kumaranmess.com` or `https://your-app.vercel.app` | Used for links/redirects. Set this to the **real** final URL, not a placeholder — see step 7. |

Vercel-specific: `NODE_ENV=production` is set automatically by Vercel for
production deployments — you don't set it yourself, but it's what the
`SMS_PROVIDER=console` guard above checks.

## 6. Deploy to Vercel

I can't do this step — it needs your Vercel login. Either:

**Dashboard path:**
1. vercel.com → Add New → Project → import this Git repository.
2. Add all the environment variables from step 5 before the first deploy
   (or add them and redeploy).
3. Framework preset should auto-detect Next.js. Build command/output are
   the Next.js defaults — nothing custom was added in this repo.
4. Deploy.

**CLI path** (if you have the Vercel CLI installed and are logged in):
```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# ...repeat for every variable in the table above...
vercel --prod
```

## 7. Configure production site URLs and auth redirects

Two places need the real production URL, not `localhost`:

1. **`NEXT_PUBLIC_SITE_URL`** (Vercel env var, step 5) — set to your actual
   domain.
2. **Supabase Dashboard → Authentication → URL Configuration**:
   - **Site URL**: your production URL.
   - **Redirect URLs**: add your production URL (and any preview-deployment
     pattern if you want previews to work, e.g. `https://*.vercel.app`).

   This matters specifically for **staff login** — `/api/auth/admin/login`
   uses `@supabase/ssr`'s cookie-based session, and Supabase Auth checks
   redirect URLs for some flows. Customer auth (the custom
   OTP/PIN/session system) doesn't depend on this at all, by design — only
   the staff side uses real Supabase Auth sessions.

## 8. Post-deploy smoke tests

Don't trust the deploy until these pass against the **real production
URL**, not localhost. See `docs/FINAL_TESTING_CHECKLIST.md` for the full
list — at minimum, before telling anyone the site is live:

1. `/` and `/menu` load and show real products.
2. Register a real test account, confirm no OTP/SMS error (or confirm you
   got a real SMS, if a real provider is configured).
3. Log in, add something to cart, complete checkout, confirm a real order
   number comes back.
4. Log into `/admin/login` with the bootstrapped admin account, confirm
   the dashboard and order list show the test order from step 3.
5. Advance that test order through a couple of statuses, confirm the
   customer's `/orders/[id]` page reflects it.
6. **Delete the test account and order afterward** (same pattern used
   throughout this project's live testing — see `docs/PRODUCTION_READINESS.md`
   for exactly how).

## Rollback guidance

**Application code (Vercel):** Vercel keeps every previous deployment.
Dashboard → Deployments → pick a previous one → **Promote to Production**.
This is instant and doesn't touch the database — safe to do at any time.

**Database migrations:** there are no automated "down" migrations in this
repo — every migration here is additive (new tables/columns/functions) or
a `create or replace function` (safely re-runnable). None of them drop a
table or column. This means:
- Rolling back *application code* to an older deployment while the
  *database* has newer migrations applied is generally safe — older code
  just won't know about newer columns/functions and won't call them.
- Rolling back the *database itself* (undoing a migration) has no
  pre-written script. If a specific migration needs undoing, write a new
  migration that reverses just that change (e.g. `drop column ...`) rather
  than trying to edit history — same principle as never editing a
  migration file after it's been applied anywhere.
- **Before any destructive rollback on a production database with real
  data**, back it up first: Supabase Dashboard → Database → Backups (or
  `pg_dump` via the connection string) if you're on a plan with backup
  access, or at minimum export the affected tables via the SQL Editor.

**If a bad deploy already wrote bad data** (e.g. a bug caused incorrect
orders): fixing the code and rolling forward is usually safer than trying
to "undo" — identify the affected rows (the audit trails this project
builds — `order_status_history`, `payment_updated_at`/`by` — exist
specifically to make this identification possible) and correct them with
a targeted, reviewed SQL statement, not a blanket rollback.

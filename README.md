# Time Off Request System

A focused leave-management tool for a small school. Teachers submit requests; admins approve or deny from email with one click. No PTO accruals, no SSO, no multi-tenancy — deliberately small, deliberately solid.

> **Live demo:** _coming soon_ — the demo deployment is a separate Supabase project from production and resets its data daily. Admin login is shown openly on the page so reviewers can poke around.

---

## What it does

- **Teachers** open the homepage, fill out a single form (name, email, dates, leave type, reason), and submit. No account, no login — by design, see [SECURITY.md](./SECURITY.md) for the trust-model rationale.
- The server validates the dates, **looks up the request against a server-managed blackout-dates table**, and either auto-denies (if the dates overlap a blackout) or saves it as pending.
- **Admins** get an email with two HMAC-signed links (Approve / Deny). Clicking either lands on a confirmation page; clicking Confirm performs the action atomically.
- The teacher gets a confirmation email when the admin decides.
- **Admin dashboard** at `/admin` (password-protected) lists every request with status, plus a tab for managing blackout dates.

---

## Why it's interesting

The interesting parts aren't features — they're the boundaries.

- **No teacher auth, on purpose.** Magic-link auth was built and reverted (commit `44bd886`). For 10-20 teachers who know each other, social trust replaces cryptographic identity binding at a meaningful UX cost reduction. The trade-off is documented in [SECURITY.md](./SECURITY.md) with concrete conditions for when to reintroduce auth.
- **HMAC-signed approval links** scoped to `(id, action, approver_email, expiry)`. A leaked link can't be replayed by a different admin, against a different request, or past its 7-day window.
- **Single-use enforcement** uses a status transition (`pending` → `approved`/`denied`) as the consumption marker. The atomic `.eq('status', 'pending')` guard on the UPDATE makes simultaneous clicks resolve cleanly — exactly one succeeds, the other lands on "already reviewed."
- **GET → POST approval flow** because email-scanning malware (Outlook Safe Links, Gmail link rewriters) auto-prefetches URLs. The GET shows a confirmation page; only an explicit POST writes to the database.
- **Email-domain allowlist** fails closed. An unset `ALLOWED_EMAIL_DOMAINS` rejects every submission rather than silently letting everything through.
- **Rolling-window rate limiter** in three dimensions (per email, per IP, per admin session), fail-OPEN on database errors because the cost asymmetry favors availability during a DB hiccup over correctness of the limit.
- **Demo mode** is a single env var (`DEMO_MODE=true`) that bypasses the allowlist, suppresses outbound email, shows the admin password as a hint, and flips `robots.txt` to allow indexing — same codebase, two Vercel projects.

---

## Tech stack

- **Next.js 15** (App Router, Server Actions, Turbopack)
- **React 19**
- **TypeScript** in strict mode
- **Tailwind CSS v4**
- **Supabase** for Postgres + the service-role client
- **Resend** for transactional email
- **iron-session** for admin password-protected sessions
- **Vitest** for tests (92 currently)
- **GitHub Actions** for CI (type-check, lint, test)

No global state library, no ORM, no auth provider — the Supabase JS client + Server Actions are enough.

---

## Local setup

### 1. Clone and install

```bash
git clone <repo-url>
cd time-off-request-system
npm install
```

### 2. Create a Supabase project

[supabase.com/dashboard](https://supabase.com/dashboard) → New project. Free tier is fine.

Once it's up, apply the migrations. You have two options:

**Option A — Supabase CLI (recommended for ongoing schema work):**
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option B — dashboard SQL editor:** paste each file in `supabase/migrations/` into the editor, in order:
1. `20260310000000_initial_schema.sql`
2. `20260522000000_rate_limit_log.sql`
3. `20260522000001_enable_rls_existing_tables.sql`

For a demo deployment, run `supabase/seed.sql` afterward to populate realistic fake data.

After applying migrations, **expose the `public` schema in Supabase Dashboard → Project Settings → API** (it's exposed by default; just confirm).

### 3. Create a Resend account

[resend.com](https://resend.com) → add your sending domain and complete SPF + DKIM verification before going live. You can develop locally against the default `delivered@resend.dev` test address without verifying anything.

### 4. Configure env vars

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

`.env.example` documents every variable with its source and constraints. The ones that need fresh secrets:

```bash
# APPROVAL_HMAC_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Run

```bash
npm run dev
```

The teacher form is at [localhost:3000](http://localhost:3000), the admin dashboard is at [localhost:3000/admin](http://localhost:3000/admin).

---

## Demo mode

Set `DEMO_MODE=true` for a portfolio-friendly version of the same codebase:

- Allowlist bypassed (anyone can submit)
- All outbound email suppressed (logged to console)
- Admin password shown as a hint on the login page (`DEMO_ADMIN_PASSWORD`, separate from production's `ADMIN_PASSWORD`)
- `robots.txt` allows indexing instead of disallowing
- Amber banner on every page makes the mode obvious

The intended deployment pattern is **two Vercel projects from the same GitHub repo, pointing at separate Supabase projects**, differentiated only by env vars. Production uses `DEMO_MODE=false`; the portfolio demo uses `DEMO_MODE=true`.

---

## Tests and CI

```bash
npm test            # vitest run
npm run test:coverage   # with v8 coverage report
npm run lint
npx tsc --noEmit    # type check
npm run build       # production build
```

Pre-deploy security check (not yet wired into CI):
```bash
bash scripts/check-bundle-secrets.sh
```
Builds and greps the client bundle for any leaked secret-variable names — a guardrail against accidentally referencing `SUPABASE_SERVICE_ROLE_KEY` in client code.

GitHub Actions runs type-check + lint + tests on every push and PR — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Project layout

```
app/
├── (public)/              # teacher form (root URL)
├── (admin)/admin/         # password-gated admin dashboard
├── approve/[id]/          # approval confirmation page + Server Action
├── api/approve/           # legacy redirect shim for old email links
├── confirmation/          # post-submit thank-you page
├── reviewed/              # post-action confirmation for admins
├── invalid/, expired/     # error pages for tampered or stale tokens
├── layout.tsx             # demo banner + noindex meta
├── robots.ts              # dynamic robots.txt (gated by DEMO_MODE)
└── globals.css

lib/
├── auth/
│   ├── allowed-email.ts   # domain allowlist (fail-closed)
│   ├── session.ts         # iron-session wrapper
│   └── tokens.ts          # HMAC approval-link generate/verify
├── email/
│   ├── send.ts            # Resend wrapper, demo-mode suppression
│   ├── templates/*.ts     # one HTML template per email type
│   └── utils.ts           # date + leave-type formatting
├── rate-limit.ts          # Supabase-backed rolling-window limiter
├── supabase/server.ts     # service-role client (the only DB entry point)
└── config.ts              # required-env-var validation at startup

middleware.ts              # iron-session gate on /admin/*
supabase/migrations/       # forward-only SQL migrations
supabase/seed.sql          # demo data
tests/                     # vitest unit tests
types/database.ts          # handwritten Database type stub for supabase-js
```

---

## Security model

See [SECURITY.md](./SECURITY.md) for the full document. It covers:

- What the system protects against (forged clicks, replay, expiry, outside-domain submissions, volume attacks, search indexing, brute-force)
- What it explicitly does NOT protect against (sender authenticity, mistyped emails, compromised admin email, leaked secrets) and the social-trust mitigation
- Procedures for rotating each secret
- An "out of scope" section listing features intentionally not built (multi-school, SSO, PTO balances, audit logs, GDPR subject requests)
- Required production env vars and a pre-launch checklist

---

## Deployment

Deployed to Vercel. Two projects, same repo, distinguished by env vars:

- **Production:** `DEMO_MODE=false`, points at the production Supabase project, custom-domain Resend sender, real admin emails.
- **Demo:** `DEMO_MODE=true`, points at a separate Supabase project that resets daily, Resend optional (suppressed anyway), demo admin password openly displayed.

Every required env var is enforced at startup by `lib/config.ts` — a missing value crashes the build with a clear error rather than failing at request time.

---

## License

Private project for a specific school deployment. Code is published as a portfolio piece — feel free to read and learn from, but please don't deploy a copy for another organization without thinking through the trust-model assumptions in `SECURITY.md` first.

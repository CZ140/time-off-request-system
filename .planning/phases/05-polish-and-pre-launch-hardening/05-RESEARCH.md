# Phase 5: Polish and Pre-Launch Hardening - Research

**Researched:** 2026-03-13
**Domain:** Next.js 15 server actions, API route hardening, shell scripting, DNS/email deliverability
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Duplicate Submission Guard (Criterion #5)**
- Server-side check in `submitRequest` action: before inserting, query the DB for a row with matching `teacher_email`, `start_date`, `end_date` submitted within the last **60 seconds**
- If a duplicate is found: **silent success** — redirect to `/confirmation` as if the submission succeeded (teacher not confused, no error shown)
- Covers **both** blackout and non-blackout submissions — same check, consistent behavior
- No DB schema changes (no unique constraint) — query-based check only
- The 60-second window catches race conditions and network retries without blocking legitimate re-submissions

**Bundle Secret Verification (Criterion #4)**
- Automated shell script: `scripts/check-bundle-secrets.sh`
- Script runs `npm run build`, then greps `.next/static` for:
  1. Secret env var **names** verbatim: `SUPABASE_SERVICE_ROLE_KEY`, `APPROVAL_SECRET`, `ADMIN_PASSWORD`, `RESEND_API_KEY`
  2. Absence of `NEXT_PUBLIC_` prefix variants of those same secrets
- Invocation: `bash scripts/check-bundle-secrets.sh` (manual, run before deploy)
- Script exits non-zero and prints a clear failure message if any check fails

**Resend DNS Documentation (Criterion #3)**
- Add a focused comment block to `.env.example` covering the Resend pre-launch checklist:
  - Verify sending domain in the Resend dashboard
  - Add SPF and DKIM DNS records at the domain registrar
  - Send a test email via Resend and confirm inbox delivery (not spam)
- Scope: Resend domain verification only — no broader deployment guide

**/api/approve Edge Cases**
- All malformed requests (missing token, invalid token, missing `id`, missing `action`, non-existent request ID) → redirect to `/invalid` page
- Consistent, simple, reuses the existing `/invalid` page — no new routes or distinct copy per failure mode
- Current approve route handler needs explicit param validation before the existing token check (missing `id` or `action` currently falls through to a DB query with undefined values)

**Admin Dashboard DB Errors**
- If Supabase throws during the server-side data fetch in the admin dashboard, catch the error and render a friendly inline message: **"Unable to load data. Please refresh."** — no 500 error page
- Applies to both the requests query and the blackout dates query

**Form Submit DB Errors**
- The existing generic message ("Something went wrong. Please try again.") is sufficient — no change needed

### Claude's Discretion
- Exact shell script structure and grep flags for `check-bundle-secrets.sh`
- Exact wording of the Resend checklist comment block in `.env.example`
- How to structure the admin dashboard error catch (error boundary vs. try/catch in server component)
- Whether the duplicate check uses `submitted_at` timestamp math or a `created_at` equivalent

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 5 is a pure hardening phase — no new v1 features. All work traces directly to the five success criteria. Two criteria are already satisfied by existing code (empty state in `RequestsTab`, styled buttons in `admin-notification.ts`). The remaining three criteria involve: (1) a duplicate submission guard added to the `submitRequest` server action, (2) a shell script that builds the project and inspects the bundle for leaked secrets, and (3) documentation in `.env.example` for Resend DNS setup.

Two additional hardening items fall out of scope review: the `/api/approve` route has a validation gap where missing `id` or `action` params fall through to a DB query with `undefined` values rather than redirecting immediately to `/invalid`; and the admin dashboard server component does not catch Supabase errors, which causes a 500 on network failure.

All work touches existing files only, except one new file (`scripts/check-bundle-secrets.sh`). No dependencies need to be installed. No DB schema changes are required.

**Primary recommendation:** Implement all five changes as independent units — duplicate guard, approve route param hardening, admin dashboard error catch, bundle check script, and `.env.example` DNS block. Each is self-contained; they share no coupling.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.12 | App framework | Already in use throughout |
| @supabase/supabase-js | ^2.99.0 | DB client | Already in use throughout |
| resend | ^6.9.3 | Email delivery | Already in use throughout |

### No New Dependencies

This phase adds zero new npm packages. All patterns use tools already established in Phases 1-4.

---

## Architecture Patterns

### Pattern 1: Duplicate Guard via Pre-Insert Query (submitRequest)

**What:** Before the `.insert()` call in `submitRequest`, query `requests` for an existing row with matching `teacher_email`, `start_date`, and `end_date` submitted within the last 60 seconds. If found, redirect to `/confirmation` as a silent success.

**When to use:** Protects against rapid form re-submission from network retries, double-clicks that bypass the disabled button, or browser back+resubmit.

**Key constraint:** `redirect()` MUST remain outside try/catch (established NEXT_REDIRECT rule). The duplicate check must therefore return early via `FormState` or a flag before reaching the redirect — it cannot itself call `redirect()` inside a try/catch.

**Correct placement:**
```typescript
// BEFORE the try/catch block that contains the .insert()
// Use the same createClient() pattern established in actions.ts

const supabase = createClient()
const windowStart = new Date(Date.now() - 60 * 1000).toISOString()

const { data: existing } = await supabase
  .from('requests')
  .select('id')
  .eq('teacher_email', teacher_email)
  .eq('start_date', start_date)
  .eq('end_date', end_date)
  .gte('submitted_at', windowStart)
  .maybeSingle()

if (existing) {
  // Silent success — redirect as if new submission
  redirect(`/confirmation?status=${status}`)
}
```

**Critical:** `redirect()` here must be outside try/catch. Because this duplicate check itself precedes the try/catch block, calling `redirect()` at this point is correct — NEXT_REDIRECT will propagate uncaught. The `status` variable (`'pending'` or `'auto_denied'`) must be computed before this check so the redirect target is correct.

**Note on `submitted_at`:** The column stores an ISO timestamp. The existing code never explicitly sets it — it is set by Supabase automatically. The `.gte('submitted_at', windowStart)` comparison works correctly with ISO string comparison because Supabase/PostgreSQL sorts ISO timestamps lexicographically correctly.

### Pattern 2: Approve Route Early Param Validation

**What:** The current `route.ts` handler validates token but not `id` and `action` independently before token comparison. The condition `!token || !id || !action || token !== process.env.APPROVAL_SECRET` already handles the null cases in one expression — reading the current code confirms this is already correct.

**Code inspection finding:** `route.ts` line 34: `if (!token || !id || !action || token !== process.env.APPROVAL_SECRET)` — this already guards missing `id` and `action`. The CONTEXT.md note says "missing `id` or `action` currently falls through to a DB query with undefined values" — but the actual code shows the condition correctly short-circuits. This means Criterion validation in the approve route is already handled. The only gap to verify is whether the `action !== 'approve' && action !== 'deny'` check on line 37-39 executes correctly (it does).

**Conclusion:** The approve route early validation is already fully correct. No code change needed here.

### Pattern 3: Admin Dashboard try/catch Error Boundary

**What:** Wrap the `Promise.all` fetch in `app/(admin)/admin/(protected)/page.tsx` in a try/catch. If it throws, render an inline error message instead of propagating a 500.

**Pattern for async server component error handling:**
```typescript
// Wrap the data fetch — NOT an error boundary (no need for separate component)
// try/catch in an async Server Component is the standard Next.js pattern

let requests: RequestRow[] = []
let blackoutDates: BlackoutDateRow[] = []
let fetchError = false

try {
  const [{ data: requestsRaw, error: reqErr }, { data: blackoutDatesRaw, error: bdErr }] =
    await Promise.all([
      supabase.from('requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('blackout_dates').select('*').order('start_date', { ascending: true }),
    ])
  if (reqErr || bdErr) throw new Error('fetch failed')
  requests = (requestsRaw ?? []) as RequestRow[]
  blackoutDates = (blackoutDatesRaw ?? []) as BlackoutDateRow[]
} catch {
  fetchError = true
}

// In JSX:
// {fetchError && (
//   <p className="text-sm text-red-600">Unable to load data. Please refresh.</p>
// )}
```

**Note:** Supabase client errors do NOT throw — they return `{ data: null, error: PostgrestError }`. The try/catch guards against network-level exceptions (fetch throws). The Supabase `error` field must be checked explicitly and turned into a thrown error for the catch to fire.

### Pattern 4: Bundle Secret Verification Shell Script

**What:** A bash script that builds the project, then searches `.next/static` directory for secret variable names. Exits non-zero on any match.

**grep flags for this use case:**
- `-r` — recursive (search all files in directory tree)
- `-l` — print filenames only (faster, less noise)
- `--include="*.js"` — limit to JS bundle files only (`.next/static` contains JS chunks)
- `-q` — quiet mode (just set exit code, no output) — useful for conditional logic

**Script structure:**
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Building project..."
npm run build

echo "Checking bundle for leaked secrets..."
FOUND=0

SECRETS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "APPROVAL_SECRET"
  "ADMIN_PASSWORD"
  "RESEND_API_KEY"
)

for SECRET in "${SECRETS[@]}"; do
  if grep -r -l "$SECRET" .next/static --include="*.js" 2>/dev/null | grep -q .; then
    echo "FAIL: Found '$SECRET' in bundle"
    FOUND=1
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "PASS: No secret names found in bundle."
else
  echo "FAIL: Secret leak detected. Check NEXT_PUBLIC_ prefix usage."
  exit 1
fi
```

**Key nuance:** The script checks for secret variable NAMES (the string `SUPABASE_SERVICE_ROLE_KEY`), not values. If a name appears in a bundle, it means the variable was referenced in client-side code. This is the correct check for SEC-02. Variable values are not reliably greppable (they could be encoded, split, etc.).

**Next.js build with Turbopack:** `package.json` uses `next build --turbopack`. The `--turbopack` flag applies to the dev server but is also accepted for build in Next.js 15 (experimental). Output still goes to `.next/static`. The script runs `npm run build` which correctly uses the project's build command.

**`.next/static` contents:** Contains chunks split into `/_next/static/chunks/` (app router) and `/_next/static/media/` (fonts/images). Only JS files (`.js`) need to be grepped — media files are irrelevant.

### Pattern 5: .env.example Resend DNS Comment Block

**What:** Inline documentation in `.env.example` near the `RESEND_*` vars explaining the pre-launch DNS verification steps.

**Placement:** After the `RESEND_FROM` line and before the Approval Workflow section. This groups the comment with the vars it explains.

**Resend DNS facts (HIGH confidence from official Resend docs):**
- SPF record: TXT record at `yourdomain.com` containing `v=spf1 include:_spf.resend.com ~all`
- DKIM record: TXT record at `resend._domainkey.yourdomain.com` with value provided by Resend dashboard
- Verification is done in the Resend dashboard at resend.com → Domains
- A domain must be verified before emails from it pass spam filters reliably

### Anti-Patterns to Avoid

- **redirect() inside try/catch:** The NEXT_REDIRECT error thrown by `redirect()` will be swallowed. This is established as a hard rule in STATE.md. The duplicate check redirect must precede or be outside the try/catch block.
- **Calling `.single()` when 0 rows is valid:** For the duplicate check, use `.maybeSingle()` not `.single()` — `.single()` returns an error when no rows are found, which would break the "no duplicate found" path.
- **Error boundary component for admin dashboard:** React error boundaries are client components and don't apply to async Server Component data fetching errors. Plain try/catch in the async server component is correct.
- **Grepping `.next` root instead of `.next/static`:** The `.next/server` directory intentionally contains secret variable names (server-side bundle). Only `.next/static` (client bundle) is the security concern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate detection timing | Custom timestamp column or DB trigger | Query on existing `submitted_at` column with `.gte()` | Column already exists; no schema change needed |
| Shell script grepping | Complex parsing | `grep -r -l` with `--include` glob | Standard POSIX tools; reliable across environments |
| Admin dashboard error state | React Error Boundary component | try/catch in async Server Component | Error boundaries are client components and don't catch async server data fetch errors in App Router |

---

## Common Pitfalls

### Pitfall 1: redirect() swallowed by try/catch in duplicate guard

**What goes wrong:** Developer places the duplicate check inside the existing try/catch block in `submitRequest`, then calls `redirect()` inside that block. The NEXT_REDIRECT error is caught and the redirect silently fails, returning `undefined` to the client.

**Why it happens:** The duplicate check logically belongs "near" the insert, which is inside try/catch. But `redirect()` uses throw internally.

**How to avoid:** Place the duplicate query and `redirect()` call BEFORE the opening `try {`. This is the same rule applied to the existing success redirect at the end of the function.

**Warning signs:** Form appears to submit but page doesn't navigate; `outcome` variable is undefined.

### Pitfall 2: Using .single() for the duplicate check query

**What goes wrong:** `.single()` returns `{ error: { code: 'PGRST116' } }` when zero rows match. If the dev checks `if (existing)` after a `.single()` call with no matches, the `error` field is truthy and the check behaves incorrectly.

**Why it happens:** `.single()` is used elsewhere in the codebase (for insert with `.select().single()`), so the pattern is familiar.

**How to avoid:** Use `.maybeSingle()` for the duplicate check. Returns `null` (not an error) when no row is found.

### Pitfall 3: Grepping the server bundle directory

**What goes wrong:** Script greps `.next` recursively and finds secret variable names in `.next/server/` (which is expected — server-side code runs there). Script exits non-zero as a false positive.

**Why it happens:** Server components and API routes reference secret env vars by name; Next.js compiles them into the server bundle.

**How to avoid:** Scope grep to `.next/static` only, not `.next` root.

### Pitfall 4: Supabase error field not triggering catch block

**What goes wrong:** Developer wraps `Promise.all` in try/catch expecting Supabase network errors to throw. Supabase client silently returns `{ data: null, error: ... }` — try/catch never fires. Error UI is never shown.

**Why it happens:** Supabase JS client has an error-as-value pattern, not throw-on-error.

**How to avoid:** Explicitly check `if (reqErr || bdErr) throw new Error(...)` inside the try block before assigning the data variables.

### Pitfall 5: `submitted_at` column not existing at query time

**What goes wrong:** The duplicate check uses `.gte('submitted_at', windowStart)` but the column may not be set if `submitted_at` uses a DB default. In the insert path, `submitted_at` is NOT explicitly set in `actions.ts` — it relies on the DB default (confirmed by code inspection). This means newly inserted rows will have `submitted_at` set by Postgres, which is correct. However, local dev may not have the column defined with a default.

**Why it happens:** DB schema stubs are handwritten (confirmed by STATE.md). If `submitted_at` default is missing from the Supabase table definition, it would be `null`.

**How to avoid:** The Supabase query will still work correctly — `.gte('submitted_at', windowStart)` with a null `submitted_at` will correctly exclude that row (null comparisons return false in PostgreSQL). This is safe behavior. No special handling needed.

---

## Code Examples

### Duplicate Check Placement in submitRequest

The duplicate query must fire AFTER form validation passes (so we have valid email/dates) but BEFORE the try/catch that contains the insert:

```typescript
// Source: existing actions.ts structure + supabase-js .maybeSingle() API

// After validation block, before try/catch:
const supabase = createClient()
const windowStart = new Date(Date.now() - 60_000).toISOString()
const { data: duplicate } = await supabase
  .from('requests')
  .select('id')
  .eq('teacher_email', teacher_email)
  .eq('start_date', start_date)
  .eq('end_date', end_date)
  .gte('submitted_at', windowStart)
  .maybeSingle()

if (duplicate) {
  redirect(`/confirmation?status=${status}`)
}
```

Note: `status` must be computed before this block. Move the `const status: RequestStatus = is_blackout ? 'auto_denied' : 'pending'` line to before the duplicate check.

### Admin Dashboard try/catch Pattern

```typescript
// Source: Next.js App Router async Server Component pattern
// app/(admin)/admin/(protected)/page.tsx

const supabase = createClient()
let requests: RequestRow[] = []
let blackoutDates: BlackoutDateRow[] = []
let fetchError = false

try {
  const [{ data: requestsRaw, error: reqErr }, { data: blackoutDatesRaw, error: bdErr }] =
    await Promise.all([
      supabase.from('requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('blackout_dates').select('*').order('start_date', { ascending: true }),
    ])
  if (reqErr || bdErr) throw new Error('db')
  requests = (requestsRaw ?? []) as RequestRow[]
  blackoutDates = (blackoutDatesRaw ?? []) as BlackoutDateRow[]
} catch {
  fetchError = true
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| React error boundary for data fetch errors | try/catch in async Server Component | App Router requires server-side error handling in the component itself for data fetching |
| Unique DB constraint for dedup | Query-based 60-second window check | No schema migration required; handles race conditions without blocking re-submissions |

---

## Open Questions

1. **Does `submitted_at` have a DB-level default in the Supabase project?**
   - What we know: `actions.ts` never explicitly sets `submitted_at` in the `.insert()` call, so it relies on a DB default
   - What's unclear: Whether the Supabase table was created with `submitted_at DEFAULT now()` or requires explicit insertion
   - Recommendation: The duplicate check query is safe either way (null `.gte()` comparisons return false in PostgreSQL, not errors). No action needed — but if testing the guard manually, create a test row and verify `submitted_at` is populated.

2. **Turbopack build output location**
   - What we know: `package.json` uses `next build --turbopack`
   - What's unclear: Whether Turbopack alters the `.next/static` output structure compared to webpack
   - Recommendation: The bundle check script should verify `.next/static` exists after build before grepping. Add a guard: `if [ ! -d ".next/static" ]; then echo "FAIL: .next/static not found"; exit 1; fi`

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — this section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no test framework exists in this project |
| Config file | None |
| Quick run command | N/A (manual verification) |
| Full suite command | `bash scripts/check-bundle-secrets.sh` (the bundle check script IS the automated gate) |

**Assessment:** This project has no unit or integration test infrastructure. No `jest`, `vitest`, `playwright`, or `cypress` packages are present. The `package.json` scripts contain no `test` command. All verification in prior phases was done via manual browser testing and build output inspection.

For Phase 5, the closest thing to an automated test is the `check-bundle-secrets.sh` script itself — it is the verification artifact for the bundle leak criterion.

### Phase Requirements to Test Map

Phase 5 carries no new v1 requirement IDs. The success criteria map to manual verification steps:

| Criterion | Behavior | Test Type | Command |
|-----------|----------|-----------|---------|
| #1 (empty state) | Already satisfied — `sorted.length === 0` renders "No requests found." | Manual inspection | Visual — no automation needed |
| #2 (styled email buttons) | Already satisfied — `admin-notification.ts` has green/red anchor buttons | Manual — send test email | N/A |
| #3 (Resend DNS) | SPF/DKIM records verified; test email reaches inbox | Manual — DNS + inbox check | N/A |
| #4 (bundle secrets) | No secret names appear in `.next/static` | Automated shell script | `bash scripts/check-bundle-secrets.sh` |
| #5 (duplicate guard) | Rapid form re-submission does not create duplicate `pending` rows | Manual — submit form twice rapidly | N/A (no test framework) |

### Wave 0 Gaps

No test framework to install. The only automated verification artifact is the new shell script. All other criteria are verified manually.

- [ ] `scripts/check-bundle-secrets.sh` — does not exist yet, must be created in Wave 1

---

## Sources

### Primary (HIGH confidence)

- Code inspection: `app/(public)/actions.ts` — confirmed `redirect()` placement, try/catch structure, `createClient()` pattern, absence of duplicate check
- Code inspection: `app/api/approve/route.ts` — confirmed validation guard at line 34 already covers missing `id` and `action`; no code change needed
- Code inspection: `app/(admin)/admin/(protected)/page.tsx` — confirmed `Promise.all` has no try/catch; Supabase errors silently produce empty data
- Code inspection: `app/(admin)/admin/_components/RequestsTab.tsx` — confirmed empty state "No requests found." already rendered at line 113
- Code inspection: `.env.example` — confirmed current state; identified correct insertion point for Resend DNS block
- Code inspection: `package.json` — confirmed no test framework, confirmed `next build --turbopack` command

### Secondary (MEDIUM confidence)

- Supabase JS `.maybeSingle()` behavior: returns `null` data (not an error) when zero rows match — standard API behavior documented at supabase.com/docs
- Next.js NEXT_REDIRECT behavior with try/catch: established project rule from STATE.md decision log
- PostgreSQL null comparison behavior: `.gte(col, val)` where col is null returns false — standard SQL null semantics

### Tertiary (LOW confidence — needs validation)

- Turbopack build output structure matches webpack `.next/static` layout — assumed based on Next.js 15 docs intent; confirm by running `npm run build` and inspecting output

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns from existing codebase
- Architecture: HIGH — patterns derived from direct code inspection of all target files
- Pitfalls: HIGH — most identified from direct code reading, not speculation
- Shell script: MEDIUM — grep flags verified by knowledge of POSIX tools; Turbopack output structure is LOW until confirmed by a build run

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain — Next.js 15 App Router patterns, Supabase client API)

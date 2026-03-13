# Phase 5: Polish and Pre-Launch Hardening - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify and harden what Phases 1–4 built. No new features. Edge cases are handled gracefully, emails are deliverable, and no security property can be violated by normal or adversarial use. All 5 roadmap success criteria must be TRUE by end of phase.

Note: Two success criteria are already satisfied by existing code:
- Criterion #1 (empty state): `RequestsTab` already renders "No requests found." when `sorted.length === 0`
- Criterion #2 (styled buttons): `admin-notification.ts` already has green/red HTML anchor buttons

Remaining work: duplicate submission guard, bundle secret verification, Resend DNS documentation, and error/edge-case hardening.

</domain>

<decisions>
## Implementation Decisions

### Duplicate Submission Guard (Criterion #5)
- Server-side check in `submitRequest` action: before inserting, query the DB for a row with matching `teacher_email`, `start_date`, `end_date` submitted within the last **60 seconds**
- If a duplicate is found: **silent success** — redirect to `/confirmation` as if the submission succeeded (teacher not confused, no error shown)
- Covers **both** blackout and non-blackout submissions — same check, consistent behavior
- No DB schema changes (no unique constraint) — query-based check only
- The 60-second window catches race conditions and network retries without blocking legitimate re-submissions

### Bundle Secret Verification (Criterion #4)
- Automated shell script: `scripts/check-bundle-secrets.sh`
- Script runs `npm run build`, then greps `.next/static` for:
  1. Secret env var **names** verbatim: `SUPABASE_SERVICE_ROLE_KEY`, `APPROVAL_SECRET`, `ADMIN_PASSWORD`, `RESEND_API_KEY`
  2. Absence of `NEXT_PUBLIC_` prefix variants of those same secrets
- Invocation: `bash scripts/check-bundle-secrets.sh` (manual, run before deploy)
- Script exits non-zero and prints a clear failure message if any check fails

### Resend DNS Documentation (Criterion #3)
- Add a focused comment block to `.env.example` covering the Resend pre-launch checklist:
  - Verify sending domain in the Resend dashboard
  - Add SPF and DKIM DNS records at the domain registrar
  - Send a test email via Resend and confirm inbox delivery (not spam)
- Scope: Resend domain verification only — no broader deployment guide

### /api/approve Edge Cases
- All malformed requests (missing token, invalid token, missing `id`, missing `action`, non-existent request ID) → redirect to `/invalid` page
- Consistent, simple, reuses the existing `/invalid` page — no new routes or distinct copy per failure mode
- Current approve route handler needs explicit param validation before the existing token check (missing `id` or `action` currently falls through to a DB query with undefined values)

### Admin Dashboard DB Errors
- If Supabase throws during the server-side data fetch in the admin dashboard, catch the error and render a friendly inline message: **"Unable to load data. Please refresh."** — no 500 error page
- Applies to both the requests query and the blackout dates query

### Form Submit DB Errors
- The existing generic message ("Something went wrong. Please try again.") is sufficient — no change needed

### Claude's Discretion
- Exact shell script structure and grep flags for `check-bundle-secrets.sh`
- Exact wording of the Resend checklist comment block in `.env.example`
- How to structure the admin dashboard error catch (error boundary vs. try/catch in server component)
- Whether the duplicate check uses `submitted_at` timestamp math or a `created_at` equivalent

</decisions>

<specifics>
## Specific Ideas

- The duplicate check window (60 seconds) is intentionally narrow — it's a race condition guard, not a business rule preventing re-submissions for the same dates
- The bundle check script should be runnable by the operator before every deploy, not just once — design it as a repeatable pre-deploy gate

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/(public)/actions.ts` → `submitRequest` — duplicate check goes here, before the `.insert()` call; uses the existing `createClient()` pattern
- `app/invalid/page.tsx` — already exists; approve route edge cases redirect here
- `app/api/approve/route.ts` — needs explicit early validation for missing `id`, `action`, and non-existent request ID before reaching the existing token check
- `app/(admin)/admin/(protected)/page.tsx` — server component fetching requests and blackout dates; wrap Supabase calls in try/catch

### Established Patterns
- All DB queries use `createClient()` from `lib/supabase/server.ts` — duplicate check follows the same pattern
- `redirect()` from `next/navigation` is always outside try/catch (NEXT_REDIRECT rule) — duplicate detection returns a FormState with early redirect instead
- Supabase query results cast to explicit types via `as` — same pattern for the duplicate lookup query

### Integration Points
- `app/(public)/actions.ts` → add duplicate check before line ~80 (before the `.insert()`)
- `app/api/approve/route.ts` → add param validation at the top of the GET handler
- `app/(admin)/admin/(protected)/page.tsx` → wrap fetch calls in try/catch, return error UI
- `.env.example` → add Resend DNS comment block (exact location: near the RESEND_* vars)
- New: `scripts/check-bundle-secrets.sh`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-polish-and-pre-launch-hardening*
*Context gathered: 2026-03-13*

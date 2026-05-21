# Requirements — v1.1 Post-Audit Hardening

**Milestone goal:** Close all security, reliability, and code quality gaps identified in the senior audit. No new user-facing features — hardening only.

**Source:** Senior codebase audit conducted 2026-05-21. All findings are traceable back to specific files and line numbers in the audit report.

---

## Security & Correctness

- [ ] **SEC-01** System enforces blackout dates server-side using a Supabase date-overlap query on `blackout_dates`, overriding the teacher's self-reported `is_blackout` value.
  - *Why:* A teacher who selects "No" on the blackout radio bypasses auto-denial entirely today. The server never validates against the DB.
  - *Files:* `app/(public)/actions.ts`

- [ ] **SEC-02** Admin approval/denial URLs use HMAC-SHA256 tokens (scoped to `id:action`) instead of comparing the raw `APPROVAL_SECRET` string.
  - *Why:* The current token is the same shared secret for every request and every action forever. A leaked URL grants control over all pending requests.
  - *Files:* `app/(public)/actions.ts` (token generation), `app/api/approve/route.ts` (verification)

- [ ] **SEC-03** Server-side email format validation rejects structurally invalid `teacher_email` values before insert.
  - *Why:* The form sets `noValidate`, disabling browser validation. Server currently only checks presence, not format. "notanemail" is accepted.
  - *Files:* `app/(public)/actions.ts`

- [ ] **SEC-04** HTTP security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) are applied to all responses via `next.config.ts`.
  - *Why:* `next.config.ts` is currently empty. Basic headers are table-stakes for any form-handling app.
  - *Files:* `next.config.ts`

- [ ] **SEC-05** Application validates all required environment variables at module load time and throws a descriptive error if any are missing or below minimum length (SESSION_SECRET < 32 chars).
  - *Why:* Missing SESSION_SECRET causes iron-session to silently use an empty encryption key. Missing APPROVAL_SECRET causes all approval links to match an empty token.
  - *Files:* `lib/config.ts` (new), imported by `lib/supabase/server.ts` and `lib/auth/session.ts`

---

## Reliability & Error Handling

- [ ] **REL-01** If email sending fails after a successful DB insert, the system logs the inserted request ID and returns a distinct error state (not the same generic error shown for validation failures).
  - *Why:* Currently, a Resend failure causes `catch` to return `{ message: 'Something went wrong.' }` — but the DB row already exists. Teacher retries → duplicate guard may catch it. Request is effectively lost to admins.
  - *Files:* `app/(public)/actions.ts`

- [ ] **REL-02** `deleteBlackoutDate` returns `{ error?: string }` and the admin UI surfaces the error message if deletion fails.
  - *Why:* Current implementation is explicitly "best-effort" with no feedback. Admin sees the row reappear after `router.refresh()` with no explanation.
  - *Files:* `app/(admin)/admin/actions.ts`, `app/(admin)/admin/_components/BlackoutDatesTab.tsx`

- [ ] **REL-03** Approval confirmation email sent to the teacher includes their name, leave type, start date, and end date.
  - *Why:* `approvalConfirmationTemplate()` currently takes zero args and sends "Your time-off request has been approved." with no context. A teacher with multiple requests cannot tell which one was approved.
  - *Files:* `lib/email/templates/approval-confirmation.ts`, `app/api/approve/route.ts`

- [ ] **REL-04** The `/reviewed` page uses a URL flag (`?first=true`) to distinguish a first-time admin action from a repeated click, showing appropriate copy for each case.
  - *Why:* The page currently says "Request Already Reviewed" for both cases. When an admin clicks Approve for the first time, the copy is inaccurate and confusing.
  - *Files:* `app/reviewed/page.tsx`, `app/api/approve/route.ts` (adds `?first=true` to the redirect URL on first action)

- [ ] **REL-05** All Resend email calls route through `lib/email/send.ts`. A `sendBatch` export is added to handle multi-admin notifications. Direct `new Resend()` instantiation in `app/(public)/actions.ts` is removed.
  - *Why:* The `sendEmail` abstraction is bypassed for batch sends (actions.ts:158). Two separate code paths manage `RESEND_FROM` fallback. The abstraction provides false confidence.
  - *Files:* `lib/email/send.ts`, `app/(public)/actions.ts`

---

## Code Quality

- [ ] **QUAL-01** `LEAVE_TYPE_LABELS` and `formatDate` are imported from `lib/email/utils.ts` everywhere. Local duplicate copies in `lib/email/templates/auto-denial.ts` and `app/reviewed/page.tsx` are removed.
  - *Why:* Three separate definitions. If a leave type is added to utils.ts, the other two silently diverge.
  - *Files:* `lib/email/templates/auto-denial.ts`, `app/reviewed/page.tsx`

- [ ] **QUAL-02** `package.json` `"name"` field is updated from `"time-off-request-temp"` to `"time-off-request-system"`.
  - *Why:* Leftover from scaffolding. The `-temp` suffix is misleading and unprofessional.
  - *Files:* `package.json`

---

## Testing

- [ ] **TEST-01** Vitest is installed and configured for the project. The setup handles `server-only` module mocking so Server Action logic can be unit-tested without Next.js runtime.
  - *Files:* `vitest.config.ts` (new), `vitest.setup.ts` (new), `package.json`

- [ ] **TEST-02** `submitRequest` validation logic has unit test coverage for all branches: missing teacher name, missing email, invalid email format, past start date, end date before start date, missing blackout selection, valid form with blackout=true, valid form with blackout=false.
  - *Files:* `tests/validation.test.ts` (new)

- [ ] **TEST-03** HMAC token generation and verification functions have unit test coverage: correct token verifies, wrong action fails, wrong id fails, tampered token fails, cross-action forgery prevented.
  - *Files:* `lib/auth/tokens.ts` (new — extracts HMAC logic), `tests/tokens.test.ts` (new)

- [ ] **TEST-04** Blackout date overlap detection logic has unit test coverage for: full overlap, no overlap, adjacent (touching) dates, partial overlap start, partial overlap end.
  - *Files:* `tests/blackout-overlap.test.ts` (new)

- [ ] **TEST-05** GitHub Actions CI workflow runs `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` on every push and pull request to `main`.
  - *Files:* `.github/workflows/ci.yml` (new)

---

## UX Polish

- [ ] **UX-01** The `reason` column in the admin requests table supports click-to-expand. A truncated reason reveals in full when clicked, collapsing again on a second click.
  - *Why:* Reason is the most decision-relevant field for admins but is currently clipped to 200px with no way to read it without inspecting the DOM.
  - *Files:* `app/(admin)/admin/_components/RequestsTab.tsx`

- [ ] **UX-02** The end date input in the teacher form has a `min` attribute dynamically updated to match the currently selected start date, preventing selection of an end date before the start.
  - *Why:* Only start date has a `min` today. End date has no constraint, so users can select invalid ranges and only find out after submission.
  - *Files:* `app/(public)/page.tsx`

---

## Out of Scope (v1.1)

- **Rate limiting** (admin login brute-force, teacher form flooding) — deferred to v1.2. Requires Upstash Redis or Vercel rate limiting config; infrastructure decision should follow the rate-limiting research already in progress.
- **Admin dashboard pagination** — deferred to v1.2. Works fine at current school scale; adds meaningful complexity.
- **Real-time dashboard updates** (Supabase Realtime) — deferred. Complexity not justified for current use case.
- **Supabase migrations in source control** — deferred. Schema is stable; adding migrations now requires Supabase CLI setup that's out of scope for a hardening release.
- **ARIA tab roles on TabSwitcher** — deferred. Accessibility improvement but not audit-critical.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SEC-01 | Phase 6 | Pending |
| SEC-02 | Phase 6 | Pending |
| SEC-03 | Phase 6 | Pending |
| SEC-04 | Phase 6 | Pending |
| SEC-05 | Phase 6 | Pending |
| REL-01 | Phase 7 | Pending |
| REL-02 | Phase 7 | Pending |
| REL-03 | Phase 7 | Pending |
| REL-04 | Phase 7 | Pending |
| REL-05 | Phase 7 | Pending |
| QUAL-01 | Phase 8 | Pending |
| QUAL-02 | Phase 8 | Pending |
| UX-01 | Phase 8 | Pending |
| UX-02 | Phase 8 | Pending |
| TEST-01 | Phase 9 | Pending |
| TEST-02 | Phase 9 | Pending |
| TEST-03 | Phase 9 | Pending |
| TEST-04 | Phase 9 | Pending |
| TEST-05 | Phase 9 | Pending |

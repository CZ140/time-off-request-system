# Roadmap: Teacher Time-Off Request System

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-03-13)
- 🔄 **v1.1 Post-Audit Hardening** — Phases 6–9 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-03-13</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-10
- [x] Phase 2: Teacher Form and Auto-Denial (2/2 plans) — completed 2026-03-11
- [x] Phase 3: Email Approval Workflow (5/5 plans) — completed 2026-03-12
- [x] Phase 4: Admin Dashboard (4/4 plans) — completed 2026-03-13
- [x] Phase 5: Polish and Pre-Launch Hardening (2/2 plans) — completed 2026-03-13

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details open>
<summary>🔄 v1.1 Post-Audit Hardening (Phases 6–9) — IN PROGRESS</summary>

- [ ] **Phase 6: Security Hardening** — Server-side blackout enforcement, HMAC tokens, email validation, security headers, env var guard
- [ ] **Phase 7: Reliability & Error Handling** — Email failure handling, error surfacing, approval email personalization, /reviewed copy accuracy, sendBatch abstraction
- [ ] **Phase 8: Code Quality & UX Polish** — Deduplicate shared utilities, package name fix, reason expand-in-place, end date min constraint
- [ ] **Phase 9: Testing & CI** — Vitest setup, unit tests for validation/tokens/blackout, GitHub Actions CI

</details>

## Phase Details

### Phase 6: Security Hardening
**Goal**: The application enforces correctness server-side and cannot be manipulated via client-controlled inputs or leaked tokens
**Depends on**: Phase 5 (v1.0 baseline)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. A teacher who selects "No" on the blackout radio for dates that are in the blackout table is still auto-denied — the server overrides the client value
  2. Each admin approval/denial URL contains a unique HMAC token scoped to that request ID and action; reusing a URL for a different request or action is rejected
  3. Submitting the teacher form with a structurally invalid email (e.g., "notanemail") returns a server-side validation error without inserting a DB row
  4. All application responses include X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers
  5. Starting the application with a missing or short SESSION_SECRET or any other required env var throws a descriptive startup error rather than silently continuing
**Plans**: TBD

### Phase 7: Reliability & Error Handling
**Goal**: Failures are visible, recoverable, and communicated accurately — no silent data loss and no misleading UI copy
**Depends on**: Phase 6
**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05
**Success Criteria** (what must be TRUE):
  1. When Resend fails after a successful DB insert, the server logs the inserted request ID and returns an error response distinct from a validation failure
  2. When deleting a blackout date fails at the DB layer, the admin UI displays the error message rather than silently refreshing with the row still present
  3. The approval confirmation email sent to the teacher includes their name, leave type, start date, and end date
  4. An admin who approves a request for the first time sees accurate "approved" copy on the /reviewed page; a repeat click sees "already reviewed" copy
  5. All email sending — single and batch — routes through lib/email/send.ts; no direct Resend instantiation exists outside that module
**Plans**: TBD

### Phase 8: Code Quality & UX Polish
**Goal**: Shared utilities have a single authoritative source and the admin table and teacher form behave correctly at the interaction level
**Depends on**: Phase 7
**Requirements**: QUAL-01, QUAL-02, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. LEAVE_TYPE_LABELS and formatDate have exactly one definition in the codebase (lib/email/utils.ts); all other files import from there
  2. package.json name field reads "time-off-request-system" with no -temp suffix
  3. Clicking a truncated reason cell in the admin requests table expands it in place; clicking again collapses it
  4. Selecting a start date in the teacher form immediately constrains the end date picker so dates before the start date cannot be chosen
**Plans**: TBD
**UI hint**: yes

### Phase 9: Testing & CI
**Goal**: Core logic is covered by automated unit tests and every push to main runs the full quality gate automatically
**Depends on**: Phase 6, Phase 7 (tests cover logic introduced in those phases)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. Running `npx vitest run` locally passes with no configuration errors and server-only module imports do not cause test failures
  2. All validation branches in submitRequest (missing name, missing email, invalid email, past start date, end-before-start, missing blackout selection, valid blackout, valid non-blackout) have passing unit tests
  3. HMAC token tests confirm correct tokens verify and tampered/cross-action tokens are rejected
  4. Blackout overlap tests cover full overlap, no overlap, adjacent dates, partial overlap start, and partial overlap end
  5. Opening a pull request against main triggers the CI workflow and tsc, eslint, and vitest all pass before merge is permitted
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-10 |
| 2. Teacher Form and Auto-Denial | v1.0 | 2/2 | Complete | 2026-03-11 |
| 3. Email Approval Workflow | v1.0 | 5/5 | Complete | 2026-03-12 |
| 4. Admin Dashboard | v1.0 | 4/4 | Complete | 2026-03-13 |
| 5. Polish and Pre-Launch Hardening | v1.0 | 2/2 | Complete | 2026-03-13 |
| 6. Security Hardening | v1.1 | 0/? | Not started | - |
| 7. Reliability & Error Handling | v1.1 | 0/? | Not started | - |
| 8. Code Quality & UX Polish | v1.1 | 0/? | Not started | - |
| 9. Testing & CI | v1.1 | 0/? | Not started | - |

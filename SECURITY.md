# Security model

Plain-language description of what this application protects, what it explicitly does not protect, and how to operate it safely. Read this before deploying to a real school.

---

## What this system protects against

### Forged approval clicks

Approval and denial links sent to admins are signed with HMAC-SHA256 over `${request_id}:${action}:${approver_email}:${exp}`. Without the server's `APPROVAL_HMAC_SECRET`, an attacker cannot fabricate a valid link, even with full knowledge of the URL structure.

A token for **approve** on request A cannot be reused as a **deny** on request A or as either action on request B. A token issued to admin Alice cannot be replayed by admin Bob, even if it leaks (e.g., via email forwarding or an archive breach). Tampering with any single character of the token, URL parameters, or hidden form fields causes verification to fail.

### Replayed approval clicks (single-use)

Once an admin confirms approve or deny, the database row's status transitions from `pending` to `approved`/`denied`. The atomic update uses `.eq('status', 'pending')` as a guard. A second click on the same link — by the same admin, a different admin, or an attacker — matches zero rows and is treated as already-reviewed. The status transition is the consumption marker; there is no separate `consumed_at` column.

Two admins clicking the same request simultaneously: exactly one update succeeds, the other gets zero rows and lands on the "already reviewed" page. No double-action is possible.

### Stale approval clicks (time-bound)

Tokens include an `exp` Unix-seconds timestamp in the signed payload. Default is **7 days** from issue; configurable via `APPROVAL_LINK_EXPIRY_DAYS`. After expiry, clicks redirect to `/expired` with a "ask the teacher to resubmit" message. The expiry is compared against server clock at verify time — a copy of the link saved offline does not extend the window.

### Outside-domain form submissions

The teacher submission form is open (no login), but the server-side action enforces an email-domain allowlist. Submissions whose `teacher_email` is outside `ALLOWED_EMAIL_DOMAINS` are rejected with a generic error.

**Matching semantics:**
- **Exact domain match only** — `foo@mail.school.edu` does NOT match `school.edu`. To allow subdomains, add them explicitly. This is intentional: a suffix match would let `evil-school.edu` and `school.edu.attacker.com` look-alikes pass.
- **Case-insensitive** — `Teacher@SCHOOL.EDU` matches `school.edu` and vice versa.
- **Fail-closed** — an unset, empty, or whitespace-only `ALLOWED_EMAIL_DOMAINS` rejects **every** submission. This is a deliberate landmine: a missing allowlist is treated as "no one is allowed", not "everyone is allowed".

A client-side hint (`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS_HINT`) surfaces a "this system is only for @your-school.edu emails" message on email-field blur. **This is UX only.** Anyone can edit the bundled JS or POST directly to the Server Action. The server-side `ALLOWED_EMAIL_DOMAINS` check is the authoritative gate.

### Volume attacks (rate limiting)

Two dimensions on the submission endpoint:

- **Per claimed email** — 10 submissions per hour per `teacher_email`. Stops a single victim's inbox from being spammed with auto-denial / confirmation emails.
- **Per source IP** — 100 submissions per hour. Catches the "attacker rotates emails to bypass the per-email limit" case.

One dimension on admin actions:

- **Per admin session** — 100 actions per hour, keyed by a random session ID generated at admin login (iron-session cookie). A fresh login gets a fresh budget. For email-click approvals (no session), the limit is keyed by the HMAC-verified `admin` email instead.

Limits are enforced via a Supabase-backed rolling-window counter (`rate_limit_log` table). The check **fails open** on DB errors — a database outage does not lock out legitimate users.

### Search-engine discovery

Production builds (`DEMO_MODE` unset or `false`) emit:

- `<meta name="robots" content="noindex, nofollow">` in the document head
- `robots.txt` with `User-agent: *` `Disallow: /`

The demo deployment is intentionally indexable (it is a portfolio piece meant to be found). Production deployments are not.

### Brute-forcing the admin password

The admin login uses `crypto.timingSafeEqual` for the password comparison, with a length check first to handle attacker-supplied inputs of arbitrary length. Response-time analysis cannot leak the password length or contents.

In demo mode, the login page openly displays the demo password as a hint (`DEMO_ADMIN_PASSWORD`). The two passwords are deliberately separate env vars so the demo deployment can never accept (or reveal) the production password.

---

## What this system explicitly does NOT protect against

### Sender authenticity of teacher submissions

There is no upfront login. Any user on an allowed-domain email can submit a request claiming to be any other user on an allowed domain. If Alice has a school email and knows Bob's school email, she can submit a leave request as Bob. The admin notification will show "Bob wants June 1-5 off."

**The mitigation is social trust between known users**, not a cryptographic guarantee. For a single school with ~10-20 teachers who all know each other, a forged submission is obvious to the admin ("Bob is standing right here, he didn't ask for this") and to Bob ("why am I getting an email about my approved time off?"). The cost to a forger is reputational and social, not technical.

**When this protection becomes insufficient:**
- User cohort grows past ~50 users
- Deployment goes multi-tenant (multiple schools, one instance)
- Substitute teachers, contractors, or rotating staff who don't know each other are added
- Audit-trail requirements tighten (e.g., union contract requires verified submitter identity)

**How to reintroduce identity binding:** `git revert 44bd886` restores the Phase 1 magic-link auth flow verbatim, including the read-only-email behaviour where the server uses the session email and ignores the form field.

### Email delivery to the typed address

If a teacher mistypes their own email (`alic@school.edu` instead of `alice@school.edu`), the auto-denial or admin-notification emails go to whatever address they typed. This is the same risk as any unauthenticated form, and is mitigated only by the client-side onBlur hint and by the teacher noticing they don't get the expected confirmation.

### A compromised admin email account

If an admin's email account is breached, the attacker reads the approval links and can click them as that admin. The HMAC binding does not help here — the attacker IS Alice for the duration of the breach. The expiry window limits the lifetime of any single stolen link to (by default) 7 days.

### A leaked `APPROVAL_HMAC_SECRET`

The secret is the root of trust for all approval links. If it leaks, an attacker can mint valid tokens for arbitrary `(id, action, approver, exp)` tuples. Rotate the secret immediately if you suspect compromise; all outstanding email links will become invalid (per-token expiry up to 7 days).

### A leaked `SUPABASE_SERVICE_ROLE_KEY`

The service-role key bypasses Row Level Security and has full read/write access to all tables. If it leaks, the attacker can read every request, modify any row, or wipe the database. Rotate via the Supabase dashboard immediately if suspected.

### Approval-link harvesting via email-scanning malware

Many corporate email systems pre-fetch URLs in incoming messages (Outlook Safe Links, Gmail link rewriters, security scanners). The approval flow is a two-step GET-then-POST: the GET shows a confirmation page, only the explicit POST writes to the database. Auto-prefetchers see only the confirmation page and never perform the action. **Do not** revert to a one-step GET-writes flow.

---

## Required environment variables in production

Every variable below must be set in the Vercel project (or equivalent) before going live. The application will throw on startup if any required var is missing.

### Critical security values

| Variable | Notes |
|---|---|
| `APPROVAL_HMAC_SECRET` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Rotate annually or on suspected compromise. |
| `SESSION_SECRET` | Minimum 32 characters. Generate with `openssl rand -base64 32`. Rotation invalidates all active admin sessions. |
| `ADMIN_PASSWORD` | The production admin password. **MUST NOT** equal `DEMO_ADMIN_PASSWORD`. Never share. |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Dashboard → API. Server-only — never expose to the browser. |

### Operational gates

| Variable | Notes |
|---|---|
| **`ALLOWED_EMAIL_DOMAINS`** | **Fail-closed landmine.** Unset = every submission rejected. Comma-separated, exact-domain match, case-insensitive. Example: `school.edu,admin.school.edu` |
| `DEMO_MODE` | Must be `false` (or unset) in production. Setting it to `true` disables the allowlist and email sending. |
| `APPROVAL_LINK_EXPIRY_DAYS` | Optional. Default 7. Set to a small integer between 1 and 30. |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS_HINT` | Optional. UX hint only. Should mirror the values in `ALLOWED_EMAIL_DOMAINS`. |

### Integrations

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Project URL. |
| `ADMIN_EMAILS` | Comma-separated list of admin addresses that receive notifications. |
| `RESEND_API_KEY` | Required when `DEMO_MODE` is not `true`. |
| `RESEND_FROM` | Verified Resend sending domain. Unverified domains will be flagged as spam. |
| `NEXT_PUBLIC_BASE_URL` | Production URL used in email link generation. |

### Demo-only

`DEMO_ADMIN_PASSWORD` is required when `DEMO_MODE=true` and forbidden (well, ignored) otherwise. It is openly displayed on the demo login page as a hint, so MUST NOT match `ADMIN_PASSWORD`.

---

## Pre-launch checklist

- [ ] `ALLOWED_EMAIL_DOMAINS` is set to the school's actual domain(s). Verify by submitting a test request from an outside-domain email — it must be rejected.
- [ ] `ADMIN_PASSWORD` is at least 16 random characters. Verify the demo deployment's `DEMO_ADMIN_PASSWORD` is a different value.
- [ ] `APPROVAL_HMAC_SECRET` and `SESSION_SECRET` have been freshly generated for this deployment (not copied from `.env.example` or another project).
- [ ] Resend sending domain is verified (SPF + DKIM passing). Send a test email from the dashboard and confirm it arrives in inbox, not spam.
- [ ] `DEMO_MODE` is unset or `false`. Confirm by visiting `/robots.txt` — should return `Disallow: /`.
- [ ] At least one approval-link end-to-end test: submit a request, click the email link, confirm the approval, verify the teacher gets the confirmation email.
- [ ] Run `npm run build` locally before deploying — production env vars cause schema validation in `lib/config.ts`.

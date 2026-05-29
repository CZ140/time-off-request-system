# CLAUDE.md

Project guidance for Claude Code in this workspace.

## Filling out the faculty time-off form (demo or prod)

When asked to submit time-off requests through the UI (e.g. to seed data via
Playwright), follow these rules so the submission isn't silently rejected:

1. **Email must be `@gmail.com`.** The "Work email" field rejects every other
   domain. This is intentional (no official school domain yet — see the
   `gmail-only-email-restriction` memory), not a bug. Always use a gmail address.

2. **Dates are native `<input type="date">`.** Fill them in `YYYY-MM-DD` format,
   not `MM/DD/YYYY`. The Start field enforces a `min` date (no past dates).

3. **Blockout check is server-side and authoritative.** Selecting "No, dates are
   clear" does NOT bypass it, and selecting "Yes, dates overlap" does NOT force
   it — the server decides from the dates alone. Any dates landing in a blockout
   window (testing weeks, finals, graduation, etc.) come back
   `?status=auto_denied`; no email is sent to the principal.
   - **To get a `pending` request:** pick dates clear of every window (mid-fall
     like September/October has worked).
   - **To deliberately trigger `auto_denied`:** pick dates that overlap a
     blockout range. The current demo ranges are **June 15–19, 2026** (testing
     week) and **June 22–23, 2026** (graduation). Any single day or span that
     touches those gets auto-denied. These ranges are editable, so treat the
     **Admin → Blockouts tab** as the source of truth before relying on a
     specific date.

4. **Leave-type and blockout radios are `sr-only`** (visually hidden, label
   intercepts the click). Click the surrounding label/wrapper element, not the
   `<input type="radio">` itself, or the click times out.

5. **Confirm the result via the redirect URL.** Success = `/confirmation?status=pending`.
   Rejection = `/confirmation?status=auto_denied`. Check it before reporting done.

## Reviewing requests in the admin dashboard (`/admin`)

When asked to approve/deny requests (e.g. to demo the principal's review flow):

1. **Sign in first.** The dashboard lives at `/admin`. In the demo, the login is
   shown in the "Demo Mode" banner (`Admin login: demo`). If the page shows the
   request list with a "Signed in as the administrator" header, you're already in.

2. **Each request card has its own action buttons.** Pending cards show
   `Approve` and `Deny`; already-decided cards (Approved / Denied / Auto-denied)
   show only `Delete`. Auto-denied requests never had `Approve`/`Deny` — the
   server already rejected them.

3. **Approve and Deny are two-step (click → confirm).** The first click swaps the
   button row for `Confirm approve · <FirstName>` / `Cancel` (or
   `Confirm deny · <FirstName>`). You MUST click the confirm button to commit —
   the first click alone does nothing server-side. There is no deny-reason field;
   confirming is enough.

4. **Refs are regenerated after every commit** because the list re-renders and
   counts update. Don't reuse a ref from a prior snapshot for the confirm step.
   A reliable pattern that avoids a snapshot round-trip is a text selector:
   `button:has-text("Confirm approve · Sarah")`. The confirm label uses the
   teacher's **first name**, so disambiguate when two pending teachers share one
   (e.g. two "Priya"s) by snapshotting instead.

5. **Confirm the result via the status tally**, not just the row. After a commit
   the filter chips update — `Pending (n)` drops by one and `Approved (n)` /
   `Denied (n)` rises by one. Check the chips before reporting done.

# Supabase Auth Setup — Magic Links via Resend SMTP

This document covers the **dashboard-side** configuration for teacher magic-link auth. The code-side (login page, callback handler, middleware gating) is already implemented — these are the manual steps an operator must take in the Supabase dashboard before the auth flow will work in production.

Do this once per Supabase project. The demo project does **not** require this — demo mode bypasses teacher auth entirely.

---

## 1. Configure SMTP (Resend)

By default Supabase sends auth emails from `noreply@mail.app.supabase.io`, which lands in spam. Route through Resend so they come from your verified domain.

1. Go to **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**.
2. Toggle **Enable Custom SMTP** on.
3. Enter:
   - **Sender email:** `noreply@yourdomain.com` (must be a verified Resend domain)
   - **Sender name:** `Time Off System` (or your preferred display name)
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key (the same value as `RESEND_API_KEY` in `.env.local`)
4. Click **Save**.
5. Send a test email from the dashboard's test button. Confirm it arrives in your inbox (not spam). If it lands in spam, re-verify SPF + DKIM in Resend per the checklist in `.env.example`.

---

## 2. Configure redirect URL allowlist

Supabase only permits magic-link callbacks to whitelisted URLs. Without this, the magic link will fail with a redirect error.

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to the canonical production URL (e.g., `https://timeoff.yourschool.edu`). Local dev does not require this — use the additional redirect URLs field for that.
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/auth/callback` (local development)
   - `https://timeoff.yourschool.edu/auth/callback` (production)
   - Any preview/staging URL: `https://your-app-git-*.vercel.app/auth/callback`
4. Click **Save**.

> **Note:** the path must be `/auth/callback` — that matches `app/auth/callback/route.ts`. Any other path will fail silently.

---

## 3. Configure magic-link expiry

The default magic-link lifetime is 1 hour. For a school deployment, recommend **24 hours**: a teacher who requests a link in the morning should be able to click it after school.

1. Go to **Authentication → Email**.
2. Set **OTP Expiry duration** to `86400` (24 hours, in seconds).
3. Click **Save**.

> This is set in the dashboard, **not in code**. The application has no way to override it.

---

## 4. Customise the magic-link email template (optional)

The default Supabase email reads as generic. Replace it with copy that matches the school's voice.

1. Go to **Authentication → Email Templates → Magic Link**.
2. Recommended subject: `Your sign-in link for the Time Off System`
3. Recommended body (HTML):

```html
<h2>Hi,</h2>
<p>Click the link below to sign in to the Time Off Request System. This link is valid for 24 hours and can only be used once.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

The `{{ .ConfirmationURL }}` variable is Supabase's substitution token — do not change it.

4. Click **Save**.

---

## 5. Smoke-test the flow

1. Open the production site in a private browser window.
2. You should be redirected to `/login`.
3. Enter your school email and click **Send magic link**.
4. Within 30 seconds, an email should arrive from the Resend sender address.
5. Click the link in the email. You should land back on `/` with the teacher form, and the email field should be pre-populated and read-only.
6. Click **Sign out** in the top-right. You should be redirected to `/login`.

If any step fails, check:
- Supabase dashboard → **Logs → Auth** for error messages
- Resend dashboard → **Logs** for SMTP delivery failures
- Vercel logs for `[login]` or `[auth/callback]` server-side errors

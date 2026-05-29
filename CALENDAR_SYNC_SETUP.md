# Microsoft sign-in + Outlook calendar sync — setup

This feature replaces the production password login with **"Sign in with
Microsoft"** and pushes every approved time-off request to a connected Outlook
calendar as an all-day event.

- **Login** = Microsoft OAuth, gated by an allowlist (the `admin_recipients`
  table — only emails in it can sign in).
- **Calendar** = the same sign-in grants calendar access; approvals create
  events, deletes/reversals remove them. One shared calendar, one event each.
- **Demo mode** is unchanged: it keeps the password login and suppresses all
  calendar/Microsoft calls.

## 1. Apply the database migration

Run `supabase/migrations/20260528000000_microsoft_calendar_sync.sql` against
your Supabase project (CLI `supabase db push`, or paste it into the SQL editor).
It adds the `calendar_connections` table and `requests.calendar_event_id` /
`requests.calendar_provider`.

## 2. Register the Azure app

You need access to a Microsoft Entra (Azure AD) directory. You do NOT need the
school's M365 tenant or a paid Azure subscription — signing into
[portal.azure.com](https://portal.azure.com) with a personal Microsoft account
auto-creates a free "Default Directory" you can register apps in. Because the
app is registered as *multitenant + personal accounts*, school accounts can
still connect later even though you registered it under your own directory.

**Step 1 — Open App registrations.** [Microsoft Entra admin center](https://entra.microsoft.com)
→ **Applications → App registrations → ＋ New registration**.

**Step 2 — Register.**
- **Name:** `Schoolhouse Time Off` (shows on the consent screen).
- **Supported account types:** the **third** option — *"Accounts in any
  organizational directory (Any Microsoft Entra ID tenant – Multitenant) **and**
  personal Microsoft accounts."* This exact choice is what lets both school M365
  accounts and personal `outlook.com` accounts sign in.
- **Redirect URI:** platform **Web**, value
  `http://localhost:3000/api/auth/microsoft/callback`.
- Click **Register**.

**Step 3 — Client ID.** On **Overview**, copy **Application (client) ID** →
`MS_CLIENT_ID`.

**Step 4 — Production redirect URI.** Left nav → **Authentication** → under
**Web → Redirect URIs**, **Add URI** =
`https://YOUR-PROD-DOMAIN/api/auth/microsoft/callback`. Leave **Implicit grant**
checkboxes **unchecked** (we use the auth-code flow). **Save.**
⚠️ Redirect URIs must match exactly — scheme, case, no trailing slash — and must
equal `MS_REDIRECT_URI` for that environment.

**Step 5 — Client secret.** Left nav → **Certificates & secrets → Client
secrets → ＋ New client secret**. Description `time-off-prod`, Expires 24 months.
**Add**, then immediately copy the **Value** column (shown only once; not the
"Secret ID") → `MS_CLIENT_SECRET`. Note the expiry date — sync stops when it
lapses; create a new secret and update the env var before then.

**Step 6 — API permissions.** Left nav → **API permissions → ＋ Add a permission
→ Microsoft Graph → Delegated permissions**. Tick **`Calendars.ReadWrite`** and
**`offline_access`** (`User.Read` is there by default). **Add permissions.**
These are user-consentable, so no tenant admin consent is required for a normal
account. (A locked-down M365 tenant that disables user consent would need a
one-time admin grant — the "Need admin approval" case.)

## 3. Set environment variables

In `.env.local` (local) and Vercel (production):

| Var | Value |
|---|---|
| `MS_CLIENT_ID` | Application (client) ID from step 2.3 |
| `MS_CLIENT_SECRET` | Client secret Value from step 2.4 |
| `MS_REDIRECT_URI` | Must **exactly** match the registered redirect URI for that environment |
| `CALENDAR_TOKEN_ENC_KEY` | A 32-byte base64 key (already generated in `.env.local`). Keep it stable — rotating it invalidates the stored connection. Generate a new one with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

`ADMIN_PASSWORD` is no longer used in production and can be removed there (keep
it only if you run a local `DEMO_MODE=true` instance).

## 4. Seed the login allowlist

Before anyone can sign in, add the authorized school email(s) to
`admin_recipients` via the Supabase **SQL editor**:

```sql
insert into admin_recipients (email, label) values
  ('principal@yourschool.org', 'Principal');
```

This same table also controls who receives new-request notifications, and the
SQL editor is your break-glass recovery if you're ever locked out. To test
before the school accounts exist, insert your own Microsoft/Outlook email and
swap it later.

## 5. Connect and pick a calendar

1. Go to `/admin`, click **Sign in with Microsoft**, consent.
2. The first account to sign in becomes the sync target automatically.
3. Open the **Calendar Sync** tab. If the account has more than one calendar,
   use **Change calendar** to pick which one receives events. Use **Sync to my
   account** to move the target to a different signed-in admin, or **Disconnect**
   to remove the connection.

## Notes / limits

- **One-way sync:** approvals create events and deletes remove them; edits made
  directly in Outlook are not read back.
- **Reconnect:** if the stored token is revoked (password change, admin revoke,
  long inactivity), syncing fails silently and the approval still succeeds —
  just sign in again to refresh the connection.
- **Multiple admins:** everyone signs in with their own account, but events
  always go to the single configured calendar, so there are never duplicates.

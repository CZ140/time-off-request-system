// lib/config.ts
// Validates required environment variables at module load time.
// Import this module for its side effects in any server entry point.
// Throwing here causes a clear startup crash rather than a silent runtime failure.
import 'server-only'

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'ADMIN_EMAILS',
  'APPROVAL_HMAC_SECRET',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
] as const
// Note: APPROVAL_SECRET (legacy) is intentionally excluded — it is deprecated by APPROVAL_HMAC_SECRET
// (SEC-02) and removing it from REQUIRED_VARS allows operators to remove the old var without a startup crash.

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`)
  }
}

if ((process.env.SESSION_SECRET?.length ?? 0) < 32) {
  throw new Error(
    'SESSION_SECRET must be at least 32 characters (generate with: openssl rand -base64 32)'
  )
}

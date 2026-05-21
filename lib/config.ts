// lib/config.ts
// Validates required environment variables at module load time.
// Import this module for its side effects in any server entry point.
// Throwing here causes a clear startup crash rather than a silent runtime failure.
import 'server-only'

const isDemo = process.env.DEMO_MODE === 'true'

// Resend vars are skipped in demo mode — emails are suppressed entirely,
// so a verified sending domain and live API key are not required.
const ALWAYS_REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'APPROVAL_HMAC_SECRET',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
] as const

const PRODUCTION_ONLY = [
  'RESEND_API_KEY',
  'RESEND_FROM',
  'ADMIN_EMAILS',
] as const

const varsToCheck = isDemo
  ? ALWAYS_REQUIRED
  : ([...ALWAYS_REQUIRED, ...PRODUCTION_ONLY] as const)

for (const key of varsToCheck) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`)
  }
}

if ((process.env.SESSION_SECRET?.length ?? 0) < 32) {
  throw new Error(
    'SESSION_SECRET must be at least 32 characters (generate with: openssl rand -base64 32)'
  )
}

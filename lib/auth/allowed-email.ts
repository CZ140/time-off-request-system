// lib/auth/allowed-email.ts
// Email-domain allowlist for the teacher submission form.
//
// Semantics (FAIL-CLOSED):
//   - Reads ALLOWED_EMAIL_DOMAINS at call time (not module load), so changes
//     in test env take effect without module re-imports.
//   - Exact domain match only — foo@mail.schoolname.org does NOT match schoolname.org.
//   - Case-insensitive matching on both the email and the allowlist entries.
//   - Empty / unset / whitespace-only allowlist rejects ALL emails.
//   - Malformed emails (no @ or empty domain) are rejected.
//
// Why exact match and not suffix match: a suffix match risks letting an attacker
// register evil-schoolname.org or schoolname.org.attacker.com look-alikes that
// pass the check. Exact match is the safe default; subdomains can be added
// explicitly when needed.
import 'server-only'

export function isAllowedEmail(email: string): boolean {
  const allowed = parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS)
  if (allowed.length === 0) return false

  const domain = extractDomain(email)
  if (!domain) return false

  return allowed.includes(domain)
}

function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0)
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  return email.slice(at + 1).trim().toLowerCase()
}

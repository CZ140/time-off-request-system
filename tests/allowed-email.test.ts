// tests/allowed-email.test.ts
// Unit tests for isAllowedEmail.
import { describe, it, expect, beforeEach } from 'vitest'
import { isAllowedEmail } from '@/lib/auth/allowed-email'

beforeEach(() => {
  delete process.env.ALLOWED_EMAIL_DOMAINS
})

describe('isAllowedEmail', () => {
  it('accepts an email on an allowed domain', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('teacher@school.org')).toBe(true)
  })

  it('accepts emails on any of multiple allowed domains', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org,school.edu'
    expect(isAllowedEmail('a@school.org')).toBe(true)
    expect(isAllowedEmail('b@school.edu')).toBe(true)
  })

  it('rejects an email on a disallowed domain', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('attacker@evil.com')).toBe(false)
  })

  it('fail-closed: empty allowlist rejects all', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = ''
    expect(isAllowedEmail('anyone@anywhere.com')).toBe(false)
  })

  it('fail-closed: unset allowlist rejects all', () => {
    delete process.env.ALLOWED_EMAIL_DOMAINS
    expect(isAllowedEmail('anyone@anywhere.com')).toBe(false)
  })

  it('fail-closed: whitespace-only allowlist rejects all', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = '  ,  ,'
    expect(isAllowedEmail('anyone@anywhere.com')).toBe(false)
  })

  it('case-insensitive: Teacher@SCHOOL.ORG matches school.org', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('Teacher@SCHOOL.ORG')).toBe(true)
  })

  it('case-insensitive: allowlist entries are lowercased before comparison', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'SCHOOL.ORG'
    expect(isAllowedEmail('teacher@school.org')).toBe(true)
  })

  it('exact-domain-match: foo@mail.school.org does NOT match school.org', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('foo@mail.school.org')).toBe(false)
  })

  it('exact-domain-match: subdomain works only when added explicitly', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org,mail.school.org'
    expect(isAllowedEmail('foo@mail.school.org')).toBe(true)
    expect(isAllowedEmail('foo@school.org')).toBe(true)
  })

  it('look-alike domain is rejected (no suffix match)', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('attacker@evil-school.org')).toBe(false)
    expect(isAllowedEmail('attacker@school.org.evil.com')).toBe(false)
  })

  it('rejects malformed emails (no @)', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('not-an-email')).toBe(false)
  })

  it('rejects emails with empty local part (@school.org)', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('@school.org')).toBe(false)
  })

  it('rejects emails with empty domain (foo@)', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('foo@')).toBe(false)
  })

  it('rejects empty string input', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.org'
    expect(isAllowedEmail('')).toBe(false)
  })

  it('trims whitespace from allowlist entries', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = ' school.org , school.edu '
    expect(isAllowedEmail('a@school.org')).toBe(true)
    expect(isAllowedEmail('b@school.edu')).toBe(true)
  })
})

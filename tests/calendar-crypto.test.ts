// tests/calendar-crypto.test.ts
// Round-trip + tamper-detection for the AES-256-GCM helpers that protect the
// stored MSAL token cache.
import { describe, it, expect, beforeEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { encrypt, decrypt } from '@/lib/calendar/crypto'

beforeEach(() => {
  // 32 random bytes, base64 — the expected key shape.
  process.env.CALENDAR_TOKEN_ENC_KEY = randomBytes(32).toString('base64')
})

describe('calendar crypto', () => {
  it('round-trips a plaintext string', () => {
    const secret = JSON.stringify({ refreshToken: 'abc.def.ghi', accounts: 2 })
    expect(decrypt(encrypt(secret))).toBe(secret)
  })

  it('produces a different IV each call (ciphertext is non-deterministic)', () => {
    const a = encrypt('same input')
    const b = encrypt('same input')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe('same input')
    expect(decrypt(b)).toBe('same input')
  })

  it('emits the iv:tag:ciphertext shape (three base64 segments)', () => {
    const parts = encrypt('x').split(':')
    expect(parts).toHaveLength(3)
  })

  it('throws on a tampered ciphertext (GCM auth tag mismatch)', () => {
    const blob = encrypt('do not tamper')
    const [iv, tag, data] = blob.split(':')
    // Flip a byte in the ciphertext segment.
    const buf = Buffer.from(data, 'base64')
    buf[0] = buf[0] ^ 0xff
    const tampered = [iv, tag, buf.toString('base64')].join(':')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on a malformed blob', () => {
    expect(() => decrypt('not-a-valid-blob')).toThrow(/Malformed/)
  })

  it('cannot be decrypted with a different key', () => {
    const blob = encrypt('cross-key')
    process.env.CALENDAR_TOKEN_ENC_KEY = randomBytes(32).toString('base64')
    expect(() => decrypt(blob)).toThrow()
  })

  it('rejects a key that is not 32 bytes', () => {
    process.env.CALENDAR_TOKEN_ENC_KEY = Buffer.from('too-short').toString('base64')
    expect(() => encrypt('x')).toThrow(/32 bytes/)
  })
})

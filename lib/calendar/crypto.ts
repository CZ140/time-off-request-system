// lib/calendar/crypto.ts
// AES-256-GCM encryption for the MSAL token cache blob stored in Supabase.
// The cache contains refresh tokens — a credential — so it must never sit in
// the database in plaintext. server-only: the key must never reach the browser.
import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// 12-byte (96-bit) IV is the standard/recommended nonce size for GCM.
const IV_BYTES = 12

function key(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_ENC_KEY
  if (!raw) {
    throw new Error('CALENDAR_TOKEN_ENC_KEY is not set')
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error(
      'CALENDAR_TOKEN_ENC_KEY must decode to exactly 32 bytes ' +
        '(generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))")'
    )
  }
  return buf
}

// Returns a compact 'iv:tag:ciphertext' string, each segment base64.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

// Reverses encrypt(). Throws if the blob is malformed or has been tampered
// with (GCM auth tag mismatch) — callers should treat a throw as "no usable
// connection" rather than crashing a user-facing flow.
export function decrypt(blob: string): string {
  const parts = blob.split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted blob')
  }
  const [ivB64, tagB64, dataB64] = parts
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

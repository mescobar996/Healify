/**
 * Tests for src/lib/security-utils.ts
 *
 * Covers: encrypt / decrypt round-trip, edge cases, and
 * format correctness without needing a real ENCRYPTION_KEY
 * (module uses a safe dev fallback when the env var is absent).
 */
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '@/lib/security-utils'

describe('security-utils - encrypt / decrypt', () => {
  // Round-trip
  it('decrypt(encrypt(text)) === original text', () => {
    const original = 'super-secret-payload'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('works with an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('works with multiline text', () => {
    const text = 'line1\nline2\nline3'
    expect(decrypt(encrypt(text))).toBe(text)
  })

  it('works with a long payload (forces multi-block AES)', () => {
    const long = 'A'.repeat(512)
    expect(decrypt(encrypt(long))).toBe(long)
  })

  // Format validation — AES-256-GCM output: iv(24):authTag(32):ciphertext
  it('encrypted output has the iv:authTag:ciphertext format', () => {
    const ciphertext = encrypt('test')
    expect(ciphertext).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/)
  })

  it('IV part is always 24 hex chars (12 bytes)', () => {
    const ciphertext = encrypt('hello')
    const iv = ciphertext.split(':')[0]
    expect(iv).toHaveLength(24)
  })

  it('authTag part is always 32 hex chars (16 bytes)', () => {
    const ciphertext = encrypt('hello')
    const authTag = ciphertext.split(':')[1]
    expect(authTag).toHaveLength(32)
  })

  it('tampered ciphertext throws on decryption (integrity check)', () => {
    const ciphertext = encrypt('sensitive-data')
    const parts = ciphertext.split(':')
    // Flip a byte in the ciphertext portion
    const tampered = parts[0] + ':' + parts[1] + ':ff' + parts[2].slice(2)
    expect(() => decrypt(tampered)).toThrow()
  })

  // Non-determinism: each call uses a fresh random IV
  it('two encryptions of the same text produce different ciphertexts', () => {
    const a = encrypt('same-text')
    const b = encrypt('same-text')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe('same-text')
    expect(decrypt(b)).toBe('same-text')
  })

  // Multiple different plaintexts
  it('different plaintexts decrypt to their respective originals', () => {
    const values = ['alpha', 'beta', 'gamma']
    for (const plain of values) {
      expect(decrypt(encrypt(plain))).toBe(plain)
    }
  })

  // Resilience
  it('decrypt throws on a completely invalid ciphertext', () => {
    expect(() => decrypt('not-valid-at-all')).toThrow()
  })
})

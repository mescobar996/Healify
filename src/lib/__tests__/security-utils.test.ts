/**
 * Tests for src/lib/security-utils.ts — AES-256-CBC
 *
 * ENCRYPTION_KEY es seteada en src/test/setup.ts (global, antes de imports).
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    project: { update: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/audit-log-service', () => ({
  auditLogService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}))

const { encrypt, decrypt } = await import('@/lib/security-utils')

describe('security-utils - encrypt / decrypt (AES-256-CBC)', () => {

  it('decrypt(encrypt(text)) === original text', () => {
    expect(decrypt(encrypt('super-secret-payload'))).toBe('super-secret-payload')
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

  it('encrypted output has iv:ciphertext format (hex)', () => {
    const parts = encrypt('test').split(':')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^[0-9a-f]+$/)
    expect(parts[1]).toMatch(/^[0-9a-f]+$/)
  })

  it('IV part is always 32 hex chars (16 bytes)', () => {
    const iv = encrypt('hello').split(':')[0]
    expect(iv).toHaveLength(32)
  })

  it('two encryptions of the same text produce different ciphertexts', () => {
    const a = encrypt('same-text')
    const b = encrypt('same-text')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe('same-text')
    expect(decrypt(b)).toBe('same-text')
  })

  it('different plaintexts decrypt to their respective originals', () => {
    for (const plain of ['alpha', 'beta', 'gamma']) {
      expect(decrypt(encrypt(plain))).toBe(plain)
    }
  })

  it('decrypt throws on a completely invalid ciphertext', () => {
    expect(() => decrypt('not-valid-at-all')).toThrow()
  })
})

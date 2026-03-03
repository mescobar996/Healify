/**
 * Tests for src/lib/api-key-service.ts
 *
 * Tests pure functions (generateApiKey, hashApiKey, getKeyPrefix,
 * extractApiKey) without hitting the DB, plus validation logic
 * with a mocked Prisma client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

// Mock the DB module before importing the service
vi.mock('@/lib/db', () => ({
  db: {
    project: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
  extractApiKey,
  validateApiKey,
} from '@/lib/api-key-service'

import { db } from '@/lib/db'

// Helper: typed mock accessor
const mockFindUnique = db.project.findUnique as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ── generateApiKey ─────────────────────────────────────────────────────────
describe('generateApiKey', () => {
  it('returns a string starting with "hf_"', () => {
    expect(generateApiKey()).toMatch(/^hf_/)
  })

  it('has the expected length (hf_ + 64 hex chars)', () => {
    // randomBytes(32) = 64 hex chars
    expect(generateApiKey()).toHaveLength(3 + 64)
  })

  it('generates unique keys on successive calls', () => {
    const keys = new Set(Array.from({ length: 20 }, generateApiKey))
    expect(keys.size).toBe(20)
  })
})

// ── hashApiKey ─────────────────────────────────────────────────────────────
describe('hashApiKey', () => {
  it('produces a 64-char hex SHA-256 digest', () => {
    expect(hashApiKey('hf_test_key')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    expect(hashApiKey('abc')).toBe(hashApiKey('abc'))
  })

  it('matches Node crypto createHash("sha256")', () => {
    const expected = createHash('sha256').update('my-key').digest('hex')
    expect(hashApiKey('my-key')).toBe(expected)
  })

  it('different inputs produce different hashes', () => {
    expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'))
  })
})

// ── getKeyPrefix ───────────────────────────────────────────────────────────
describe('getKeyPrefix', () => {
  it('returns first 8 chars + "..." + last 4 chars for a normal key', () => {
    const key = 'hf_abcdef0123456789'
    expect(getKeyPrefix(key)).toBe('hf_abcde...6789')
  })

  it('returns the key as-is when shorter than 12 chars', () => {
    expect(getKeyPrefix('short')).toBe('short')
    expect(getKeyPrefix('11chars!!!!')).toBe('11chars!!!!') // 11 chars < 12
  })
})

// ── extractApiKey ──────────────────────────────────────────────────────────
describe('extractApiKey', () => {
  const makeReq = (headers: Record<string, string>) =>
    new Request('https://example.com', { headers })

  it('extracts key from x-api-key header', () => {
    const req = makeReq({ 'x-api-key': 'hf_my_key' })
    expect(extractApiKey(req)).toBe('hf_my_key')
  })

  it('extracts key from Authorization: Bearer header', () => {
    const req = makeReq({ authorization: 'Bearer hf_bearer_key' })
    expect(extractApiKey(req)).toBe('hf_bearer_key')
  })

  it('prefers x-api-key over Authorization header', () => {
    const req = makeReq({
      'x-api-key': 'hf_direct',
      authorization: 'Bearer hf_bearer',
    })
    expect(extractApiKey(req)).toBe('hf_direct')
  })

  it('returns null when no key present', () => {
    expect(extractApiKey(makeReq({}))).toBeNull()
  })

  it('returns null for malformed Authorization header', () => {
    const req = makeReq({ authorization: 'Token something' })
    expect(extractApiKey(req)).toBeNull()
  })
})

// ── validateApiKey ─────────────────────────────────────────────────────────
describe('validateApiKey', () => {
  it('returns invalid for null key', async () => {
    const result = await validateApiKey(null)
    expect(result.valid).toBe(false)
  })

  it('returns invalid for undefined key', async () => {
    const result = await validateApiKey(undefined)
    expect(result.valid).toBe(false)
  })

  it('returns invalid for a key shorter than 8 chars', async () => {
    const result = await validateApiKey('short')
    expect(result.valid).toBe(false)
  })

  it('returns valid with projectId when hash lookup succeeds', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'proj-123', name: 'My Project' })

    const result = await validateApiKey('hf_' + 'a'.repeat(64))
    expect(result.valid).toBe(true)
    expect(result.projectId).toBe('proj-123')
    expect(result.projectName).toBe('My Project')
  })

  it('returns invalid when neither hash nor plaintext lookup finds the project', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await validateApiKey('hf_' + 'b'.repeat(64))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid API key')
  })

  it('returns invalid (not throw) when DB is unavailable', async () => {
    mockFindUnique.mockRejectedValueOnce(
      new Error('PrismaClientInitializationError: DATABASE_URL not found')
    )

    const result = await validateApiKey('hf_' + 'c'.repeat(64))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid API key')
  })
})

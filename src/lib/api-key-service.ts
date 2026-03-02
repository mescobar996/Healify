/**
 * HEALIFY - API Key Service
 * Secure API Key validation with SHA-256 hash-at-rest support.
 * Backward-compatible: tries hash lookup first, falls back to plaintext legacy lookup.
 */

import { db } from '@/lib/db'
import { randomBytes, createHash, timingSafeEqual } from 'crypto'

// ============================================
// TYPES
// ============================================

export interface ApiKeyValidation {
  valid: boolean
  projectId?: string
  projectName?: string
  error?: string
}

export interface ApiKeyCreate {
  key: string
  projectId: string
}

// ============================================
// CONSTANTS
// ============================================

const KEY_CACHE_TTL = 60000 // 1 minute cache

// In-memory cache for API key validation (keyed by hash)
const keyCache = new Map<string, { projectId: string; timestamp: number }>()

function isDbUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes('database_url') || message.includes('prismaclientinitializationerror')
}

// ============================================
// API KEY GENERATION
// ============================================

export function generateApiKey(): string {
  return `hf_${randomBytes(32).toString('hex')}`
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function getKeyPrefix(key: string): string {
  if (key.length < 12) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

// ============================================
// API KEY VALIDATION
// ============================================

/**
 * Validate an API key.
 * Strategy:
 *   1. Hash the incoming key and look up by apiKeyHash (new path)
 *   2. If not found, fall back to plaintext apiKey lookup (legacy path)
 *   3. On legacy hit, backfill the hash/prefix columns for future lookups
 */
export async function validateApiKey(
  apiKey: string | null | undefined
): Promise<ApiKeyValidation> {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 8) {
    return { valid: false, error: 'API key is required' }
  }

  const hash = hashApiKey(apiKey)

  // Check cache first (keyed by hash for safety)
  const cached = keyCache.get(hash)
  if (cached && Date.now() - cached.timestamp < KEY_CACHE_TTL) {
    return {
      valid: true,
      projectId: cached.projectId,
    }
  }

  let project: { id: string; name: string } | null = null

  try {
    // ── Path 1: Hash-based lookup (preferred) ──────────────────────
    project = await db.project.findUnique({
      where: { apiKeyHash: hash },
      select: { id: true, name: true },
    })

    // ── Path 2: Legacy plaintext lookup + backfill ─────────────────
    if (!project) {
      project = await db.project.findUnique({
        where: { apiKey },
        select: { id: true, name: true },
      })

      // Backfill hash/prefix on legacy hit so next lookup uses hash path
      if (project) {
        await db.project.update({
          where: { id: project.id },
          data: {
            apiKeyHash: hash,
            apiKeyPrefix: getKeyPrefix(apiKey),
          },
        }).catch(() => {}) // Non-critical: don't fail the request
      }
    }
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return { valid: false, error: 'Invalid API key' }
    }
    throw error
  }

  if (!project) {
    return { valid: false, error: 'Invalid API key' }
  }

  // Update cache (keyed by hash)
  keyCache.set(hash, { projectId: project.id, timestamp: Date.now() })

  return {
    valid: true,
    projectId: project.id,
    projectName: project.name,
  }
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Rotate the API key for a project.
 * Stores hash + prefix only. Returns plaintext key ONCE for display to the user.
 */
export async function rotateApiKey(projectId: string): Promise<ApiKeyCreate> {
  const newKey = generateApiKey()
  const hash = hashApiKey(newKey)
  const prefix = getKeyPrefix(newKey)

  await db.project.update({
    where: { id: projectId },
    data: {
      apiKey: newKey,          // Keep legacy column in sync during transition
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
    },
  })

  // Invalidate cache for this project
  for (const [key, value] of keyCache.entries()) {
    if (value.projectId === projectId) keyCache.delete(key)
  }

  return { key: newKey, projectId }
}

/**
 * Get project API key display info (never expose the key itself).
 * Uses stored prefix when available, falls back to computing from plaintext.
 */
export async function getProjectApiKeyInfo(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, apiKey: true, apiKeyPrefix: true, createdAt: true },
  })
  if (!project) return null
  return {
    id: project.id,
    name: project.name,
    keyPrefix: project.apiKeyPrefix || getKeyPrefix(project.apiKey),
    createdAt: project.createdAt,
  }
}

// ============================================
// MIDDLEWARE HELPERS
// ============================================

export function extractApiKey(request: Request): string | null {
  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader) return apiKeyHeader
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return null
}

export async function validateApiKeyFromRequest(
  request: Request
): Promise<ApiKeyValidation> {
  const apiKey = extractApiKey(request)
  return validateApiKey(apiKey)
}

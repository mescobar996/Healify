/**
 * HEALIFY - API Key Service
 * Secure API Key validation using the apiKey field on Project model
 */

import { db } from '@/lib/db'
import { randomBytes, createHash } from 'crypto'

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

// In-memory cache for API key validation
const keyCache = new Map<string, { projectId: string; timestamp: number }>()

// ============================================
// API KEY GENERATION
// ============================================

export function generateApiKey(): string {
  return randomBytes(32).toString('hex')
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function getKeyPrefix(key: string): string {
  if (key.length < 12) return key
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

// ============================================
// API KEY VALIDATION
// ============================================

/**
 * Validate an API key — looks up the apiKey field on Project directly
 */
export async function validateApiKey(
  apiKey: string | null | undefined
): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }

  // Check cache first
  const cached = keyCache.get(apiKey)
  if (cached && Date.now() - cached.timestamp < KEY_CACHE_TTL) {
    return {
      valid: true,
      projectId: cached.projectId,
    }
  }

  // Look up project by apiKey field
  const project = await db.project.findUnique({
    where: { apiKey },
    select: { id: true, name: true },
  })

  if (!project) {
    return { valid: false, error: 'Invalid API key' }
  }

  // Update cache
  keyCache.set(apiKey, { projectId: project.id, timestamp: Date.now() })

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
 * Rotate the API key for a project (generates a new cuid via Prisma default)
 */
export async function rotateApiKey(projectId: string): Promise<ApiKeyCreate> {
  const newKey = generateApiKey()

  await db.project.update({
    where: { id: projectId },
    data: { apiKey: newKey },
  })

  // Invalidate cache for this project
  for (const [key, value] of keyCache.entries()) {
    if (value.projectId === projectId) keyCache.delete(key)
  }

  return { key: newKey, projectId }
}

/**
 * List projects accessible via API key (for display — never expose the key itself)
 */
export async function getProjectApiKeyInfo(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, apiKey: true, createdAt: true },
  })
  if (!project) return null
  return {
    id: project.id,
    name: project.name,
    keyPrefix: getKeyPrefix(project.apiKey),
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

/**
 * HEALIFY - API Key Service
 * Secure API Key validation and management
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
  id: string
  key: string // Only returned once on creation
  projectId: string
  prefix: string
  createdAt: Date
}

// ============================================
// CONSTANTS
// ============================================

const API_KEY_PREFIX = 'hf_live_'
const API_KEY_LENGTH = 32
const KEY_CACHE_TTL = 60000 // 1 minute cache

// In-memory cache for API key validation (ultra-fast)
const keyCache = new Map<string, { projectId: string; timestamp: number }>()

// ============================================
// API KEY GENERATION
// ============================================

/**
 * Generate a new API key with format: hf_live_xxxxxxxxxxxxxxxx
 */
export function generateApiKey(): string {
  const randomString = randomBytes(API_KEY_LENGTH)
    .toString('base64')
    .replace(/[+/=]/g, '') // Remove special chars
    .slice(0, API_KEY_LENGTH)
  
  return `${API_KEY_PREFIX}${randomString}`
}

/**
 * Hash an API key for storage (never store plain text)
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Get the prefix for display (hf_live_...xxxx)
 */
export function getKeyPrefix(key: string): string {
  if (key.length < 12) return key
  return `${key.slice(0, 9)}...${key.slice(-4)}`
}

// ============================================
// API KEY VALIDATION
// ============================================

/**
 * Validate an API key against the database
 * Uses in-memory cache for ultra-fast validation
 */
export async function validateApiKey(
  apiKey: string | null | undefined
): Promise<ApiKeyValidation> {
  // Check if key is provided
  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }

  // Check format
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: 'Invalid API key format' }
  }

  // Check cache first (ultra-fast path)
  const cached = keyCache.get(apiKey)
  if (cached && Date.now() - cached.timestamp < KEY_CACHE_TTL) {
    const project = await db.project.findUnique({
      where: { id: cached.projectId },
      select: { id: true, name: true, isActive: true },
    })

    if (project?.isActive) {
      return {
        valid: true,
        projectId: project.id,
        projectName: project.name,
      }
    }
  }

  // Hash the key for database lookup
  const keyHash = hashApiKey(apiKey)

  // Find the key in database
  const apiKeyRecord = await db.apiKey.findUnique({
    where: { keyHash },
    include: {
      project: {
        select: { id: true, name: true, isActive: true },
      },
    },
  })

  // Key not found
  if (!apiKeyRecord) {
    return { valid: false, error: 'Invalid API key' }
  }

  // Key revoked
  if (!apiKeyRecord.isActive) {
    return { valid: false, error: 'API key has been revoked' }
  }

  // Project inactive
  if (!apiKeyRecord.project.isActive) {
    return { valid: false, error: 'Project is inactive' }
  }

  // Key expired
  if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
    return { valid: false, error: 'API key has expired' }
  }

  // Update cache
  keyCache.set(apiKey, {
    projectId: apiKeyRecord.projectId,
    timestamp: Date.now(),
  })

  // Update last used timestamp (async, non-blocking)
  db.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return {
    valid: true,
    projectId: apiKeyRecord.projectId,
    projectName: apiKeyRecord.project.name,
  }
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Create a new API key for a project
 */
export async function createApiKeyForProject(
  projectId: string,
  name?: string
): Promise<ApiKeyCreate> {
  const key = generateApiKey()
  const keyHash = hashApiKey(key)
  const prefix = getKeyPrefix(key)

  const apiKeyRecord = await db.apiKey.create({
    data: {
      keyHash,
      prefix,
      name: name || 'Default API Key',
      projectId,
    },
  })

  return {
    id: apiKeyRecord.id,
    key, // Only returned once!
    projectId,
    prefix,
    createdAt: apiKeyRecord.createdAt,
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  try {
    await db.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    })
    
    // Clear from cache
    for (const [key, value] of keyCache.entries()) {
      // We'd need to store keyId in cache for proper invalidation
      // For now, clear entire cache on revocation
    }
    keyCache.clear()
    
    return true
  } catch {
    return false
  }
}

/**
 * List API keys for a project (without revealing the actual key)
 */
export async function listApiKeysForProject(projectId: string) {
  return db.apiKey.findMany({
    where: { projectId, isActive: true },
    select: {
      id: true,
      prefix: true,
      name: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ============================================
// MIDDLEWARE HELPER
// ============================================

/**
 * Extract API key from request headers
 */
export function extractApiKey(request: Request): string | null {
  // Check x-api-key header (preferred)
  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader) return apiKeyHeader

  // Check Authorization: Bearer header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * Middleware-like function to validate API key from request
 */
export async function validateApiKeyFromRequest(
  request: Request
): Promise<ApiKeyValidation> {
  const apiKey = extractApiKey(request)
  return validateApiKey(apiKey)
}
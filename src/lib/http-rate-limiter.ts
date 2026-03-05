/**
 * HTTP Rate Limiter
 *
 * Fixed-window rate limiter backed by Redis.
 * Falls back gracefully if Redis is unavailable (allows the request through).
 *
 * Usage in an API route:
 *
 *   import { httpRateLimit } from '@/lib/http-rate-limiter'
 *
 *   export async function POST(req: NextRequest) {
 *     const limit = await httpRateLimit(req, { limit: 20, window: 60 })
 *     if (!limit.ok) return limit.response
 *     ...
 *   }
 *
 * Preset configs are exported for common use cases.
 */

import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export interface RateLimitConfig {
  /** Max requests allowed per window */
  limit: number
  /** Window duration in seconds */
  window: number
  /** Optional human-readable name for the limiter (used in logs) */
  name?: string
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  reset: number // Unix timestamp when the window resets
  /** 429 response — only set when ok === false */
  response?: NextResponse
}

// ─── Predefined configs per endpoint category ─────────────────────────────

export const RATE_LIMITS = {
  /** Public unauthenticated endpoints (waitlist, exchange-rate, health) */
  public: { limit: 60, window: 60 },

  /** Auth-guarded API endpoints — authenticated users */
  authenticated: { limit: 300, window: 60 },

  /** Checkout / billing mutations */
  billing: { limit: 10, window: 60 },

  /** Webhook endpoints — MP/Stripe send many events, but limit abuse */
  webhook: { limit: 200, window: 60 },

  /** Heavy AI/report endpoints */
  heavy: { limit: 20, window: 60 },

  /** Login / signup attempts */
  auth: { limit: 10, window: 30 },
} as const satisfies Record<string, RateLimitConfig>

// ─── Core implementation ───────────────────────────────────────────────────

/**
 * Identify the rate limit key.
 * - Authenticated: use the user id from JWT (x-user-id header set by middleware, or query)
 * - Anonymous: use best-effort IP
 */
function getRateLimitKey(req: NextRequest, suffix: string): string {
  // Vercel sets x-real-ip; fallback to x-forwarded-for
  const ip =
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown'

  return `rl:${suffix}:${ip}`
}

export async function httpRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  keyOverride?: string,
): Promise<RateLimitResult> {
  const key = keyOverride ?? getRateLimitKey(req, config.name ?? 'default')
  const reset = Math.floor(Date.now() / 1000) + config.window

  try {
    // Increment counter — returns new value after increment
    const count = await redis.incr(key)

    // Set TTL only on first request in this window
    if (count === 1) {
      await redis.expire(key, config.window)
    } else {
      // Safety: if TTL is -1 (EXPIRE failed previously), re-apply
      const ttlCheck = await redis.ttl(key)
      if (ttlCheck === -1) await redis.expire(key, config.window)
    }

    const remaining = Math.max(0, config.limit - count)
    const ok = count <= config.limit

    if (!ok) {
      const response = NextResponse.json(
        {
          error: 'Too many requests. Please slow down.',
          retryAfter: config.window,
        },
        {
          status: 429,
          headers: {
            'Retry-After':         String(config.window),
            'X-RateLimit-Limit':   String(config.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':   String(reset),
          },
        },
      )
      return { ok: false, remaining: 0, reset, response }
    }

    return { ok: true, remaining, reset }
  } catch {
    // Redis unavailable — allow request through (fail open for availability)
    return { ok: true, remaining: config.limit, reset }
  }
}

// ─── Convenience wrappers ──────────────────────────────────────────────────

export const billingRateLimit  = (req: NextRequest) => httpRateLimit(req, { ...RATE_LIMITS.billing,       name: 'billing' })
export const authRateLimit     = (req: NextRequest) => httpRateLimit(req, { ...RATE_LIMITS.auth,          name: 'auth' })
export const publicRateLimit   = (req: NextRequest) => httpRateLimit(req, { ...RATE_LIMITS.public,        name: 'public' })
export const heavyRateLimit    = (req: NextRequest) => httpRateLimit(req, { ...RATE_LIMITS.heavy,         name: 'heavy' })
export const webhookRateLimit  = (req: NextRequest) => httpRateLimit(req, { ...RATE_LIMITS.webhook,       name: 'webhook' })
export const apiRateLimit      = (req: NextRequest) => httpRateLimit(req, { ...RATE_LIMITS.authenticated, name: 'api' })

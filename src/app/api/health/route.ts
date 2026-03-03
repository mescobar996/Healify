import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRedisInstance } from '@/lib/redis'

/**
 * GET /api/health
 *
 * Health check endpoint used by Railway and any uptime monitor.
 * Returns 200 if the service is healthy, 503 if it is not.
 *
 * Checks:
 *  - Database connectivity (Prisma ping)
 *  - Redis connectivity (optional — degraded, not fatal)
 */
export async function GET() {
  const start = Date.now()

  // ── Database check ────────────────────────────────────────────────
  let dbStatus: 'ok' | 'error' = 'ok'
  let dbError: string | undefined

  try {
    await db.$queryRaw`SELECT 1`
  } catch (err) {
    dbStatus = 'error'
    dbError = err instanceof Error ? err.message : 'Unknown DB error'
  }

  // ── Redis check (optional, non-fatal) ────────────────────────────
  let redisStatus: 'ok' | 'unavailable' | 'error' = 'ok'
  let redisError: string | undefined

  const redisInstance = getRedisInstance()
  if (!redisInstance) {
    redisStatus = 'unavailable'
  } else {
    try {
      await redisInstance.ping()
    } catch (err) {
      redisStatus = 'error'
      redisError = err instanceof Error ? err.message : 'Unknown Redis error'
    }
  }

  // ── Result ────────────────────────────────────────────────────────
  const healthy = dbStatus === 'ok'
  const latency = Date.now() - start

  const body = {
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    latencyMs: latency,
    version: process.env.npm_package_version ?? '0.2.0',
    services: {
      database: { status: dbStatus, ...(dbError ? { error: dbError } : {}) },
      redis: { status: redisStatus, ...(redisError ? { error: redisError } : {}) },
    },
  }

  return NextResponse.json(body, { status: healthy ? 200 : 503 })
}

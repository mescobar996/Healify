/**
 * GET  /api/cron/health-ping
 *
 * Lightweight uptime-monitor endpoint designed to be called every 5 minutes by
 * Vercel Cron, Railway Cron-Job, or an external monitor (e.g. BetterUptime,
 * UptimeRobot, Checkly).
 *
 * It verifies:
 *   1. Database connectivity   (Prisma SELECT 1)
 *   2. Redis connectivity      (PING — optional, non-fatal)
 *   3. Railway worker reachability  (optional, if RAILWAY_WORKER_URL is set)
 *
 * Authentication: requires `Authorization: Bearer <CRON_SECRET>` when
 * CRON_SECRET is set.  If CRON_SECRET is not configured, the endpoint is open
 * (useful for external monitors with secret-less GET polling).
 *
 * Returns:
 *   200  — all critical services healthy
 *   503  — at least one critical service is down
 *   401  — bad or missing bearer token (when CRON_SECRET is configured)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRedisInstance } from '@/lib/redis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ServiceCheck {
  status: 'ok' | 'degraded' | 'error'
  latencyMs?: number
  error?: string
}

export async function GET(request: NextRequest) {
  // ── Auth (optional) ─────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const start = Date.now()

  // ── Database ────────────────────────────────────────────────────
  const database: ServiceCheck = { status: 'ok' }
  try {
    const t0 = Date.now()
    await db.$queryRaw`SELECT 1`
    database.latencyMs = Date.now() - t0
  } catch (err) {
    database.status = 'error'
    database.error = err instanceof Error ? err.message : 'Unknown DB error'
  }

  // ── Redis ───────────────────────────────────────────────────────
  const redisCheck: ServiceCheck = { status: 'ok' }
  const redisInstance = getRedisInstance()
  if (!redisInstance) {
    redisCheck.status = 'degraded'
    redisCheck.error = 'Not configured'
  } else {
    try {
      const t0 = Date.now()
      await redisInstance.ping()
      redisCheck.latencyMs = Date.now() - t0
    } catch (err) {
      redisCheck.status = 'error'
      redisCheck.error = err instanceof Error ? err.message : 'Redis error'
    }
  }

  // ── Railway worker (optional) ──────────────────────────────────
  const workerUrl = process.env.RAILWAY_WORKER_URL
  let worker: ServiceCheck | undefined
  if (workerUrl) {
    worker = { status: 'ok' }
    try {
      const t0 = Date.now()
      const res = await fetch(`${workerUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      })
      worker.latencyMs = Date.now() - t0
      if (!res.ok) {
        worker.status = 'degraded'
        worker.error = `HTTP ${res.status}`
      }
    } catch (err) {
      worker.status = 'error'
      worker.error = err instanceof Error ? err.message : 'Unreachable'
    }
  }

  // ── Result ─────────────────────────────────────────────────────
  const healthy = database.status === 'ok'
  const totalLatency = Date.now() - start

  const body = {
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    totalLatencyMs: totalLatency,
    services: {
      database,
      redis: redisCheck,
      ...(worker ? { worker } : {}),
    },
  }

  return NextResponse.json(body, { status: healthy ? 200 : 503 })
}

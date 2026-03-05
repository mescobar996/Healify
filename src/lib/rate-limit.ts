import { db } from '@/lib/db'
import { redis } from '@/lib/redis'

// ═══════════════════════════════════════════════════════════════════════
// LÍMITES POR PLAN
// ═══════════════════════════════════════════════════════════════════════
export const PLAN_LIMITS = {
    FREE:       { projects: 1,  testRunsPerMonth: 50  },
    STARTER:    { projects: 5,  testRunsPerMonth: 100 },
    PRO:        { projects: -1, testRunsPerMonth: 1000 }, // -1 = ilimitado
    ENTERPRISE: { projects: -1, testRunsPerMonth: -1  },
} as const

export const PLAN_REPORT_LIMITS = {
    FREE: 30,
    STARTER: 60,
    PRO: 120,
    ENTERPRISE: 300,
} as const

type PlanKey = keyof typeof PLAN_LIMITS

type ReportRateCheck = {
    allowed: boolean
    plan: PlanKey
    limit: number
    remaining: number
    resetInMs: number
}

const REPORT_WINDOW_SECS = 60 // 1-minute window (Redis TTL in seconds)

// ─── Obtener el plan activo del usuario desde DB ───────────────────────
async function getUserPlan(userId: string): Promise<PlanKey> {
    const sub = await db.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true, trialEndsAt: true },
    })
    if (!sub || sub.status === 'canceled') return 'FREE'

    // Free trial: grant STARTER features while trial is active
    if (sub.status === 'trial') {
        if (sub.trialEndsAt && sub.trialEndsAt > new Date()) return 'STARTER'
        return 'FREE' // Trial expired
    }

    return (sub.plan as PlanKey) || 'FREE'
}

async function getProjectPlan(projectId: string): Promise<PlanKey> {
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: {
            userId: true,
            user: {
                select: {
                    subscription: {
                        select: { plan: true, status: true },
                    },
                },
            },
        },
    })

    const sub = project?.user?.subscription
    if (!project?.userId || !sub || sub.status === 'canceled') return 'FREE'

    if (sub.status === 'trial') {
        const trialSub = await db.subscription.findUnique({
            where: { userId: project.userId },
            select: { trialEndsAt: true },
        })
        if (trialSub?.trialEndsAt && trialSub.trialEndsAt > new Date()) return 'STARTER'
        return 'FREE'
    }

    return (sub.plan as PlanKey) || 'FREE'
}

// ─── Check: ¿puede crear otro proyecto? ───────────────────────────────
export async function checkProjectLimit(userId: string): Promise<{
    allowed: boolean
    plan: PlanKey
    current: number
    limit: number
}> {
    const plan = await getUserPlan(userId)
    const limits = PLAN_LIMITS[plan]

    if (limits.projects === -1) {
        return { allowed: true, plan, current: 0, limit: -1 }
    }

    const current = await db.project.count({ where: { userId } })
    return {
        allowed: current < limits.projects,
        plan,
        current,
        limit: limits.projects,
    }
}

// ─── Check: ¿puede crear otro test run este mes? ──────────────────────
export async function checkTestRunLimit(userId: string): Promise<{
    allowed: boolean
    plan: PlanKey
    current: number
    limit: number
}> {
    const plan = await getUserPlan(userId)
    const limits = PLAN_LIMITS[plan]

    if (limits.testRunsPerMonth === -1) {
        return { allowed: true, plan, current: 0, limit: -1 }
    }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const current = await db.testRun.count({
        where: {
            project: { userId },
            startedAt: { gte: startOfMonth },
        },
    })

    return {
        allowed: current < limits.testRunsPerMonth,
        plan,
        current,
        limit: limits.testRunsPerMonth,
    }
}

export async function checkApiReportRateLimit(projectId: string): Promise<ReportRateCheck> {
    const plan = await getProjectPlan(projectId)
    const limit = PLAN_REPORT_LIMITS[plan]
    const key = `rl:report:${projectId}`

    try {
        const count = await redis.incr(key)
        if (count === 1) {
            await redis.expire(key, REPORT_WINDOW_SECS)
        } else {
            // Safety: if TTL is -1 (no expiry—EXPIRE failed previously), set it now (A-H2)
            const ttlCheck = await redis.ttl(key)
            if (ttlCheck === -1) {
                await redis.expire(key, REPORT_WINDOW_SECS)
            }
        }
        const ttl = await redis.ttl(key)
        const resetInMs = Math.max(0, ttl * 1000)

        return {
            allowed: count <= limit,
            plan,
            limit,
            remaining: Math.max(0, limit - count),
            resetInMs,
        }
    } catch {
        // Redis unavailable — fail-open but log for observability (A-H1)
        console.warn('[rate-limit] Redis unavailable for checkApiReportRateLimit, allowing request')
        return { allowed: true, plan, limit, remaining: limit - 1, resetInMs: REPORT_WINDOW_SECS * 1000 }
    }
}

// ─── Auth brute-force protection ────────────────────────────────────────
// 10 sign-in attempts per 15-minute window per IP
const AUTH_WINDOW_SECS = 15 * 60
const AUTH_MAX_ATTEMPTS = 10

export async function checkAuthRateLimit(ip: string): Promise<boolean> {
    const key = `rl:auth:${ip}`
    try {
        const count = await redis.incr(key)
        if (count === 1) {
            await redis.expire(key, AUTH_WINDOW_SECS)
        } else {
            const ttlCheck = await redis.ttl(key)
            if (ttlCheck === -1) await redis.expire(key, AUTH_WINDOW_SECS)
        }
        return count <= AUTH_MAX_ATTEMPTS
    } catch {
        console.warn('[rate-limit] Redis unavailable for checkAuthRateLimit, allowing request')
        return true
    }
}

// ─── Respuesta 429 estándar ────────────────────────────────────────────
export function limitExceededResponse(type: 'projects' | 'testRuns', result: {
    plan: PlanKey; current: number; limit: number
}) {
    const messages = {
        projects: `Límite de proyectos alcanzado (${result.current}/${result.limit}) en el plan ${result.plan}.`,
        testRuns: `Límite de test runs mensuales alcanzado (${result.current}/${result.limit}) en el plan ${result.plan}.`,
    }
    return Response.json(
        {
            error: messages[type],
            limitExceeded: true,
            plan: result.plan,
            current: result.current,
            limit: result.limit,
            upgradeUrl: '/pricing',
        },
        { status: 429 }
    )
}

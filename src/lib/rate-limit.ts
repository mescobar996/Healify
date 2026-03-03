import { db } from '@/lib/db'

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

const REPORT_WINDOW_MS = 60_000

// In-memory rate-limit state per project.
// NOTE: state resets on process restart (acceptable for a soft rate limit).
// For multi-instance deployments, migrate this to Redis.
const reportWindowByProject = new Map<string, { count: number; resetAt: number }>()

// Prune expired entries every 5 minutes to prevent unbounded growth
setInterval(() => {
    const now = Date.now()
    for (const [key, state] of reportWindowByProject) {
        if (now > state.resetAt) reportWindowByProject.delete(key)
    }
}, 5 * 60_000).unref() // .unref() so the timer doesn't keep the process alive

// ─── Obtener el plan activo del usuario desde DB ───────────────────────
async function getUserPlan(userId: string): Promise<PlanKey> {
    const sub = await db.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true },
    })
    if (!sub || sub.status === 'canceled') return 'FREE'
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
    const now = Date.now()
    const plan = await getProjectPlan(projectId)
    const limit = PLAN_REPORT_LIMITS[plan]

    const windowState = reportWindowByProject.get(projectId)
    if (!windowState || now > windowState.resetAt) {
        reportWindowByProject.set(projectId, {
            count: 1,
            resetAt: now + REPORT_WINDOW_MS,
        })

        return {
            allowed: true,
            plan,
            limit,
            remaining: Math.max(0, limit - 1),
            resetInMs: REPORT_WINDOW_MS,
        }
    }

    if (windowState.count >= limit) {
        return {
            allowed: false,
            plan,
            limit,
            remaining: 0,
            resetInMs: Math.max(0, windowState.resetAt - now),
        }
    }

    windowState.count += 1
    return {
        allowed: true,
        plan,
        limit,
        remaining: Math.max(0, limit - windowState.count),
        resetInMs: Math.max(0, windowState.resetAt - now),
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

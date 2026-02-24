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

type PlanKey = keyof typeof PLAN_LIMITS

// ─── Obtener el plan activo del usuario desde DB ───────────────────────
async function getUserPlan(userId: string): Promise<PlanKey> {
    const sub = await db.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true },
    })
    if (!sub || sub.status === 'canceled') return 'FREE'
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

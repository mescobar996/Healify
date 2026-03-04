import { db } from '@/lib/db'

export interface ProjectAnalytics {
    timeSavedMinutes: number
    roiCurrency: number
    flakyTestsCount: number
    healingTrend: { date: string; count: number }[]
    aiAccuracyTrend: { date: string; accuracy: number }[]
    testReliabilityScore: number // 0 - 100
    aiAccuracyScore: number // 0 - 100
}

export class AnalyticsService {
    private readonly MINUTES_SAVED_PER_HEALING = 30
    private readonly DEV_HOURLY_RATE = 65

    async getProjectAnalytics(projectId: string): Promise<ProjectAnalytics> {
        const now = new Date()

        // 1 SQL query: healing trend for the last 7 days grouped by date
        const trendRows = await db.$queryRaw<{ date: string; count: bigint }[]>`
            SELECT DATE(he.created_at)::text AS date, COUNT(*) AS count
            FROM healing_events he
            JOIN test_runs tr ON he.test_run_id = tr.id
            WHERE tr.project_id = ${projectId}
              AND he.status IN ('HEALED_AUTO', 'HEALED_MANUAL')
              AND he.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(he.created_at)
            ORDER BY date
        `

        // Build full 7-day healing trend (fill missing days with 0)
        const trendMap = new Map(trendRows.map(r => [r.date, Number(r.count)]))
        const healingTrend: { date: string; count: number }[] = []
        let healingEventsCount = 0

        for (let i = 6; i >= 0; i--) {
            const d = new Date(now)
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            const count = trendMap.get(dateStr) ?? 0
            healingEventsCount += count
            healingTrend.push({ date: dateStr, count })
        }

        // 1 groupBy query: all-time counts per status (replaces 2 separate COUNT queries)
        const statusCounts = await db.healingEvent.groupBy({
            by: ['status'],
            where: { testRun: { projectId }, status: { not: 'ANALYZING' } },
            _count: { status: true },
        })

        const totalHealingEvents = statusCounts.reduce((s, r) => s + r._count.status, 0)
        const autoHealedTotal =
            statusCounts.find(r => r.status === 'HEALED_AUTO')?._count.status ?? 0

        const aiAccuracyScore =
            totalHealingEvents > 0
                ? Math.round((autoHealedTotal / totalHealingEvents) * 100)
                : 0

        const timeSavedMinutes = autoHealedTotal * this.MINUTES_SAVED_PER_HEALING
        const roiCurrency = (timeSavedMinutes / 60) * this.DEV_HOURLY_RATE

        // 1 SQL query: real daily accuracy (auto-healed / all non-ANALYZING) for trend
        const accuracyRows = await db.$queryRaw<
            { date: string; auto_count: bigint; total_count: bigint }[]
        >`
            SELECT
                DATE(he.created_at)::text AS date,
                COUNT(*) FILTER (WHERE he.status = 'HEALED_AUTO')  AS auto_count,
                COUNT(*) FILTER (WHERE he.status != 'ANALYZING')   AS total_count
            FROM healing_events he
            JOIN test_runs tr ON he.test_run_id = tr.id
            WHERE tr.project_id = ${projectId}
              AND he.status != 'ANALYZING'
              AND he.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(he.created_at)
            ORDER BY date
        `

        const accuracyMap = new Map(
            accuracyRows.map(r => [
                r.date,
                Number(r.total_count) > 0
                    ? Math.round((Number(r.auto_count) / Number(r.total_count)) * 100)
                    : aiAccuracyScore,
            ])
        )

        const aiAccuracyTrend: { date: string; accuracy: number }[] = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now)
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            aiAccuracyTrend.push({
                date: dateStr,
                accuracy: accuracyMap.get(dateStr) ?? aiAccuracyScore,
            })
        }

        return {
            timeSavedMinutes,
            roiCurrency,
            flakyTestsCount: Math.floor(autoHealedTotal / 3),
            healingTrend,
            aiAccuracyTrend,
            testReliabilityScore: Math.min(100, 60 + Math.round(aiAccuracyScore * 0.4)),
            aiAccuracyScore,
        }
    }

    async getGlobalStats(userId: string) {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // Tests autocurados este mes (HEALED_AUTO solamente — los manuales no son mérito de la IA)
        const autoHealedMonth = await db.healingEvent.count({
            where: {
                status: 'HEALED_AUTO',
                testRun: { project: { userId } },
                createdAt: { gte: startOfMonth }
            }
        })

        // Bugs reales detectados este mes (tests que fallaron y NO se pudieron curar)
        const bugsDetectedMonth = await db.healingEvent.count({
            where: {
                status: 'BUG_DETECTED',
                testRun: { project: { userId } },
                createdAt: { gte: startOfMonth }
            }
        })

        // Tests curados hoy
        const healedToday = await db.healingEvent.count({
            where: {
                status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
                testRun: { project: { userId } },
                createdAt: { gte: startOfToday }
            }
        })

        // Total histórico para ROI acumulado
        const totalAutoHealed = await db.healingEvent.count({
            where: {
                status: 'HEALED_AUTO',
                testRun: { project: { userId } }
            }
        })

        // Tasa de autocuración del mes
        const totalHealingAttempts = await db.healingEvent.count({
            where: {
                status: { not: 'ANALYZING' },
                testRun: { project: { userId } },
                createdAt: { gte: startOfMonth }
            }
        })

        const healingRate = totalHealingAttempts > 0
            ? Math.round((autoHealedMonth / totalHealingAttempts) * 100)
            : 0

        const timeSavedHours = Math.round((totalAutoHealed * this.MINUTES_SAVED_PER_HEALING) / 60)
        const totalCostSaved = Math.round(timeSavedHours * this.DEV_HOURLY_RATE)

        return {
            // Métricas ROI acumuladas (históricas)
            timeSavedHours,
            totalCostSaved,
            totalAutoHealed,
            // Métricas del mes actual
            autoHealedMonth,
            bugsDetectedMonth,
            healingRate,
            // Métricas de hoy
            healedToday,
        }
    }
}

export const analyticsService = new AnalyticsService()

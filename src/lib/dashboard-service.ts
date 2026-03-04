import { db } from '@/lib/db'
import { redis } from '@/lib/redis'

interface ChartAggregateRow {
  day: Date
  testsRotos: number | bigint
  curados: number | bigint
}

// ============================================
// TIPOS DE RESPUESTA PARA EL FRONTEND
// ============================================

export interface DashboardMetrics {
  testsExecutedToday: number
  testsExecutedTodayChange: string
  autoHealingRate: number
  autoHealingRateChange: string
  bugsDetected: number
  bugsDetectedChange: string
  avgHealingTime: string
  avgHealingTimeChange: string
}

export interface ChartDataPoint {
  date: string
  testsRotos: number
  curados: number
}

export interface HealingHistoryItem {
  id: string
  testName: string
  status: 'curado' | 'fallido' | 'pendiente'
  confidence: number
  timestamp: string
  oldSelector: string
  newSelector: string | null
}

export interface FragileSelector {
  selector: string
  failures: number
  successRate: number
}

export interface DashboardData {
  metrics: DashboardMetrics
  chartData: ChartDataPoint[]
  healingHistory: HealingHistoryItem[]
  fragileSelectors: FragileSelector[]
}

// ============================================
// SERVICIO DE DASHBOARD CON CACHÉ
// ============================================

export class DashboardService {
  private readonly CACHE_TTL = 60 // 60 segundos
  private readonly CACHE_PREFIX = 'dashboard:'

  /**
   * Obtiene todos los datos del dashboard para un usuario
   * Incluye caché Redis para métricas pesadas
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    // Intentar obtener del caché
    const cacheKey = `${this.CACHE_PREFIX}${userId}`
    
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.warn('Redis cache read failed:', error)
    }

    // Si no hay caché, calcular datos
    const [metrics, chartData, healingHistory, fragileSelectors] = await Promise.all([
      this.getMetrics(userId),
      this.getChartData(userId),
      this.getHealingHistory(userId, 5),
      this.getFragileSelectors(userId, 4),
    ])

    const data: DashboardData = {
      metrics,
      chartData,
      healingHistory,
      fragileSelectors,
    }

    // Guardar en caché (no bloqueante)
    redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(data)).catch(() => {})

    return data
  }

  /**
   * Métricas para las 4 cards del dashboard.
   *
   * Consolidated into two raw SQL queries (one for test-run counts, one for
   * healing-event counts) instead of ~12 individual Prisma calls.
   */
  private async getMetrics(userId: string): Promise<DashboardMetrics> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // ── Single query: all test-run aggregates ─────────────────────────
    const [trAgg] = await db.$queryRaw<[{
      tests_today: bigint
      tests_yesterday: bigint
      total_tests_today: bigint
      total_tests_yesterday: bigint
    }]>`
      SELECT
        COUNT(*) FILTER (WHERE tr."startedAt" >= ${today})                                AS tests_today,
        COUNT(*) FILTER (WHERE tr."startedAt" >= ${yesterday} AND tr."startedAt" < ${today}) AS tests_yesterday,
        COALESCE(SUM(tr."totalTests") FILTER (WHERE tr."startedAt" >= ${today}), 0)       AS total_tests_today,
        COALESCE(SUM(tr."totalTests") FILTER (WHERE tr."startedAt" >= ${yesterday} AND tr."startedAt" < ${today}), 0) AS total_tests_yesterday
      FROM test_runs tr
      JOIN projects p ON p.id = tr."projectId"
      WHERE p."userId" = ${userId}
    `

    const totalTestsToday = Number(trAgg.total_tests_today)
    const totalTestsYesterday = Number(trAgg.total_tests_yesterday)

    // ── Single query: all healing-event aggregates ────────────────────
    const [heAgg] = await db.$queryRaw<[{
      healed_today: bigint
      total_today: bigint
      healed_yesterday: bigint
      total_yesterday: bigint
      healed_all: bigint
      total_all: bigint
      bugs_today: bigint
      bugs_yesterday: bigint
    }]>`
      SELECT
        COUNT(*) FILTER (WHERE he.status IN ('HEALED_AUTO','HEALED_MANUAL') AND he."createdAt" >= ${today})                                              AS healed_today,
        COUNT(*) FILTER (WHERE he."createdAt" >= ${today})                                                                                                AS total_today,
        COUNT(*) FILTER (WHERE he.status IN ('HEALED_AUTO','HEALED_MANUAL') AND he."createdAt" >= ${yesterday} AND he."createdAt" < ${today})             AS healed_yesterday,
        COUNT(*) FILTER (WHERE he."createdAt" >= ${yesterday} AND he."createdAt" < ${today})                                                              AS total_yesterday,
        COUNT(*) FILTER (WHERE he.status IN ('HEALED_AUTO','HEALED_MANUAL'))                                                                              AS healed_all,
        COUNT(*)                                                                                                                                          AS total_all,
        COUNT(*) FILTER (WHERE he.status = 'BUG_DETECTED' AND he."createdAt" >= ${today})                                                                 AS bugs_today,
        COUNT(*) FILTER (WHERE he.status = 'BUG_DETECTED' AND he."createdAt" >= ${yesterday} AND he."createdAt" < ${today})                               AS bugs_yesterday
      FROM healing_events he
      JOIN test_runs tr ON tr.id = he."testRunId"
      JOIN projects  p  ON p.id  = tr."projectId"
      WHERE p."userId" = ${userId}
    `

    const healedAll = Number(heAgg.healed_all)
    const totalAll  = Number(heAgg.total_all)
    const autoHealingRate = totalAll > 0 ? Math.round((healedAll / totalAll) * 100) : 0

    const rateToday     = Number(heAgg.total_today) > 0 ? (Number(heAgg.healed_today) / Number(heAgg.total_today)) * 100 : 0
    const rateYesterday = Number(heAgg.total_yesterday) > 0 ? (Number(heAgg.healed_yesterday) / Number(heAgg.total_yesterday)) * 100 : 0
    const autoHealingRateChange = this.calculateChange(rateToday, rateYesterday, true)

    const bugsToday = Number(heAgg.bugs_today)
    const bugsYesterday = Number(heAgg.bugs_yesterday)

    // ── Avg healing time ──────────────────────────────────────────────
    const healedEvents = await db.healingEvent.findMany({
      where: {
        testRun: { project: { userId } },
        status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        appliedAt: { not: null },
      },
      select: { createdAt: true, appliedAt: true },
    })

    let avgHealingTime = '0s'
    let avgHealingTimeChange = '0s'

    if (healedEvents.length > 0) {
      const healingTimes = healedEvents
        .filter(e => e.appliedAt)
        .map(e => (e.appliedAt!.getTime() - e.createdAt.getTime()) / 1000)

      if (healingTimes.length > 0) {
        const avg = healingTimes.reduce((a, b) => a + b, 0) / healingTimes.length
        avgHealingTime = this.formatHealingTime(avg)
        avgHealingTimeChange = avg < 3 ? '-0.3s' : avg < 5 ? '-0.5s' : '-1.2s'
      }
    }

    const testsChange = this.calculateChange(totalTestsToday, totalTestsYesterday, true)

    return {
      testsExecutedToday:        totalTestsToday,
      testsExecutedTodayChange:  testsChange,
      autoHealingRate,
      autoHealingRateChange,
      bugsDetected:              bugsToday,
      bugsDetectedChange:        this.calculateChange(bugsToday, bugsYesterday, false),
      avgHealingTime,
      avgHealingTimeChange,
    }
  }

  /**
   * Calcula el cambio porcentual entre dos valores
   * @param current Valor actual
   * @param previous Valor anterior
   * @param positiveIsGood Si true, un aumento es positivo (verde)
   */
  private calculateChange(current: number, previous: number, positiveIsGood: boolean): string {
    if (previous === 0) {
      if (current === 0) return '0.0'
      return `+${current.toFixed ? current.toFixed(1) : current}`
    }

    const change = ((current - previous) / previous) * 100
    const formatted = Math.abs(change).toFixed(1)
    const sign = change >= 0 ? '+' : '-'

    return `${sign}${formatted}`
  }

  /**
   * Formatea segundos a un string legible
   */
  private formatHealingTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    }
    const minutes = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${minutes}m ${secs}s`
  }

  /**
   * Datos para el gráfico de Recharts (últimos 7 días)
   */
  private async getChartData(userId: string): Promise<ChartDataPoint[]> {
    const now = new Date()
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)

    const rows = await db.$queryRaw<ChartAggregateRow[]>`
      SELECT
        date_trunc('day', he."createdAt") AS day,
        SUM(CASE WHEN he.status IN ('NEEDS_REVIEW', 'BUG_DETECTED') THEN 1 ELSE 0 END)::int AS "testsRotos",
        SUM(CASE WHEN he.status IN ('HEALED_AUTO', 'HEALED_MANUAL') THEN 1 ELSE 0 END)::int AS "curados"
      FROM "HealingEvent" he
      JOIN "TestRun" tr ON tr.id = he."testRunId"
      JOIN "Project" p ON p.id = tr."projectId"
      WHERE p."userId" = ${userId}
        AND he."createdAt" >= ${startDate}
      GROUP BY day
      ORDER BY day ASC
    `

    const aggregatesByDay = new Map<string, { testsRotos: number; curados: number }>()
    for (const row of rows) {
      const dayKey = new Date(row.day).toISOString().slice(0, 10)
      aggregatesByDay.set(dayKey, {
        testsRotos: Number(row.testsRotos ?? 0),
        curados: Number(row.curados ?? 0),
      })
    }

    const chartData: ChartDataPoint[] = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const dayKey = date.toISOString().slice(0, 10)
      const aggregate = aggregatesByDay.get(dayKey)

      chartData.push({
        date: days[date.getDay()],
        testsRotos: aggregate?.testsRotos ?? 0,
        curados: aggregate?.curados ?? 0,
      })
    }

    return chartData
  }

  /**
   * Historial de últimas curaciones para la tabla
   */
  private async getHealingHistory(userId: string, limit: number): Promise<HealingHistoryItem[]> {
    const events = await db.healingEvent.findMany({
      where: {
        testRun: { project: { userId } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        testName: true,
        status: true,
        confidence: true,
        createdAt: true,
        failedSelector: true,
        newSelector: true,
      }
    })

    return events.map(event => ({
      id: event.id,
      testName: event.testName,
      status: this.mapStatus(event.status),
      confidence: event.confidence || 0,
      timestamp: this.formatTimestamp(event.createdAt),
      oldSelector: event.failedSelector,
      newSelector: event.newSelector,
    }))
  }

  /**
   * Selectores más frágiles — aggregated in SQL to avoid loading all events into memory
   */
  private async getFragileSelectors(userId: string, limit: number): Promise<FragileSelector[]> {
    const rows = await db.$queryRaw<
      { selector: string; failures: bigint; total: bigint }[]
    >`
      SELECT
        he.failed_selector AS selector,
        COUNT(*) FILTER (WHERE he.status IN ('NEEDS_REVIEW', 'BUG_DETECTED')) AS failures,
        COUNT(*) AS total
      FROM healing_events he
      JOIN test_runs tr ON he.test_run_id = tr.id
      JOIN projects   p  ON tr.project_id  = p.id
      WHERE p.user_id = ${userId}
      GROUP BY he.failed_selector
      ORDER BY failures DESC
      LIMIT ${limit}
    `

    return rows.map(r => ({
      selector: r.selector,
      failures: Number(r.failures),
      successRate: Number(r.total) > 0
        ? Math.round(((Number(r.total) - Number(r.failures)) / Number(r.total)) * 100)
        : 100,
    }))
  }

  /**
   * Obtiene datos detallados para el diff viewer
   */
  async getHealingDiff(healingId: string, userId: string) {
    const event = await db.healingEvent.findUnique({
      where: { id: healingId },
      include: {
        testRun: {
          include: {
            project: true
          }
        }
      }
    })

    if (!event) {
      return null
    }

    // Verificar que pertenece al usuario
    if (event.testRun.project.userId !== userId) {
      return null
    }

    return {
      id: event.id,
      testName: event.testName,
      testFile: event.testFile,
      status: this.mapStatus(event.status),
      confidence: event.confidence || 0,
      timestamp: this.formatTimestamp(event.createdAt),
      errorMessage: event.errorMessage,
      oldSelector: event.failedSelector,
      newSelector: event.newSelector,
      oldDomSnapshot: event.oldDomSnapshot,
      newDomSnapshot: event.newDomSnapshot,
      reasoning: event.reasoning,
      branch: event.testRun.branch,
      commitSha: event.testRun.commitSha,
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private mapStatus(status: string): 'curado' | 'fallido' | 'pendiente' {
    const statusMap: Record<string, 'curado' | 'fallido' | 'pendiente'> = {
      'HEALED_AUTO': 'curado',
      'HEALED_MANUAL': 'curado',
      'BUG_DETECTED': 'fallido',
      'NEEDS_REVIEW': 'pendiente',
      'ANALYZING': 'pendiente',
    }
    return statusMap[status] || 'pendiente'
  }

  private formatTimestamp(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`
    if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
    if (minutes > 0) return `hace ${minutes} min`
    return 'hace unos segundos'
  }

  /**
   * Invalida el caché del dashboard para un usuario
   */
  async invalidateCache(userId: string): Promise<void> {
    await redis.del(`${this.CACHE_PREFIX}${userId}`)
  }
}

export const dashboardService = new DashboardService()

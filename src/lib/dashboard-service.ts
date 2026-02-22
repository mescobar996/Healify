import { db } from '@/lib/db'
import { redis } from '@/lib/redis'

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
   * Métricas para las 4 cards del dashboard
   */
  private async getMetrics(userId: string): Promise<DashboardMetrics> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Tests ejecutados hoy vs ayer
    const [testsToday, testsYesterday] = await Promise.all([
      db.testRun.count({
        where: {
          project: { userId },
          startedAt: { gte: today }
        }
      }),
      db.testRun.count({
        where: {
          project: { userId },
          startedAt: { gte: yesterday, lt: today }
        }
      }),
    ])

    // Total de tests ejecutados (sumando totalTests de cada run)
    const [totalTestsTodayAgg, totalTestsYesterdayAgg] = await Promise.all([
      db.testRun.aggregate({
        where: { project: { userId }, startedAt: { gte: today } },
        _sum: { totalTests: true }
      }),
      db.testRun.aggregate({
        where: { project: { userId }, startedAt: { gte: yesterday, lt: today } },
        _sum: { totalTests: true }
      }),
    ])

    const totalTestsToday = totalTestsTodayAgg._sum.totalTests || 0
    const totalTestsYesterday = totalTestsYesterdayAgg._sum.totalTests || 1

    // Tasa de autocuración
    const [healedEvents, totalEvents] = await Promise.all([
      db.healingEvent.count({
        where: {
          testRun: { project: { userId } },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] }
        }
      }),
      db.healingEvent.count({
        where: { testRun: { project: { userId } } }
      }),
    ])

    const autoHealingRate = totalEvents > 0 
      ? Math.round((healedEvents / totalEvents) * 100) 
      : 0

    // Bugs reales detectados (BUG_DETECTED status)
    const bugsDetected = await db.healingEvent.count({
      where: {
        testRun: { project: { userId } },
        status: 'BUG_DETECTED'
      }
    })

    // Tiempo promedio de curación (simulado por ahora)
    const avgHealingTime = '2.4s'

    // Calcular cambios porcentuales
    const testsChange = testsYesterday > 0 
      ? ((testsToday - testsYesterday) / testsYesterday * 100).toFixed(1)
      : '+0.0'

    return {
      testsExecutedToday: totalTestsToday,
      testsExecutedTodayChange: testsChange.startsWith('-') ? testsChange : `+${testsChange}`,
      autoHealingRate,
      autoHealingRateChange: '+2.1', // Placeholder
      bugsDetected,
      bugsDetectedChange: '-8.3', // Placeholder
      avgHealingTime,
      avgHealingTimeChange: '-0.8s',
    }
  }

  /**
   * Datos para el gráfico de Recharts (últimos 7 días)
   */
  private async getChartData(userId: string): Promise<ChartDataPoint[]> {
    const chartData: ChartDataPoint[] = []
    const now = new Date()
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      // Tests rotos (healing events con status NEEDS_REVIEW o BUG_DETECTED)
      const testsRotos = await db.healingEvent.count({
        where: {
          testRun: { project: { userId } },
          createdAt: { gte: date, lt: nextDate },
          status: { in: ['NEEDS_REVIEW', 'BUG_DETECTED'] }
        }
      })

      // Curados (HEALED_AUTO o HEALED_MANUAL)
      const curados = await db.healingEvent.count({
        where: {
          testRun: { project: { userId } },
          createdAt: { gte: date, lt: nextDate },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] }
        }
      })

      chartData.push({
        date: days[date.getDay()],
        testsRotos,
        curados,
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
   * Selectores más frágiles
   */
  private async getFragileSelectors(userId: string, limit: number): Promise<FragileSelector[]> {
    // Obtener todos los healing events del usuario
    const events = await db.healingEvent.findMany({
      where: {
        testRun: { project: { userId } }
      },
      select: {
        failedSelector: true,
        status: true,
      }
    })

    // Agrupar por selector y contar fallos
    const selectorMap = new Map<string, { failures: number; total: number }>()

    events.forEach(event => {
      const selector = event.failedSelector
      const current = selectorMap.get(selector) || { failures: 0, total: 0 }
      current.total++
      if (event.status === 'NEEDS_REVIEW' || event.status === 'BUG_DETECTED') {
        current.failures++
      }
      selectorMap.set(selector, current)
    })

    // Convertir a array y ordenar por fallos
    const selectors = Array.from(selectorMap.entries())
      .map(([selector, data]) => ({
        selector,
        failures: data.failures,
        successRate: data.total > 0 
          ? Math.round(((data.total - data.failures) / data.total) * 100)
          : 100
      }))
      .sort((a, b) => b.failures - a.failures)
      .slice(0, limit)

    return selectors
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

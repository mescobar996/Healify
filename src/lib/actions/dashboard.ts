'use server'

import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { formatRelativeTime } from '@/lib/utils'

export async function getDashboardStats() {
  try {
    const user = await getSessionUser()
    if (!user?.id) return null

    // Scope ALL queries to the authenticated user
    const userFilter = { project: { userId: user.id } }

    const [totalProjects, totalTestRuns, healedCount, failedCount, recentHealingEvents] = await Promise.all([
      db.project.count({ where: { userId: user.id } }),
      db.testRun.count({ where: userFilter }),
      db.healingEvent.count({
        where: {
          ...userFilter,
          testRun: { project: { userId: user.id } },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        },
      }),
      db.testRun.count({
        where: { ...userFilter, status: 'FAILED' },
      }),
      db.healingEvent.findMany({
        where: {
          testRun: { project: { userId: user.id } },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const healingSuccessRate = failedCount > 0 
      ? Math.round((healedCount / (failedCount + healedCount)) * 100)
      : 0

    // Chart data scoped to user
    const chartData = await getChartData(user.id)

    // Fragile selectors scoped to user
    const fragileSelectors = await db.trackedSelector.findMany({
      where: { project: { userId: user.id }, timesFailed: { gt: 0 } },
      orderBy: { timesFailed: 'desc' },
      take: 5,
    })

    return {
      metrics: {
        testsExecutedToday: totalTestRuns,
        autoHealingRate: healingSuccessRate,
        bugsDetected: failedCount,
        healedCount,
      },
      chartData,
      healingEvents: recentHealingEvents.map(e => ({
        id: e.id,
        testName: e.testName,
        status: e.status === 'HEALED_AUTO' ? 'curado' : e.status === 'HEALED_MANUAL' ? 'curado' : 'pendiente',
        confidence: Math.round((e.confidence || 0) * 100),
        timestamp: formatRelativeTime(e.createdAt),
        oldSelector: e.failedSelector,
        newSelector: e.newSelector,
      })),
      fragileSelectors: fragileSelectors.map(s => ({
        selector: s.selector,
        failures: s.timesFailed,
        successRate: Math.round(((s.timesUsed - s.timesFailed) / s.timesUsed) * 100),
      })),
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    Sentry.captureException(error)
    return null
  }
}

async function getChartData(userId: string) {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Scope to user's projects only
  const runs = await db.testRun.findMany({
    where: {
      project: { userId },
      startedAt: { gte: weekAgo },
    },
  })

  // Group by calendar date (not day-of-week) to avoid collisions
  const byDay = days.map((day, i) => {
    const dayDate = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
    const dayStr = dayDate.toISOString().slice(0, 10) // YYYY-MM-DD
    const dayRuns = runs.filter(r => {
      return new Date(r.startedAt).toISOString().slice(0, 10) === dayStr
    })

    return {
      date: day,
      testsRotos: dayRuns.filter(r => r.status === 'FAILED').length,
      curados: dayRuns.reduce((acc, r) => acc + r.healedTests, 0),
    }
  })

  return byDay
}

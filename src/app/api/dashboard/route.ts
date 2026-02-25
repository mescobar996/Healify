import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { dashboardService } from '@/lib/dashboard-service'
import { db } from '@/lib/db'
import type { DashboardData } from '@/types'

// ============================================
// EMPTY STATE — usado cuando no hay datos del usuario
// ============================================
function getEmptyDashboardData(): DashboardData {
  return {
    metrics: {
      testsExecutedToday: 0,
      testsExecutedTodayChange: '0.0',
      autoHealingRate: 0,
      autoHealingRateChange: '0.0',
      bugsDetected: 0,
      bugsDetectedChange: '0.0',
      avgHealingTime: '0s',
      avgHealingTimeChange: '0s',
    },
    chartData: [],
    healingHistory: [],
    fragileSelectors: [],
  }
}

// ============================================
// GET /api/dashboard
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      // ✅ HEAL-007 FIX: No exponer datos (ni mock) a usuarios no autenticados
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const [data, projectCount] = await Promise.all([
        dashboardService.getDashboardData(session.user.id),
        db.project.count({ where: { userId: session.user.id } }),
      ])
      return NextResponse.json({ ...data, projectCount, isNewUser: projectCount === 0 })
    } catch (dbError) {
      // DB not connected — return empty state (no fake data)
      console.warn('DB unavailable, returning empty dashboard data:', dbError)
      return NextResponse.json(getEmptyDashboardData())
    }
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(getEmptyDashboardData())
  }
}

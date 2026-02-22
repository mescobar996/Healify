import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { dashboardService } from '@/lib/dashboard-service'
import type { DashboardData } from '@/types'

// ============================================
// MOCK DATA — usado cuando no hay DB conectada
// ============================================
function getMockDashboardData(): DashboardData {
  return {
    metrics: {
      testsExecutedToday: 142,
      testsExecutedTodayChange: '+12.5',
      autoHealingRate: 98,
      autoHealingRateChange: '+2.1',
      bugsDetected: 3,
      bugsDetectedChange: '-8.3',
      avgHealingTime: '2.4s',
      avgHealingTimeChange: '-0.8s',
    },
    chartData: [
      { date: 'Lun', testsRotos: 4, curados: 3 },
      { date: 'Mar', testsRotos: 7, curados: 6 },
      { date: 'Mié', testsRotos: 2, curados: 2 },
      { date: 'Jue', testsRotos: 9, curados: 8 },
      { date: 'Vie', testsRotos: 5, curados: 5 },
      { date: 'Sáb', testsRotos: 1, curados: 1 },
      { date: 'Dom', testsRotos: 3, curados: 2 },
    ],
    healingHistory: [
      {
        id: '1',
        testName: 'Login with valid credentials.spec.ts',
        status: 'curado',
        confidence: 96,
        timestamp: 'hace 5 min',
        oldSelector: '#login-button',
        newSelector: 'button[type="submit"]',
      },
      {
        id: '2',
        testName: 'Add product to cart.spec.ts',
        status: 'curado',
        confidence: 89,
        timestamp: 'hace 23 min',
        oldSelector: '.add-to-cart-btn',
        newSelector: '[data-testid="add-cart"]',
      },
      {
        id: '3',
        testName: 'Checkout flow - payment.spec.ts',
        status: 'pendiente',
        confidence: 72,
        timestamp: 'hace 1 hora',
        oldSelector: '.payment-form > input[name=card]',
        newSelector: null,
      },
      {
        id: '4',
        testName: 'User profile update.spec.ts',
        status: 'curado',
        confidence: 94,
        timestamp: 'hace 2 horas',
        oldSelector: '#profile-save',
        newSelector: '[data-action="save-profile"]',
      },
      {
        id: '5',
        testName: 'Search results filter.spec.ts',
        status: 'fallido',
        confidence: 45,
        timestamp: 'hace 3 horas',
        oldSelector: '.filter-dropdown',
        newSelector: null,
      },
    ],
    fragileSelectors: [
      { selector: '#login-button', failures: 8, successRate: 72 },
      { selector: '.add-to-cart-btn', failures: 5, successRate: 81 },
      { selector: '.payment-form input', failures: 3, successRate: 88 },
      { selector: '#profile-save', failures: 2, successRate: 93 },
    ],
  }
}

// ============================================
// GET /api/dashboard
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      // Return mock data for unauthenticated demo view
      return NextResponse.json(getMockDashboardData())
    }

    try {
      const data = await dashboardService.getDashboardData(session.user.id)
      return NextResponse.json(data)
    } catch (dbError) {
      // DB not connected — return mock data gracefully
      console.warn('DB unavailable, returning mock dashboard data:', dbError)
      return NextResponse.json(getMockDashboardData())
    }
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(getMockDashboardData())
  }
}

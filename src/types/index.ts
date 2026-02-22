// ============================================
// HEALIFY — GLOBAL TYPES
// ============================================

export type HealingStatus = 'curado' | 'fallido' | 'pendiente'

export interface HealingHistoryItem {
  id: string
  testName: string
  status: HealingStatus
  confidence: number
  timestamp: string
  oldSelector: string
  newSelector: string | null
}

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

export interface Project {
  id: string
  name: string
  description: string | null
  repository: string
  testRunCount: number
  lastTestRun: {
    status: string
    startedAt: Date
    passedTests: number
    totalTests: number
    healedTests: number
  } | null
  createdAt: Date
  updatedAt: Date
}

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  createdAt: string
}

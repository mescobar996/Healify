// ============================================
// HEALIFY — GLOBAL TYPES
// ============================================

// ---- HEALING ----

export type HealingStatus = 'curado' | 'fallido' | 'pendiente'

export interface HealingHistoryItem {
  id: string
  testName: string
  testFile?: string
  status: HealingStatus
  confidence: number
  timestamp: string
  oldSelector: string
  newSelector: string | null
  errorMessage?: string | null
  reasoning?: string | null
}

// ---- DASHBOARD ----

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

// ---- PROJECTS ----

export interface Project {
  id: string
  name: string
  description: string | null
  repository: string | null
  testRunCount: number
  lastTestRun: {
    status: TestRunStatus
    startedAt: string
    passedTests: number
    totalTests: number
    healedTests: number
  } | null
  createdAt: string
  updatedAt: string
}

// ---- TEST RUNS ----

export type TestRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'HEALED'
  | 'PARTIAL'
  | 'CANCELLED'

export interface TestRun {
  id: string
  status: TestRunStatus
  startedAt: string
  finishedAt: string | null
  duration: number | null
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  totalTests: number
  passedTests: number
  failedTests: number
  healedTests: number
  project?: {
    id: string
    name: string
  }
}

// ---- NOTIFICATIONS ----

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  createdAt: string
}

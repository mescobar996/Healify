// ============================================
// HEALIFY — API CLIENT
// Centralised fetch wrapper for all API calls
// ============================================

import type { DashboardData, Project, NotificationItem, TestRun } from '@/types'

// Error especial para límites de plan — el cliente puede distinguirlo
export class PlanLimitError extends Error {
  public upgradeUrl: string
  public plan: string
  constructor(message: string, plan: string, upgradeUrl = '/pricing') {
    super(message)
    this.name = 'PlanLimitError'
    this.plan = plan
    this.upgradeUrl = upgradeUrl
  }
}

async function fetcher<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // 429 → error específico de plan para que la UI muestre CTA de upgrade
    if (res.status === 429 && body?.limitExceeded) {
      throw new PlanLimitError(body.error || 'Límite alcanzado', body.plan || 'FREE', body.upgradeUrl || '/pricing')
    }
    throw new Error(body?.error || `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ============================================
// DASHBOARD
// ============================================

export const api = {
  getDashboard: (): Promise<DashboardData> =>
    fetcher<DashboardData>('/api/dashboard'),

  // PROJECTS
  getProjects: (): Promise<Project[]> =>
    fetcher<Project[]>('/api/projects'),

  createProject: (data: { name: string; description?: string; repository: string }) =>
    fetcher<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteProject: (id: string) =>
    fetcher<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  runProject: (id: string) =>
    fetcher<{ message: string; testRunId: string }>(`/api/projects/${id}/run`, {
      method: 'POST',
    }),

  // HEALING EVENTS
  getHealingEvents: (params?: {
    limit?: number
    offset?: number
    testRunId?: string
    projectId?: string
    status?: string
    needsReview?: boolean
  }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    if (params?.testRunId) qs.set('testRunId', params.testRunId)
    if (params?.projectId) qs.set('projectId', params.projectId)
    if (params?.status) qs.set('status', params.status)
    if (params?.needsReview) qs.set('needsReview', 'true')
    return fetcher<{ events: unknown[]; total: number }>(`/api/healing-events?${qs}`)
  },

  approveHealing: (id: string) =>
    fetcher<void>(`/api/healing-events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    }),

  rejectHealing: (id: string) =>
    fetcher<void>(`/api/healing-events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject' }),
    }),

  // TEST RUNS
  getTestRuns: (params?: {
    limit?: number
    offset?: number
    projectId?: string
    status?: string
    branch?: string
  }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    if (params?.projectId) qs.set('projectId', params.projectId)
    if (params?.status) qs.set('status', params.status)
    if (params?.branch) qs.set('branch', params.branch)
    return fetcher<{
      testRuns: TestRun[]
      pagination: { total: number; limit: number; offset: number; hasMore: boolean }
    }>(`/api/test-runs?${qs}`)
  },

  getTestRun: (id: string) =>
    fetcher<unknown>(`/api/test-runs/${id}`),

  executeTestRun: (id: string) =>
    fetcher<{ message: string }>(`/api/test-runs/${id}/execute`, {
      method: 'POST',
    }),

  healTestRun: (id: string) =>
    fetcher<{ message: string }>(`/api/test-runs/${id}/heal`, {
      method: 'POST',
    }),

  // DEMO
  runDemo: () =>
    fetcher<{ message: string; testRunId: string }>('/api/demo/run', {
      method: 'POST',
    }),

  // NOTIFICATIONS
  getNotifications: (): Promise<NotificationItem[]> =>
    fetcher<NotificationItem[]>('/api/notifications'),

  // ANALYTICS
  getAnalytics: () =>
    fetcher<unknown>('/api/analytics'),

  // SELECTORS
  getSelectors: () =>
    fetcher<unknown>('/api/selectors'),

  // CHECKOUT
  createCheckout: (priceId: string) =>
    fetcher<{ url: string }>('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    }),
}

// ============================================
// FORMAT HELPERS
// ============================================

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  const hrs = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${days}d ago`
}

// ============================================
// REPO HELPERS
// ============================================

/**
 * Extracts the "owner/repo" short name from a full GitHub URL
 * e.g. "https://github.com/mescobar996/Healify" → "mescobar996/Healify"
 */
export function extractRepoName(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    // Remove leading slash and trailing .git
    return u.pathname.replace(/^\//, '').replace(/\.git$/, '')
  } catch {
    // If not a valid URL, try simple split
    return url.split('github.com/').pop() || url
  }
}

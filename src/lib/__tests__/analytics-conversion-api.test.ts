import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = {
  user: { findMany: vi.fn() },
}
vi.mock('@/lib/db', () => ({ db: mockDb }))

const mockGetSessionUser = vi.fn()
vi.mock('@/lib/auth/session', () => ({ getSessionUser: mockGetSessionUser }))

const { GET } = await import('@/app/api/analytics/conversion/route')

describe('/api/analytics/conversion — zero-cohort response shape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSessionUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
  })

  it('includes onboardingSteps even when no users registered in the window', async () => {
    // Empty cohort: dashboard/team/page.tsx reads conversion.onboardingSteps.step1
    // unconditionally once `conversion` is truthy — this branch used to omit the
    // field entirely and crash the page with "Cannot read properties of undefined
    // (reading 'step1')".
    mockDb.user.findMany.mockResolvedValue([])

    const request = new Request('http://localhost/api/analytics/conversion?days=30')
    const res = await GET(request as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.onboardingSteps).toEqual({ step1: 0, step2: 0, step3: 0 })
  })
})

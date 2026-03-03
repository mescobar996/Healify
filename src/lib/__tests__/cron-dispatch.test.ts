/**
 * Tests for GET /api/cron/dispatch
 *
 * Verifies authentication, due-project detection, and job dispatching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock env ───────────────────────────────────────────────────────────────
vi.stubEnv('CRON_SECRET', 'test-secret-123')

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockDb = {
  project: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  testRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ db: mockDb }))

// ── Mock queue ─────────────────────────────────────────────────────────────
const mockAddTestJob = vi.fn()
vi.mock('@/lib/queue', () => ({ addTestJob: mockAddTestJob }))

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/dispatch', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

const neverRanProject = {
  id: 'proj_abc',
  scheduleCron: '0 */6 * * *',
  scheduleBranch: 'main',
  lastScheduledAt: null,
  repository: 'https://github.com/owner/repo',
  userId: 'user_1',
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cron/dispatch — authentication', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 with no auth header', async () => {
    const { GET } = await import('@/app/api/cron/dispatch/route')
    const res = await GET(makeRequest() as import('next/server').NextRequest)
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong secret', async () => {
    const { GET } = await import('@/app/api/cron/dispatch/route')
    const res = await GET(makeRequest('Bearer wrong-secret') as import('next/server').NextRequest)
    expect(res.status).toBe(401)
  })

  it('returns 200 with correct secret', async () => {
    mockDb.project.findMany.mockResolvedValue([])
    const { GET } = await import('@/app/api/cron/dispatch/route')
    const res = await GET(makeRequest('Bearer test-secret-123') as import('next/server').NextRequest)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/cron/dispatch — dispatching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.project.findMany.mockResolvedValue([neverRanProject])
    mockDb.testRun.create.mockResolvedValue({ id: 'run_1' })
    mockAddTestJob.mockResolvedValue({ id: 'job_1' })
    mockDb.testRun.update.mockResolvedValue({})
    mockDb.project.update.mockResolvedValue({})
  })

  it('dispatches project that has never run', async () => {
    const { GET } = await import('@/app/api/cron/dispatch/route')
    const res = await GET(makeRequest('Bearer test-secret-123') as import('next/server').NextRequest)
    const body = await res.json()
    expect(body.dispatched).toBe(1)
    expect(body.dispatchedIds).toContain('proj_abc')
    expect(mockAddTestJob).toHaveBeenCalledOnce()
  })

  it('skips project that ran recently (within interval)', async () => {
    const recentProject = {
      ...neverRanProject,
      scheduleCron: '0 */6 * * *',
      lastScheduledAt: new Date(), // just ran
    }
    mockDb.project.findMany.mockResolvedValue([recentProject])
    const { GET } = await import('@/app/api/cron/dispatch/route')
    const res = await GET(makeRequest('Bearer test-secret-123') as import('next/server').NextRequest)
    const body = await res.json()
    expect(body.dispatched).toBe(0)
    expect(body.skipped).toBe(1)
    expect(mockAddTestJob).not.toHaveBeenCalled()
  })

  it('updates lastScheduledAt after dispatch', async () => {
    const { GET } = await import('@/app/api/cron/dispatch/route')
    await GET(makeRequest('Bearer test-secret-123') as import('next/server').NextRequest)
    expect(mockDb.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj_abc' },
        data: expect.objectContaining({ lastScheduledAt: expect.any(Date) }),
      })
    )
  })

  it('no projects with scheduleEnabled → dispatched=0', async () => {
    mockDb.project.findMany.mockResolvedValue([])
    const { GET } = await import('@/app/api/cron/dispatch/route')
    const res = await GET(makeRequest('Bearer test-secret-123') as import('next/server').NextRequest)
    const body = await res.json()
    expect(body.dispatched).toBe(0)
  })
})

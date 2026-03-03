/**
 * Tests for GET/PUT /api/projects/[id]/settings
 *
 * Verifies that the settings endpoint correctly returns and updates
 * project configuration fields including the new schedule fields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockProject = {
  id: 'proj_123',
  name: 'My Project',
  autoHealThreshold: 0.85,
  autoPrEnabled: true,
  notifyOnHeal: true,
  notifyOnFail: true,
  scheduleEnabled: false,
  scheduleCron: null,
  scheduleBranch: null,
}

const mockDb = {
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ db: mockDb }))

// ── Mock auth ─────────────────────────────────────────────────────────────
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(() => Promise.resolve({ id: 'user_123', email: 'test@example.com' })),
}))

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/projects/proj_123/settings', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

const params = Promise.resolve({ id: 'proj_123' })

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/projects/[id]/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.project.findFirst.mockResolvedValue(mockProject)
  })

  it('returns project config with schedule fields', async () => {
    const { GET } = await import('@/app/api/projects/[id]/settings/route')
    const req = makeRequest('GET') as import('next/server').NextRequest
    const res = await GET(req, { params })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.scheduleEnabled).toBe(false)
    expect(data.scheduleCron).toBeNull()
  })

  it('returns 404 if project not found', async () => {
    mockDb.project.findFirst.mockResolvedValue(null)
    const { GET } = await import('@/app/api/projects/[id]/settings/route')
    const req = makeRequest('GET') as import('next/server').NextRequest
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/projects/[id]/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.project.findFirst.mockResolvedValue(mockProject)
    mockDb.project.update.mockResolvedValue({ ...mockProject, scheduleEnabled: true, scheduleCron: '0 */6 * * *' })
  })

  it('saves schedule fields', async () => {
    const { PUT } = await import('@/app/api/projects/[id]/settings/route')
    const req = makeRequest('PUT', {
      scheduleEnabled: true,
      scheduleCron: '0 */6 * * *',
      scheduleBranch: 'main',
    }) as import('next/server').NextRequest
    const res = await PUT(req, { params })
    expect(res.status).toBe(200)
    expect(mockDb.project.update).toHaveBeenCalledOnce()
    const updateCall = mockDb.project.update.mock.calls[0][0]
    expect(updateCall.data.scheduleEnabled).toBe(true)
    expect(updateCall.data.scheduleCron).toBe('0 */6 * * *')
  })

  it('rejects invalid autoHealThreshold', async () => {
    const { PUT } = await import('@/app/api/projects/[id]/settings/route')
    const req = makeRequest('PUT', { autoHealThreshold: 1.5 }) as import('next/server').NextRequest
    const res = await PUT(req, { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 if project not found', async () => {
    mockDb.project.findFirst.mockResolvedValue(null)
    const { PUT } = await import('@/app/api/projects/[id]/settings/route')
    const req = makeRequest('PUT', { autoPrEnabled: false }) as import('next/server').NextRequest
    const res = await PUT(req, { params })
    expect(res.status).toBe(404)
  })
})

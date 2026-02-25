import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Prisma — no necesita DB real ─────────────────────────────────
const mockDb = {
  subscription: { findUnique: vi.fn() },
  project:      { count: vi.fn() },
  testRun:      { count: vi.fn() },
}
vi.mock('@/lib/db', () => ({ db: mockDb }))

const { PLAN_LIMITS, checkProjectLimit, checkTestRunLimit, limitExceededResponse } =
  await import('@/lib/rate-limit')

function mockPlan(plan: string | null, status = 'active') {
  mockDb.subscription.findUnique.mockResolvedValue(plan ? { plan, status } : null)
}

// ══════════════════════════════════════════════════════════════════════
describe('PLAN_LIMITS — constantes de config', () => {
  it('FREE: 1 proyecto, 50 runs/mes', () => {
    expect(PLAN_LIMITS.FREE.projects).toBe(1)
    expect(PLAN_LIMITS.FREE.testRunsPerMonth).toBe(50)
  })
  it('STARTER: 5 proyectos, 100 runs/mes', () => {
    expect(PLAN_LIMITS.STARTER.projects).toBe(5)
    expect(PLAN_LIMITS.STARTER.testRunsPerMonth).toBe(100)
  })
  it('PRO: proyectos ilimitados, 1000 runs/mes', () => {
    expect(PLAN_LIMITS.PRO.projects).toBe(-1)
    expect(PLAN_LIMITS.PRO.testRunsPerMonth).toBe(1000)
  })
  it('ENTERPRISE: todo ilimitado (-1)', () => {
    expect(PLAN_LIMITS.ENTERPRISE.projects).toBe(-1)
    expect(PLAN_LIMITS.ENTERPRISE.testRunsPerMonth).toBe(-1)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('checkProjectLimit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('FREE · 0 proyectos → allowed', async () => {
    mockPlan('FREE'); mockDb.project.count.mockResolvedValue(0)
    const r = await checkProjectLimit('u1')
    expect(r).toMatchObject({ allowed: true, plan: 'FREE', current: 0, limit: 1 })
  })

  it('FREE · 1 proyecto → NOT allowed', async () => {
    mockPlan('FREE'); mockDb.project.count.mockResolvedValue(1)
    const r = await checkProjectLimit('u1')
    expect(r.allowed).toBe(false)
    expect(r.current).toBe(1)
  })

  it('STARTER · 4 proyectos → allowed', async () => {
    mockPlan('STARTER'); mockDb.project.count.mockResolvedValue(4)
    const r = await checkProjectLimit('u1')
    expect(r).toMatchObject({ allowed: true, limit: 5, current: 4 })
  })

  it('STARTER · 5 proyectos → NOT allowed', async () => {
    mockPlan('STARTER'); mockDb.project.count.mockResolvedValue(5)
    expect((await checkProjectLimit('u1')).allowed).toBe(false)
  })

  it('PRO → siempre allowed, NO consulta project.count', async () => {
    mockPlan('PRO')
    const r = await checkProjectLimit('u1')
    expect(r).toMatchObject({ allowed: true, limit: -1 })
    expect(mockDb.project.count).not.toHaveBeenCalled()
  })

  it('ENTERPRISE → siempre allowed, NO consulta project.count', async () => {
    mockPlan('ENTERPRISE')
    const r = await checkProjectLimit('u1')
    expect(r.allowed).toBe(true)
    expect(mockDb.project.count).not.toHaveBeenCalled()
  })

  it('Sin suscripción (null) → trata como FREE', async () => {
    mockPlan(null); mockDb.project.count.mockResolvedValue(0)
    const r = await checkProjectLimit('u-new')
    expect(r.plan).toBe('FREE')
    expect(r.limit).toBe(1)
  })

  it('Suscripción cancelada → downgrade a FREE', async () => {
    mockPlan('PRO', 'canceled'); mockDb.project.count.mockResolvedValue(0)
    const r = await checkProjectLimit('u1')
    expect(r.plan).toBe('FREE')
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('checkTestRunLimit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('FREE · 49 runs → allowed', async () => {
    mockPlan('FREE'); mockDb.testRun.count.mockResolvedValue(49)
    const r = await checkTestRunLimit('u1')
    expect(r).toMatchObject({ allowed: true, limit: 50, current: 49 })
  })

  it('FREE · 50 runs → NOT allowed (límite exacto)', async () => {
    mockPlan('FREE'); mockDb.testRun.count.mockResolvedValue(50)
    expect((await checkTestRunLimit('u1')).allowed).toBe(false)
  })

  it('STARTER · 100 runs → NOT allowed', async () => {
    mockPlan('STARTER'); mockDb.testRun.count.mockResolvedValue(100)
    expect((await checkTestRunLimit('u1')).allowed).toBe(false)
  })

  it('PRO · 999 runs → allowed', async () => {
    mockPlan('PRO'); mockDb.testRun.count.mockResolvedValue(999)
    expect((await checkTestRunLimit('u1')).allowed).toBe(true)
  })

  it('ENTERPRISE → siempre allowed, NO consulta testRun.count', async () => {
    mockPlan('ENTERPRISE')
    const r = await checkTestRunLimit('u1')
    expect(r).toMatchObject({ allowed: true, limit: -1 })
    expect(mockDb.testRun.count).not.toHaveBeenCalled()
  })

  it('query usa startedAt >= primer día del mes', async () => {
    mockPlan('FREE'); mockDb.testRun.count.mockResolvedValue(0)
    await checkTestRunLimit('u1')
    const { where } = mockDb.testRun.count.mock.calls[0][0]
    const passed = where.startedAt.gte as Date
    expect(passed).toBeInstanceOf(Date)
    expect(passed.getDate()).toBe(1)
    expect(passed.getHours()).toBe(0)
    expect(passed.getMinutes()).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('limitExceededResponse', () => {
  it('retorna status 429', async () => {
    const res = limitExceededResponse('projects', { plan: 'FREE', current: 1, limit: 1 })
    expect(res.status).toBe(429)
  })

  it('body: limitExceeded=true, upgradeUrl, plan, current', async () => {
    const res = limitExceededResponse('testRuns', { plan: 'FREE', current: 50, limit: 50 })
    const body = await res.json()
    expect(body.limitExceeded).toBe(true)
    expect(body.upgradeUrl).toBe('/pricing')
    expect(body.plan).toBe('FREE')
    expect(body.current).toBe(50)
  })

  it('mensaje de projects incluye límites numéricos', async () => {
    const res = limitExceededResponse('projects', { plan: 'FREE', current: 1, limit: 1 })
    const body = await res.json()
    expect(body.error).toContain('1/1')
    expect(body.error).toContain('FREE')
  })

  it('mensaje de testRuns incluye límites numéricos', async () => {
    const res = limitExceededResponse('testRuns', { plan: 'STARTER', current: 100, limit: 100 })
    const body = await res.json()
    expect(body.error).toContain('100/100')
    expect(body.error).toContain('STARTER')
  })
})

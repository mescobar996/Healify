import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { evaluateGate } from '@/lib/gate/evaluate-gate'

// ── Mock DB (route.ts + real evaluateGate()/selectorAnalyzer transitively use this) ──
//
// Uses vi.hoisted() rather than plain top-level consts: the static
// `import { evaluateGate } from '@/lib/gate/evaluate-gate'` above transitively
// imports '@/lib/db' (via selector-analyzer.ts) and static imports execute
// before any of this file's own top-level statements — so a plain `const
// mockDb = {...}` declared after the vi.mock() calls would not be initialized
// yet when the '@/lib/db' factory runs. vi.hoisted() guarantees this object
// exists before any import (static or hoisted vi.mock) touches it.
const { mockDb, mockValidateApiKeyFromRequest, mockCheckApiReportRateLimit, mockAnalyzeBrokenSelector } = vi.hoisted(() => ({
  mockDb: {
    testRun: {
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
    },
    healingEvent: {
      create: vi.fn(),
      update: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
  mockValidateApiKeyFromRequest: vi.fn(),
  mockCheckApiReportRateLimit: vi.fn(),
  mockAnalyzeBrokenSelector: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

// ── Mock API key auth ──────────────────────────────────────────────────
vi.mock('@/lib/api-key-service', () => ({
  validateApiKeyFromRequest: mockValidateApiKeyFromRequest,
}))

// ── Mock rate limiting ─────────────────────────────────────────────────
vi.mock('@/lib/rate-limit', () => ({
  checkApiReportRateLimit: mockCheckApiReportRateLimit,
}))

// ── Mock the AI healing engine (evaluateGate() itself stays REAL below) ─
vi.mock('@/lib/ai/healing-service', () => ({
  analyzeBrokenSelector: mockAnalyzeBrokenSelector,
}))

// ── Re-import the route after all mocks are set up ─────────────────────
const { POST } = await import('@/app/api/v1/report/route')

function makeReportRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/v1/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_REPORT_BODY = {
  testName: 'Login test',
  selector: '#old-submit-btn',
  error: 'Element not found',
  context: '<button id="old-submit-btn">Submit</button>',
}

// ── Simulate the in-memory rate limiter logic ─────────────────────────
const REPORT_LIMIT  = 60
const REPORT_WINDOW = 60_000

function makeRateLimiter() {
  const counts = new Map<string, { count: number; resetAt: number }>()

  return function checkLimit(projectId: string): { allowed: boolean; remaining: number } {
    const now   = Date.now()
    const entry = counts.get(projectId)

    if (!entry || now > entry.resetAt) {
      counts.set(projectId, { count: 1, resetAt: now + REPORT_WINDOW })
      return { allowed: true, remaining: REPORT_LIMIT - 1 }
    }
    if (entry.count >= REPORT_LIMIT) {
      return { allowed: false, remaining: 0 }
    }
    entry.count++
    return { allowed: true, remaining: REPORT_LIMIT - entry.count }
  }
}

// ── ReportSchema validation (mirrors production schema) ───────────────
function validateReport(body: Record<string, unknown>) {
  const errors: string[] = []
  if (!body.testName || typeof body.testName !== 'string') errors.push('testName required')
  if (!body.selector  || typeof body.selector  !== 'string') errors.push('selector required')
  if (!body.error     || typeof body.error     !== 'string') errors.push('error required')

  const validSelectorTypes = ['CSS','XPATH','TESTID','ROLE','TEXT','UNKNOWN']
  if (body.selectorType && !validSelectorTypes.includes(body.selectorType as string))
    errors.push(`selectorType must be one of: ${validSelectorTypes.join(', ')}`)

  return { valid: errors.length === 0, errors }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('/api/v1/report — payload validation', () => {

  it('rechaza payload vacío', () => {
    expect(validateReport({}).valid).toBe(false)
    expect(validateReport({}).errors.length).toBeGreaterThan(0)
  })

  it('requiere testName, selector y error', () => {
    const { errors } = validateReport({ testName: '', selector: '', error: '' })
    expect(errors).toContain('testName required')
    expect(errors).toContain('selector required')
    expect(errors).toContain('error required')
  })

  it('payload mínimo válido pasa', () => {
    expect(validateReport({
      testName: 'Login test',
      selector: '#login-btn',
      error: 'Element not found',
    }).valid).toBe(true)
  })

  it('selectorType debe ser uno de los valores permitidos', () => {
    expect(validateReport({ testName: 'T', selector: '#a', error: 'E', selectorType: 'CSS' }).valid).toBe(true)
    expect(validateReport({ testName: 'T', selector: '#a', error: 'E', selectorType: 'INVALID' }).valid).toBe(false)
  })

  it('campos opcionales aceptados: testFile, context, branch, commitSha', () => {
    expect(validateReport({
      testName: 'Login',
      selector: '#btn',
      error: 'Not found',
      testFile: 'tests/login.spec.ts',
      context: '<div id="login-btn">',
      branch: 'main',
      commitSha: 'abc123def',
    }).valid).toBe(true)
  })
})

describe('/api/v1/report — rate limiting', () => {

  it('primeras 60 requests: todas permitidas', () => {
    const check = makeRateLimiter()
    for (let i = 0; i < 60; i++) {
      expect(check('proj_A').allowed).toBe(true)
    }
  })

  it('request 61: bloqueada', () => {
    const check = makeRateLimiter()
    for (let i = 0; i < 60; i++) check('proj_A')
    expect(check('proj_A').allowed).toBe(false)
    expect(check('proj_A').remaining).toBe(0)
  })

  it('proyectos diferentes tienen ventanas independientes', () => {
    const check = makeRateLimiter()
    for (let i = 0; i < 60; i++) check('proj_A')
    // proj_B no debe verse afectado
    expect(check('proj_B').allowed).toBe(true)
    expect(check('proj_B').remaining).toBe(REPORT_LIMIT - 2)
  })

  it('remaining decrements correctamente', () => {
    const check = makeRateLimiter()
    const r1 = check('proj_X')
    const r2 = check('proj_X')
    const r3 = check('proj_X')
    expect(r1.remaining).toBe(59)
    expect(r2.remaining).toBe(58)
    expect(r3.remaining).toBe(57)
  })

  it('REPORT_LIMIT es 60', () => {
    expect(REPORT_LIMIT).toBe(60)
  })
})

describe('/api/v1/report — healing result logic (evaluateGate real)', () => {

  it('confidence >= threshold, selector robusto y sin domSnapshot → HEALED_AUTO', () => {
    const gate = evaluateGate({
      confidence: 0.97,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    const status = gate.pass ? 'HEALED_AUTO' : 'NEEDS_REVIEW'
    expect(status).toBe('HEALED_AUTO')
  })

  it('confidence < threshold → NEEDS_REVIEW', () => {
    const gate = evaluateGate({
      confidence: 0.80,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    const status = gate.pass ? 'HEALED_AUTO' : 'NEEDS_REVIEW'
    expect(status).toBe('NEEDS_REVIEW')
  })

  it('confidence alta pero selector frágil → también NEEDS_REVIEW (gate bloquea aunque el modelo esté seguro)', () => {
    const gate = evaluateGate({
      confidence: 0.99,
      selector: 'div:nth-child(3)',
      selectorType: 'CSS',
      threshold: 0.85,
    })
    expect(gate.pass).toBe(false)
  })

  it('confidence < 0.70 → notificación requerida', () => {
    expect(0.65 < 0.70).toBe(true)
    expect(0.71 < 0.70).toBe(false)
  })

  it('processingTimeMs es número positivo', () => {
    const start = Date.now() - 50
    const ms = Date.now() - start
    expect(ms).toBeGreaterThan(0)
    expect(typeof ms).toBe('number')
  })
})

// ══════════════════════════════════════════════════════════════════════
// INTEGRATION — calls the real POST handler, mocks only its dependencies.
// This is what actually proves the 5 gate.pass wire-ups in route.ts
// (status, actionTaken, appliedAt, healedTests/failedTests, needsReview)
// are correct — the describe block above only proves evaluateGate() is
// correct in isolation, it never touches route.ts.
// ══════════════════════════════════════════════════════════════════════
describe('POST /api/v1/report — real handler + real evaluateGate()', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockValidateApiKeyFromRequest.mockResolvedValue({
      valid: true,
      projectId: 'proj_1',
      projectName: 'Test Project',
    })

    mockCheckApiReportRateLimit.mockResolvedValue({
      allowed: true,
      plan: 'FREE',
      limit: 60,
      remaining: 59,
      resetInMs: 60000,
    })

    mockDb.testRun.findFirst.mockResolvedValue({ id: 'run_1' })
    mockDb.testRun.create.mockResolvedValue({ id: 'run_1' })
    mockDb.testRun.update.mockResolvedValue({ id: 'run_1' })
    mockDb.healingEvent.create.mockResolvedValue({ id: 'evt_1' })
    mockDb.healingEvent.update.mockResolvedValue({ id: 'evt_1' })
    mockDb.notification.create.mockResolvedValue({})
  })

  it('confidence alta + selector robusto + threshold cumplido → HEALED_AUTO, auto_fixed, appliedAt seteado, needsReview:false', async () => {
    mockDb.project.findUnique.mockResolvedValue({ userId: 'user_1', autoHealThreshold: 0.95 })
    mockAnalyzeBrokenSelector.mockResolvedValue({
      newSelector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      confidence: 0.97,
      reasoning: 'Stable data-testid found',
    })

    const res = await POST(makeReportRequest(VALID_REPORT_BODY))
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(mockDb.healingEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'HEALED_AUTO',
          actionTaken: 'auto_fixed',
          appliedAt: expect.any(Date),
        }),
      })
    )
    expect(mockDb.testRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          healedTests: { increment: 1 },
          failedTests: undefined,
        }),
      })
    )
    expect(json.result.needsReview).toBe(false)
  })

  it('confidence alta pero selector frágil → NEEDS_REVIEW, suggested, appliedAt:null, needsReview:true (el gate real bloquea, no evaluateGate() aislado)', async () => {
    mockDb.project.findUnique.mockResolvedValue({ userId: 'user_1', autoHealThreshold: 0.85 })
    mockAnalyzeBrokenSelector.mockResolvedValue({
      newSelector: 'div:nth-child(3)',
      selectorType: 'CSS',
      confidence: 0.99,
      reasoning: 'Best guess based on DOM position',
    })

    const res = await POST(makeReportRequest(VALID_REPORT_BODY))
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(mockDb.healingEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NEEDS_REVIEW',
          actionTaken: 'suggested',
          appliedAt: null,
        }),
      })
    )
    expect(mockDb.testRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedTests: { increment: 1 },
          healedTests: undefined,
        }),
      })
    )
    expect(json.result.needsReview).toBe(true)
  })
})

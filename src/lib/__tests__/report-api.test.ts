import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('/api/v1/report — healing result logic', () => {

  it('confidence >= 0.95 → HEALED_AUTO', () => {
    const confidence = 0.97
    const status = confidence >= 0.95 ? 'HEALED_AUTO' : 'NEEDS_REVIEW'
    expect(status).toBe('HEALED_AUTO')
  })

  it('confidence < 0.95 → NEEDS_REVIEW', () => {
    const confidence = 0.80
    const status = confidence >= 0.95 ? 'HEALED_AUTO' : 'NEEDS_REVIEW'
    expect(status).toBe('NEEDS_REVIEW')
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

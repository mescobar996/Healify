import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockWriteFileSync } = vi.hoisted(() => ({ mockWriteFileSync: vi.fn() }))
vi.mock('node:fs', () => ({ writeFileSync: mockWriteFileSync }))

const { mockRunLocalHealing } = vi.hoisted(() => {
  const mockRunLocalHealing = vi.fn((input: { testName: string; testFile?: string; errorMessage: string }) => ({
    testName: input.testName,
    testFile: input.testFile,
    selector: 'Unknown selector',
    errorMessage: input.errorMessage,
    status: 'unresolved' as const,
    fixedSelector: '',
    confidence: 0,
    explanation: '',
    selectorType: 'UNKNOWN',
  }))
  return { mockRunLocalHealing }
})

vi.mock('@healify/reporter-core', () => ({
  runLocalHealing: mockRunLocalHealing,
  renderLocalReportHtml: vi.fn(() => '<html></html>'),
  renderLocalReportJson: vi.fn(() => '{}'),
  renderLocalReportMarkdown: vi.fn(() => '# reporte'),
  printSummary: vi.fn(),
  baseEnvironment: vi.fn((framework: string, extra = {}) => ({ os: 'test', node: 'v20', framework, ...extra })),
  statsFromCases: vi.fn((cases: unknown[], suite?: { total: number; passed: number; failed: number }) => ({
    total: suite?.total ?? cases.length,
    passed: suite?.passed ?? 0,
    failed: suite?.failed ?? cases.length,
    healed: 0,
    review: 0,
    unresolved: 0,
  })),
  readRepertoire: vi.fn(() => []),
}))

import HealifyReporter from '../reporter'

function makeTest(overrides?: Record<string, unknown>) {
  return {
    titlePath: () => ['root', 'should log in'],
    location: { file: 'tests/login.spec.ts' },
    ...overrides,
  } as any
}

function makeResult(overrides?: Record<string, unknown>) {
  return {
    status: 'failed',
    error: { message: "Waiting for selector '#login-btn' failed" },
    errors: [],
    attachments: [],
    ...overrides,
  } as any
}

describe('HealifyReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when the test passed', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))

    expect(mockRunLocalHealing).not.toHaveBeenCalled()
  })

  it('corre la heurística local cuando el test timeoutea', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({
      status: 'timedOut',
      error: { message: "Timed out waiting for locator('button.submit')" },
    })

    reporter.onTestEnd(makeTest(), result)

    expect(mockRunLocalHealing).toHaveBeenCalledTimes(1)
    const payload = mockRunLocalHealing.mock.calls[0][0]
    expect(payload.testName).toBe('root > should log in')
    expect(payload.testFile).toBe('tests/login.spec.ts')
    expect(payload.errorMessage).toContain('Timed out waiting')
  })

  it('corre la heurística local para un test fallido', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())

    expect(mockRunLocalHealing).toHaveBeenCalledTimes(1)
    const payload = mockRunLocalHealing.mock.calls[0][0]
    expect(payload.testName).toBe('root > should log in')
    expect(payload.testFile).toBe('tests/login.spec.ts')
    expect(payload.errorMessage).toContain("Waiting for selector '#login-btn'")
  })

  it('encuentra el selector en errors[1] cuando errors[0]/error no lo tienen (timeout real de Playwright)', () => {
    // Reproduce el shape real que devuelve Playwright cuando page.click() nunca resuelve:
    // el TEST timeoutea entero, error/errors[0] es el mensaje genérico sin selector, y el
    // selector real vive en errors[1] (Call log del action timeout). Verificado corriendo
    // Playwright de verdad contra un selector roto, no un caso inventado.
    const reporter = new HealifyReporter()
    const result = makeResult({
      status: 'timedOut',
      error: { message: 'Test timeout of 30000ms exceeded.' },
      errors: [
        { message: 'Test timeout of 30000ms exceeded.' },
        { message: "Error: page.click: Test timeout of 30000ms exceeded.\nCall log:\n  - waiting for locator('#old-add-to-cart-btn')" },
      ],
    })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockRunLocalHealing.mock.calls[0][0]
    expect(payload.errorMessage).toContain("locator('#old-add-to-cart-btn')")
  })

  it('falls back to result.errors[0] when result.error is null', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({
      error: null,
      errors: [{ message: 'Element not found: .missing-class' }],
    })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockRunLocalHealing.mock.calls[0][0]
    expect(payload.errorMessage).toBe('Element not found: .missing-class')
  })

  it('falls back to error.value when error.message is null and error.value is set', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({
      error: { message: undefined, value: 'element .btn was not found' },
      errors: [],
    })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockRunLocalHealing.mock.calls[0][0]
    expect(payload.errorMessage).toBe('element .btn was not found')
  })

  it('uses "Unknown error" when both error and errors are empty', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({ error: null, errors: [] })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockRunLocalHealing.mock.calls[0][0]
    expect(payload.errorMessage).toBe('Unknown error')
  })

  it('no rompe la corrida si runLocalHealing lanza una excepción', () => {
    mockRunLocalHealing.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const reporter = new HealifyReporter()

    expect(() => reporter.onTestEnd(makeTest(), makeResult())).not.toThrow()
  })

  it('onEnd escribe el reporte aunque no haya ningún caso — el "todo pasó" también es un entregable', () => {
    // Cambio de comportamiento deliberado: antes se cortaba con `if (localResults.length === 0)
    // return` y no se generaba nada cuando la suite pasaba entera. Un reporte de QA que solo
    // aparece cuando algo se rompe no permite distinguir "salió todo bien" de "no se corrió".
    const reporter = new HealifyReporter()

    reporter.onEnd({ status: 'passed' } as any)

    const paths = mockWriteFileSync.mock.calls.map((call) => String(call[0]))
    expect(paths.some((p) => p.endsWith('healify-report.html'))).toBe(true)
    expect(paths.some((p) => p.endsWith('healify-report.json'))).toBe(true)
    expect(paths.some((p) => p.endsWith('healify-report.md'))).toBe(true)
  })

  it('el veredicto sale del resultado real de la corrida, no de los casos que curó Healify', async () => {
    const reporter = new HealifyReporter()
    const renderJson = vi.mocked((await import('@healify/reporter-core')).renderLocalReportJson)

    reporter.onEnd({ status: 'failed' } as any)

    expect(renderJson.mock.calls[0][0].verdict).toBe('failed')
  })

  it('cuenta los tests de toda la suite, no solo los que fallaron', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))
    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))
    reporter.onTestEnd(makeTest(), makeResult())

    expect(reporter['passed']).toBe(2)
    expect(reporter['failed']).toBe(1)
  })
})

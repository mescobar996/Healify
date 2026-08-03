import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FullResult, TestCase, TestResult } from '@playwright/test/reporter'

const { mockWriteFileSync } = vi.hoisted(() => ({ mockWriteFileSync: vi.fn() }))
vi.mock('node:fs', () => ({ writeFileSync: mockWriteFileSync }))

const { mockRunLocalHealing, mockLoadConfig } = vi.hoisted(() => {
  const mockLoadConfig = vi.fn(() => ({ minConfidence: 0.95 }))
  const mockRunLocalHealing = vi.fn((input: { testName: string; testFile?: string; errorMessage: string }, _config?: unknown) => ({
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
  return { mockRunLocalHealing, mockLoadConfig }
})

vi.mock('@healify/reporter-core', () => ({
  runLocalHealing: mockRunLocalHealing,
  buildAuditEntry: vi.fn((response, request, context) => ({
    timestamp: new Date().toISOString(),
    testName: request.testName ?? 'unknown',
    testFile: request.testFile,
    line: context.line,
    originalSelector: request.selector,
    fixedSelector: response.fixedSelector,
    selectorType: response.selectorType,
    confidence: response.confidence,
    verified: response.verified,
    fromRepertoire: response.fromRepertoire,
    errorMessage: context.errorMessage,
    domSnippet: context.domSnippet,
    domHash: context.domSnippet
      ? require('node:crypto').createHash('sha256').update(context.domSnippet).digest('hex')
      : undefined,
    screenshotPath: context.screenshotPath,
    alternatives: response.alternatives ?? [],
    technicalDetails: response.technicalDetails,
  })),
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
  loadConfig: mockLoadConfig,
  appendRunRecord: vi.fn(),
}))

import HealifyReporter from '../reporter'

function makeTest(overrides?: Record<string, unknown>): TestCase {
  return {
    titlePath: () => ['root', 'should log in'],
    location: { file: 'tests/login.spec.ts' },
    ...overrides,
  } as unknown as TestCase
}

function makeResult(overrides?: Record<string, unknown>): TestResult {
  return {
    status: 'failed',
    error: { message: "Waiting for selector '#login-btn' failed" },
    errors: [],
    attachments: [],
    ...overrides,
  } as unknown as TestResult
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

  it('carga la config del proyecto una sola vez en onBegin y se la pasa al motor', () => {
    const reporter = new HealifyReporter()
    const config = { projects: [], version: '1.58.0' } as never
    const suite = { allTests: () => [] } as never

    reporter.onBegin(config, suite)
    reporter.onTestEnd(makeTest(), makeResult())
    reporter.onTestEnd(makeTest(), makeResult())

    expect(mockLoadConfig).toHaveBeenCalledTimes(1)
    expect(mockRunLocalHealing.mock.calls[0][1]).toEqual({ minConfidence: 0.95 })
    expect(mockRunLocalHealing.mock.calls[1][1]).toEqual({ minConfidence: 0.95 })
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

    reporter.onEnd({ status: 'passed' } as unknown as FullResult)

    const paths = mockWriteFileSync.mock.calls.map((call) => String(call[0]))
    expect(paths.some((p) => p.endsWith('healify-report.html'))).toBe(true)
    expect(paths.some((p) => p.endsWith('healify-report.json'))).toBe(true)
    expect(paths.some((p) => p.endsWith('healify-report.md'))).toBe(true)
  })

  it('el veredicto sale del resultado real de la corrida, no de los casos que curó Healify', async () => {
    const reporter = new HealifyReporter()
    const renderJson = vi.mocked((await import('@healify/reporter-core')).renderLocalReportJson)

    reporter.onEnd({ status: 'failed' } as unknown as FullResult)

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

  it('onEnd registra la corrida con los outcomes de cada test (pass y fail)', async () => {
    const appendRun = vi.mocked((await import('@healify/reporter-core')).appendRunRecord)
    const reporter = new HealifyReporter()
    const config = { projects: [], version: '1.58.0' } as never
    const suite = { allTests: () => [1, 2, 3] } as never
    reporter.onBegin(config, suite)

    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))
    reporter.onTestEnd(makeTest(), makeResult())
    reporter.onTestEnd(makeTest({ titlePath: () => ['root', 'skipped one'] }), makeResult({ status: 'skipped' }))
    reporter.onEnd({ status: 'failed' } as unknown as FullResult)

    expect(appendRun).toHaveBeenCalledTimes(1)
    const record = appendRun.mock.calls[0][0]
    expect(record.type).toBe('run')
    expect(record.total).toBe(3)
    expect(record.passed).toBe(1)
    expect(record.failed).toBe(1)
    expect(record.tests).toEqual([
      { testName: 'root > should log in', testFile: 'tests/login.spec.ts', passed: true },
      { testName: 'root > should log in', testFile: 'tests/login.spec.ts', passed: false },
    ])
    expect(appendRun.mock.calls[0][1]).toBe(process.cwd())
  })

  it('skipped/interrupted no entran al registro de corridas', async () => {
    const appendRun = vi.mocked((await import('@healify/reporter-core')).appendRunRecord)
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))
    reporter.onTestEnd(makeTest(), makeResult({ status: 'interrupted' }))
    reporter.onTestEnd(makeTest(), makeResult({ status: 'skipped' }))
    reporter.onEnd({ status: 'passed' } as unknown as FullResult)

    const record = appendRun.mock.calls[0][0]
    expect(record.tests).toEqual([{ testName: 'root > should log in', testFile: 'tests/login.spec.ts', passed: true }])
  })
})

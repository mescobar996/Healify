import { describe, it, expect, vi, beforeEach } from 'vitest'

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

  it('onEnd no escribe nada si no hubo casos', () => {
    const reporter = new HealifyReporter()
    expect(() => reporter.onEnd()).not.toThrow()
  })
})

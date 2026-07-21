import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReportFailure, getMockConfig, setMockConfig } = vi.hoisted(() => {
  const mockReportFailure = vi.fn()
  let mockConfig: unknown = { apiKey: 'test', apiUrl: 'http://localhost:3000' }
  return {
    mockReportFailure,
    getMockConfig: () => mockConfig,
    setMockConfig: (v: unknown) => { mockConfig = v },
  }
})

vi.mock('@healify/reporter-core', () => ({
  resolveConfig: vi.fn(() => getMockConfig()),
  reportFailure: mockReportFailure,
  extractSelectorFromError: vi.fn((msg: string) => {
    const m = msg.match(/['"`]([^'"`]+)['"`]/)
    return m ? m[1] : 'Unknown selector'
  }),
  ATTACHMENT_NAME: 'healify-dom',
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
    setMockConfig({ apiKey: 'test', apiUrl: 'http://localhost:3000' })
  })

  it('does nothing when config is disabled (HEALIFY_API_KEY not set)', () => {
    setMockConfig(null)
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())

    expect(mockReportFailure).not.toHaveBeenCalled()
  })

  it('does nothing when the test passed', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))

    expect(mockReportFailure).not.toHaveBeenCalled()
  })

  it('reports when the test timed out', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({
      status: 'timedOut',
      error: { message: "Timed out waiting for locator('button.submit')" },
    })

    reporter.onTestEnd(makeTest(), result)

    expect(mockReportFailure).toHaveBeenCalledTimes(1)
    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.testName).toBe('root > should log in')
    expect(payload.testFile).toBe('tests/login.spec.ts')
    expect(payload.selector).toBe('button.submit')
    expect(payload.error).toContain('Timed out waiting')
  })

  it('sends the selector, error and test metadata for a failed test', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())

    expect(mockReportFailure).toHaveBeenCalledTimes(1)
    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.selector).toBe('#login-btn')
    expect(payload.testName).toBe('root > should log in')
    expect(payload.testFile).toBe('tests/login.spec.ts')
    expect(payload.error).toContain("Waiting for selector '#login-btn'")
  })

  it('includes DOM context when healify-dom attachment is present', () => {
    const reporter = new HealifyReporter()
    const domHtml = '<html><body><button id="login-btn">Login</button></body></html>'
    const result = makeResult({
      attachments: [{ name: 'healify-dom', body: Buffer.from(domHtml, 'utf-8'), contentType: 'text/html' }],
    })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.context).toBe(domHtml)
  })

  it('sets context to undefined when healify-dom attachment is missing', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())

    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.context).toBeUndefined()
  })

  it('falls back to result.errors[0] when result.error is null', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({
      error: null,
      errors: [{ message: "Element not found: .missing-class" }],
    })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.error).toBe("Element not found: .missing-class")
  })

  it('falls back to error.value when error.message is null and error.value is set', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({
      error: { message: undefined, value: 'element .btn was not found' },
      errors: [],
    })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.error).toBe('element .btn was not found')
  })

  it('uses "Unknown error" when both error and errors are empty', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({ error: null, errors: [] })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.error).toBe('Unknown error')
  })

  it('reports "Unknown selector" when the error message has no recognizable selector', () => {
    const reporter = new HealifyReporter()
    const result = makeResult({ error: { message: 'Something went wrong' } })

    reporter.onTestEnd(makeTest(), result)

    const payload = mockReportFailure.mock.calls[0][1]
    expect(payload.selector).toBe('Unknown selector')
  })
})

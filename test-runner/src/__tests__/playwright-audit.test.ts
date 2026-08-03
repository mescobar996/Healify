import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockWriteFileSync, mockReadFileSync } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}))
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...actual, writeFileSync: mockWriteFileSync, readFileSync: mockReadFileSync }
})

const { mockRunLocalHealing } = vi.hoisted(() => {
  const mockRunLocalHealing = vi.fn((input: { testName: string; testFile?: string; errorMessage: string }) => ({
    testName: input.testName,
    testFile: input.testFile,
    selector: '#login-btn',
    errorMessage: input.errorMessage,
    status: 'healed' as const,
    fixedSelector: "role('button', { name: 'Login' })",
    confidence: 0.92,
    explanation: 'Selector replaced with ARIA role',
    selectorType: 'ROLE',
    verified: true,
    fromRepertoire: false,
    defectId: 'defect-1',
    severity: 'low' as const,
  }))
  return { mockRunLocalHealing }
})

const { mockWriteAuditReport } = vi.hoisted(() => {
  const mockWriteAuditReport = vi.fn(() => '/mock/healify-audit.json')
  return { mockWriteAuditReport }
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
  writeAuditReport: mockWriteAuditReport,
}))

import HealifyReporter from '../reporter'

function makeTest(overrides?: Record<string, unknown>) {
  return {
    titlePath: () => ['root', 'should log in'],
    location: { file: 'tests/login.spec.ts', line: 10 },
    ...overrides,
  } as any
}

function makeResult(overrides?: Record<string, unknown>) {
  return {
    status: 'failed',
    error: { message: "Waiting for selector '#login-btn' failed" },
    errors: [],
    attachments: [],
    duration: 100,
    ...overrides,
  } as any
}

describe('Playwright Audit Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes audit report when there are failures with known selectors', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())
    reporter.onEnd({ status: 'failed' } as any)

    expect(mockWriteAuditReport).toHaveBeenCalledTimes(1)
    const [entries, outputDir, project, framework] = mockWriteAuditReport.mock.calls[0]
    expect(entries).toHaveLength(1)
    expect(entries[0]).toHaveProperty('timestamp')
    expect(entries[0]).toHaveProperty('testName', 'root > should log in')
    expect(entries[0]).toHaveProperty('testFile', 'tests/login.spec.ts')
    expect(entries[0]).toHaveProperty('originalSelector', '#login-btn')
    expect(entries[0]).toHaveProperty('fixedSelector', "role('button', { name: 'Login' })")
    expect(entries[0]).toHaveProperty('selectorType', 'ROLE')
    expect(entries[0]).toHaveProperty('confidence', 0.92)
    expect(entries[0]).toHaveProperty('verified', true)
    expect(entries[0]).toHaveProperty('fromRepertoire', false)
    expect(entries[0]).toHaveProperty('errorMessage')
    expect(entries[0]).toHaveProperty('technicalDetails')
    expect(outputDir).toBe(process.cwd())
    expect(project).toBe('Playwright suite')
    expect(framework).toBe('Playwright')
  })

  it('does not write audit report when no failures have known selectors', () => {
    mockRunLocalHealing.mockImplementationOnce((input: { testName: string; errorMessage: string }) => ({
      testName: input.testName,
      selector: 'Unknown selector',
      errorMessage: input.errorMessage,
      status: 'unresolved' as const,
      fixedSelector: '',
      confidence: 0,
      explanation: '',
      selectorType: 'UNKNOWN',
      defectId: 'defect-unknown',
      severity: 'high' as const,
    }))

    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())
    reporter.onEnd({ status: 'failed' } as any)

    expect(mockWriteAuditReport).not.toHaveBeenCalled()
  })

  it('does not write audit report when all tests pass', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult({ status: 'passed' }))
    reporter.onEnd({ status: 'passed' } as any)

    expect(mockWriteAuditReport).not.toHaveBeenCalled()
  })

  it('collects multiple audit entries for multiple failures', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())
    reporter.onTestEnd(
      makeTest({ titlePath: () => ['root', 'should sign up'] }),
      makeResult()
    )
    reporter.onEnd({ status: 'failed' } as any)

    expect(mockWriteAuditReport).toHaveBeenCalledTimes(1)
    const [entries] = mockWriteAuditReport.mock.calls[0]
    expect(entries).toHaveLength(2)
    expect(entries[0].testName).toBe('root > should log in')
    expect(entries[1].testName).toBe('root > should sign up')
  })

  it('audit entry includes line number from test location', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest({ location: { file: 'tests/login.spec.ts', line: 42 } }), makeResult())
    reporter.onEnd({ status: 'failed' } as any)

    const [entries] = mockWriteAuditReport.mock.calls[0]
    expect(entries[0].line).toBe(42)
  })

  it('audit entry includes domHash when domContext is available', () => {
    const attachmentPath = '/tmp/error-context.json'
    mockReadFileSync.mockReturnValue('{"role":"root","name":""}')

    const reporter = new HealifyReporter()

    reporter.onTestEnd(
      makeTest(),
      makeResult({
        attachments: [{ name: 'error-context', path: attachmentPath }],
      })
    )
    reporter.onEnd({ status: 'failed' } as any)

    const [entries] = mockWriteAuditReport.mock.calls[0]
    expect(entries[0]).toHaveProperty('domHash')
    expect(typeof entries[0].domHash).toBe('string')
  })

  it('audit entry has empty alternatives array', () => {
    const reporter = new HealifyReporter()

    reporter.onTestEnd(makeTest(), makeResult())
    reporter.onEnd({ status: 'failed' } as any)

    const [entries] = mockWriteAuditReport.mock.calls[0]
    expect(Array.isArray(entries[0].alternatives)).toBe(true)
    expect(entries[0].alternatives).toHaveLength(0)
  })
})

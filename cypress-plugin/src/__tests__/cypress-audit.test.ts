import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HealResponse, HealRequest, FailureContext } from '@healify/reporter-core'

type TaskHandler = (...args: unknown[]) => unknown

const { mockBuildAuditEntry, mockWriteAuditReport, mockWriteFileSync } = vi.hoisted(() => {
  const mockBuildAuditEntry = vi.fn((_response: HealResponse, request: HealRequest, context: FailureContext) => ({
    timestamp: '2026-01-01T00:00:00.000Z',
    testName: request.testName ?? 'unknown',
    originalSelector: request.selector,
    fixedSelector: _response.fixedSelector,
    selectorType: _response.selectorType,
    confidence: _response.confidence,
    verified: _response.verified,
    fromRepertoire: _response.fromRepertoire,
    errorMessage: context.errorMessage,
    alternatives: _response.alternatives ?? [],
    technicalDetails: _response.technicalDetails,
  }))
  const mockWriteAuditReport = vi.fn(() => '/path/to/healify-audit.json')
  const mockWriteFileSync = vi.fn()
  return { mockBuildAuditEntry, mockWriteAuditReport, mockWriteFileSync }
})

vi.mock('@healify/reporter-core', () => ({
  runLocalHealing: vi.fn(() => ({
    testName: 'test',
    selector: 'Unknown selector',
    errorMessage: 'error',
    status: 'unresolved',
    fixedSelector: '',
    confidence: 0,
    explanation: '',
    selectorType: 'CSS',
  })),
  renderLocalReportHtml: vi.fn(() => '<html></html>'),
  renderLocalReportJson: vi.fn(() => '{}'),
  renderLocalReportMarkdown: vi.fn(() => '# reporte'),
  printSummary: vi.fn(),
  baseEnvironment: vi.fn(() => ({ os: 'test', node: 'v20', framework: 'Cypress' })),
  statsFromCases: vi.fn(() => ({ total: 0, passed: 0, failed: 0, healed: 0, review: 0, unresolved: 0 })),
  readRepertoire: vi.fn(() => []),
  analyzeAndHeal: vi.fn(() => ({
    fixedSelector: "role('button', { name: 'Submit' })",
    confidence: 0.95,
    verified: true,
    fromRepertoire: false,
    explanation: 'found by role',
    selectorType: 'ROLE',
  })),
  resolveLocatorStrategy: vi.fn(() => ({ strategy: 'xpath' as const, value: '//button' })),
  domContextFromProbeResult: vi.fn(() => undefined),
  BROWSER_PROBE_SCRIPT: 'return [];',
  buildDefectId: vi.fn(() => 'DEF-test'),
  severityFor: vi.fn(() => 'minor'),
  buildAuditEntry: mockBuildAuditEntry,
  writeAuditReport: mockWriteAuditReport,
}))

vi.mock('node:fs', () => ({
  writeFileSync: mockWriteFileSync,
  mkdirSync: vi.fn(),
}))

import { HealifyCypressPlugin } from '../plugin'

function createOnCapture() {
  const handlers: Record<string, TaskHandler> = {}
  const on = vi.fn((event: string, handler: TaskHandler) => {
    handlers[event] = handler
  }) as unknown as Cypress.PluginEvents
  return { on, handlers }
}

const fakeConfig = {} as Cypress.PluginConfigOptions

describe('Cypress Audit Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds audit entries when healify:audit-entry task is called', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    const tasks = handlers['task'] as Record<string, TaskHandler>
    tasks['healify:audit-entry']({
      selector: 'button.submit',
      error: 'Element not found',
      url: 'https://example.com',
      html: '<button class="submit">Submit</button>',
      stackTrace: 'Error: Element not found',
    })

    expect(mockBuildAuditEntry).toHaveBeenCalledTimes(1)
    expect(mockBuildAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedSelector: 'button.submit',
        confidence: 0,
        selectorType: 'CSS',
      }),
      expect.objectContaining({
        selector: 'button.submit',
      }),
      expect.objectContaining({
        errorMessage: 'Element not found',
        domSnippet: '<button class="submit">Submit</button>',
      })
    )
  })

  it('writes audit report to healify-audit.json when there are entries', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    const tasks = handlers['task'] as Record<string, TaskHandler>
    tasks['healify:audit-entry']({
      selector: 'button.submit',
      error: 'Element not found',
    })

    handlers['after:run']()

    expect(mockWriteAuditReport).toHaveBeenCalledTimes(1)
    expect(mockWriteAuditReport).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          originalSelector: 'button.submit',
        }),
      ]),
      expect.any(String),
      'Cypress suite',
      'Cypress'
    )
  })

  it('does not write audit report when there are no entries', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    handlers['after:run']()

    expect(mockWriteAuditReport).not.toHaveBeenCalled()
  })

  it('handles multiple audit entries from different failures', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    const tasks = handlers['task'] as Record<string, TaskHandler>
    tasks['healify:audit-entry']({
      selector: 'button.submit',
      error: 'First failure',
    })
    tasks['healify:audit-entry']({
      selector: '#login-btn',
      error: 'Second failure',
    })

    handlers['after:run']()

    expect(mockBuildAuditEntry).toHaveBeenCalledTimes(2)
    expect(mockWriteAuditReport).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ originalSelector: 'button.submit' }),
        expect.objectContaining({ originalSelector: '#login-btn' }),
      ]),
      expect.any(String),
      'Cypress suite',
      'Cypress'
    )
  })

  it('does not crash the run if buildAuditEntry throws', () => {
    mockBuildAuditEntry.mockImplementationOnce(() => {
      throw new Error('audit build failed')
    })

    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    const tasks = handlers['task'] as Record<string, TaskHandler>
    expect(() =>
      tasks['healify:audit-entry']({
        selector: 'button.submit',
        error: 'Element not found',
      })
    ).not.toThrow()
  })

  it('includes testName and testFile in audit entry when provided', () => {
    const { on, handlers } = createOnCapture()
    HealifyCypressPlugin(on, fakeConfig)

    const tasks = handlers['task'] as Record<string, TaskHandler>
    tasks['healify:audit-entry']({
      selector: 'button.submit',
      error: 'Element not found',
      testName: 'login > shows error',
      testFile: 'e2e/login.cy.ts',
    })

    expect(mockBuildAuditEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        selector: 'button.submit',
        testName: 'login > shows error',
        testFile: 'e2e/login.cy.ts',
      }),
      expect.anything()
    )
  })
})

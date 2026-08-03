import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockAnalyzeAndHeal, mockRenderLocalReportJson, mockBuildAuditEntry, mockWriteAuditReport } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
  mockRenderLocalReportJson: vi.fn(),
  mockBuildAuditEntry: vi.fn(),
  mockWriteAuditReport: vi.fn(),
}))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return {
    ...actual,
    analyzeAndHeal: mockAnalyzeAndHeal,
    renderLocalReportJson: mockRenderLocalReportJson,
    buildAuditEntry: mockBuildAuditEntry,
    writeAuditReport: mockWriteAuditReport,
  }
})

import { HealifyWebdriverIOPlugin } from '../plugin'

let dir: string

beforeEach(() => {
  vi.clearAllMocks()
  dir = mkdtempSync(join(tmpdir(), 'healify-wdio-audit-'))
  mockBuildAuditEntry.mockImplementation((_response: any, request: any, context: any) => ({
    timestamp: '2026-01-01T00:00:00.000Z',
    testName: 'unknown',
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
  mockWriteAuditReport.mockReturnValue(join(dir, 'healify-audit.json'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeWdioElement(methods: Record<string, unknown> = {}) {
  return { click: vi.fn(), setValue: vi.fn(), ...methods }
}

function makeBrowser(findImpl: ReturnType<typeof vi.fn> = vi.fn()) {
  return { $: findImpl, url: vi.fn() }
}

function noSuchElement() {
  return new Error('Can\'t find element with selector: #old')
}

describe('WebdriverIO Audit Integration', () => {
  it('should generate audit entries for healed events', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="submit"]',
      confidence: 0.95,
      explanation: 'testid estable',
      selectorType: 'TESTID',
      verified: true,
      fromRepertoire: false,
      alternatives: [],
      technicalDetails: {
        detectedIssue: 'Element not found',
        proposedSolution: 'Use data-testid',
        accessibilityCompliant: true,
        stableAgainstDOMChanges: true,
      },
    })
    mockRenderLocalReportJson.mockReturnValue('{}')

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(makeBrowser(findImpl))
    const el = wrapped.$('#submit')
    await el.click()

    plugin.flush(dir)

    expect(mockBuildAuditEntry).toHaveBeenCalledTimes(1)
    expect(mockBuildAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedSelector: '[data-testid="submit"]',
        confidence: 0.95,
        verified: true,
      }),
      expect.objectContaining({
        selector: '#submit',
      }),
      expect.any(Object)
    )
  })

  it('should generate audit entries for no-suggestion events', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.old',
      confidence: 0.5,
      explanation: 'baja confianza',
      selectorType: 'CSS',
      verified: false,
      fromRepertoire: false,
      alternatives: [],
      technicalDetails: {
        detectedIssue: 'Low confidence',
        proposedSolution: '',
        accessibilityCompliant: false,
        stableAgainstDOMChanges: false,
      },
    })
    mockRenderLocalReportJson.mockReturnValue('{}')

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(browser)
    const el = wrapped.$('#old')
    await el.click().catch(() => {})

    plugin.flush(dir)

    expect(mockBuildAuditEntry).toHaveBeenCalledTimes(1)
    expect(mockBuildAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        confidence: 0.5,
      }),
      expect.objectContaining({
        selector: '#old',
      }),
      expect.any(Object)
    )
  })

  it('should write audit report when there are entries', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="submit"]',
      confidence: 0.95,
      explanation: 'testid estable',
      selectorType: 'TESTID',
      verified: true,
      fromRepertoire: false,
      alternatives: [],
      technicalDetails: {
        detectedIssue: 'Element not found',
        proposedSolution: 'Use data-testid',
        accessibilityCompliant: true,
        stableAgainstDOMChanges: true,
      },
    })
    mockRenderLocalReportJson.mockReturnValue('{}')

    const plugin = new HealifyWebdriverIOPlugin({ projectName: 'test-project' })
    const wrapped = plugin.wrap(makeBrowser(findImpl))
    const el = wrapped.$('#submit')
    await el.click()

    plugin.flush(dir)

    expect(mockWriteAuditReport).toHaveBeenCalledTimes(1)
    expect(mockWriteAuditReport).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          originalSelector: '#submit',
        }),
      ]),
      dir,
      'test-project',
      'WebdriverIO'
    )
  })

  it('should not write audit report when there are no entries', async () => {
    mockRenderLocalReportJson.mockReturnValue('{}')

    const plugin = new HealifyWebdriverIOPlugin()
    plugin.flush(dir)

    expect(mockWriteAuditReport).not.toHaveBeenCalled()
  })

  it('should handle multiple audit entries from different failures', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="submit"]',
      confidence: 0.95,
      explanation: 'testid estable',
      selectorType: 'TESTID',
      verified: true,
      fromRepertoire: false,
      alternatives: [],
      technicalDetails: {
        detectedIssue: 'Element not found',
        proposedSolution: 'Use data-testid',
        accessibilityCompliant: true,
        stableAgainstDOMChanges: true,
      },
    })
    mockRenderLocalReportJson.mockReturnValue('{}')

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(makeBrowser(findImpl))
    const el1 = wrapped.$('#first')
    await el1.click().catch(() => {})
    const el2 = wrapped.$('#second')
    await el2.click().catch(() => {})

    plugin.flush(dir)

    expect(mockBuildAuditEntry).toHaveBeenCalledTimes(2)
    expect(mockWriteAuditReport).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ originalSelector: '#first' }),
        expect.objectContaining({ originalSelector: '#second' }),
      ]),
      dir,
      'webdriverio-project',
      'WebdriverIO'
    )
  })

  it('should not crash if buildAuditEntry throws', async () => {
    mockBuildAuditEntry.mockImplementationOnce(() => {
      throw new Error('audit build failed')
    })

    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="submit"]',
      confidence: 0.95,
      explanation: 'testid estable',
      selectorType: 'TESTID',
      verified: true,
      fromRepertoire: false,
      alternatives: [],
      technicalDetails: {
        detectedIssue: 'Element not found',
        proposedSolution: 'Use data-testid',
        accessibilityCompliant: true,
        stableAgainstDOMChanges: true,
      },
    })
    mockRenderLocalReportJson.mockReturnValue('{}')

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(browser)
    const el = wrapped.$('#submit')
    await el.click()

    expect(() => plugin.flush(dir)).not.toThrow()
  })

  it('should use default project name when not provided', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="submit"]',
      confidence: 0.95,
      explanation: 'testid estable',
      selectorType: 'TESTID',
      verified: true,
      fromRepertoire: false,
      alternatives: [],
      technicalDetails: {
        detectedIssue: 'Element not found',
        proposedSolution: 'Use data-testid',
        accessibilityCompliant: true,
        stableAgainstDOMChanges: true,
      },
    })
    mockRenderLocalReportJson.mockReturnValue('{}')

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(makeBrowser(findImpl))
    const el = wrapped.$('#submit')
    await el.click()

    plugin.flush(dir)

    expect(mockWriteAuditReport).toHaveBeenCalledWith(
      expect.any(Array),
      dir,
      'webdriverio-project',
      'WebdriverIO'
    )
  })
})

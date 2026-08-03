import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WebDriver, WebElement } from 'selenium-webdriver'
import { By, error } from 'selenium-webdriver'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockAnalyzeAndHeal, mockRenderLocalReportJson, mockBuildAuditEntry, mockWriteAuditReport, mockBuildAuditFromEvent, mockFlushPlugin, mockReadRepertoire } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
  mockRenderLocalReportJson: vi.fn(),
  mockBuildAuditEntry: vi.fn(),
  mockWriteAuditReport: vi.fn(),
  mockBuildAuditFromEvent: vi.fn(),
  mockFlushPlugin: vi.fn(),
  mockReadRepertoire: vi.fn().mockReturnValue([]),
}))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return {
    ...actual,
    analyzeAndHeal: mockAnalyzeAndHeal,
    renderLocalReportJson: mockRenderLocalReportJson,
    buildAuditEntry: mockBuildAuditEntry,
    writeAuditReport: mockWriteAuditReport,
    buildAuditFromEvent: mockBuildAuditFromEvent,
    flushPlugin: mockFlushPlugin,
    readRepertoire: mockReadRepertoire,
  }
})

import { HealifySeleniumPlugin } from '../plugin'

let dir: string

beforeEach(() => {
  mockAnalyzeAndHeal.mockReset()
  mockRenderLocalReportJson.mockReset()
  mockBuildAuditEntry.mockReset()
  mockWriteAuditReport.mockReset()
  mockBuildAuditFromEvent.mockReset()
  mockFlushPlugin.mockReset()
  mockReadRepertoire.mockReset()
  mockReadRepertoire.mockReturnValue([])
  dir = mkdtempSync(join(tmpdir(), 'healify-selenium-audit-'))
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

describe('Selenium Audit Integration', () => {
  it('should generate audit entries for healed events', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const healedEl = { __tag: 'healed' } as unknown as WebElement
    const driver = {
      findElement: vi.fn()
        .mockRejectedValueOnce(originalErr)
        .mockResolvedValueOnce(healedEl),
      findElements: vi.fn(),
    } as unknown as WebDriver
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
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#submit'))

    plugin.flush(dir)

    expect(mockBuildAuditFromEvent).toHaveBeenCalledTimes(1)
    expect(mockBuildAuditFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedSelector: '[data-testid="submit"]',
        confidence: 0.95,
        verified: true,
      }),
      expect.any(Array)
    )
  })

  it('should generate audit entries for no-suggestion events', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn().mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
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
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#old')).catch(() => {})

    plugin.flush(dir)

    expect(mockBuildAuditFromEvent).toHaveBeenCalledTimes(1)
    expect(mockBuildAuditFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        confidence: 0.5,
      }),
      expect.any(Array)
    )
  })

  it('should write audit report when there are entries', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const healedEl = { __tag: 'healed' } as unknown as WebElement
    const driver = {
      findElement: vi.fn()
        .mockRejectedValueOnce(originalErr)
        .mockResolvedValueOnce(healedEl),
      findElements: vi.fn(),
    } as unknown as WebDriver
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
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifySeleniumPlugin({ projectName: 'test-project' })
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#submit'))

    plugin.flush(dir)

    expect(mockFlushPlugin).toHaveBeenCalledTimes(1)
    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'test-project',
      'Selenium'
    )
  })

  it('should not write audit report when there are no entries', async () => {
    mockRenderLocalReportJson.mockReturnValue('{}')
    mockFlushPlugin.mockReturnValue(0)

    const plugin = new HealifySeleniumPlugin()
    plugin.flush(dir)

    // flushPlugin is called but returns 0 because events array is empty
    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'selenium-project',
      'Selenium'
    )
  })

  it('should handle multiple audit entries from different failures', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const healedEl = { __tag: 'healed' } as unknown as WebElement
    const driver = {
      findElement: vi.fn()
        .mockRejectedValueOnce(originalErr)
        .mockResolvedValueOnce(healedEl)
        .mockRejectedValueOnce(originalErr)
        .mockResolvedValueOnce(healedEl),
      findElements: vi.fn(),
    } as unknown as WebDriver
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
    mockFlushPlugin.mockReturnValue(2)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#first')).catch(() => {})
    await wrapped.findElement(By.css('#second')).catch(() => {})

    plugin.flush(dir)

    expect(mockBuildAuditFromEvent).toHaveBeenCalledTimes(2)
    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'selenium-project',
      'Selenium'
    )
  })

  it('should not crash if buildAuditFromEvent encounters an error', async () => {
    // The plugin's onEvent callback wraps buildAuditFromEvent in try/catch,
    // so errors are swallowed. Test that the plugin continues to work.
    mockBuildAuditFromEvent.mockImplementation(() => {
      throw new Error('audit build failed')
    })

    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn().mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
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
    mockFlushPlugin.mockReturnValue(0)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)

    await wrapped.findElement(By.css('#submit'))

    // Plugin should not crash even though buildAuditFromEvent threw
    expect(() => plugin.flush(dir)).not.toThrow()
  })

  it('should use default project name when not provided', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const healedEl = { __tag: 'healed' } as unknown as WebElement
    const driver = {
      findElement: vi.fn()
        .mockRejectedValueOnce(originalErr)
        .mockResolvedValueOnce(healedEl),
      findElements: vi.fn(),
    } as unknown as WebDriver
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
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#submit'))

    plugin.flush(dir)

    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'selenium-project',
      'Selenium'
    )
  })
})

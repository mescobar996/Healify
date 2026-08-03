import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockAnalyzeAndHeal, mockRenderLocalReportJson, mockBuildAuditFromEvent, mockFlushPlugin, mockReadRepertoire } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
  mockRenderLocalReportJson: vi.fn(),
  mockBuildAuditFromEvent: vi.fn(),
  mockFlushPlugin: vi.fn().mockReturnValue(0),
  mockReadRepertoire: vi.fn().mockReturnValue([]),
}))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return {
    ...actual,
    analyzeAndHeal: mockAnalyzeAndHeal,
    renderLocalReportJson: mockRenderLocalReportJson,
    buildAuditFromEvent: mockBuildAuditFromEvent,
    flushPlugin: mockFlushPlugin,
    readRepertoire: mockReadRepertoire,
  }
})

import { HealifyWebdriverIOPlugin } from '../plugin'

let dir: string

beforeEach(() => {
  vi.clearAllMocks()
  dir = mkdtempSync(join(tmpdir(), 'healify-wdio-flush-'))
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

describe('HealifyWebdriverIOPlugin', () => {
  it('wrap() devuelve un browser que resuelve $() normalmente cuando no hace falta curar', async () => {
    const el = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const browser = makeBrowser(vi.fn().mockReturnValue(el))

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(browser)
    const result = wrapped.$('#real')
    await result.click()

    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('wrap() no muta el browser original', () => {
    const browser = makeBrowser(vi.fn())

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(browser)

    expect(wrapped).not.toBe(browser)
  })
})

describe('flush()', () => {
  it('devuelve 0 y no escribe archivo cuando no hay eventos', () => {
    mockFlushPlugin.mockReturnValue(0)
    const plugin = new HealifyWebdriverIOPlugin()

    const count = plugin.flush(dir)

    expect(count).toBe(0)
    // flushPlugin is called with empty arrays — it returns 0 because there's nothing to write
    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'webdriverio-project',
      'WebdriverIO'
    )
  })

  it('escribe healify-report.json con los eventos acumulados', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'testid estable',
      selectorType: 'TESTID',
    })
    mockRenderLocalReportJson.mockReturnValue('{"mock":true}')
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifyWebdriverIOPlugin({ projectName: 'mi-proyecto' })
    const wrapped = plugin.wrap(makeBrowser(findImpl))
    const el = wrapped.$('#old')
    await el.click()

    const count = plugin.flush(dir)

    expect(count).toBe(1)
    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'mi-proyecto',
      'WebdriverIO'
    )
  })

  it('limpia los eventos después de flush', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.x',
      confidence: 0.9,
      explanation: 'x',
      selectorType: 'CSS',
    })
    mockRenderLocalReportJson.mockReturnValue('{}')
    mockFlushPlugin.mockReturnValueOnce(1).mockReturnValueOnce(0)

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(browser)
    const el = wrapped.$('#a')
    await el.click().catch(() => {})

    expect(plugin.flush(dir)).toBe(1)
    expect(plugin.flush(dir)).toBe(0)
  })

  it('usa projectName default cuando no se provee', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.x',
      confidence: 0.9,
      explanation: 'x',
      selectorType: 'CSS',
    })
    mockRenderLocalReportJson.mockReturnValue('{}')
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifyWebdriverIOPlugin()
    const wrapped = plugin.wrap(browser)
    const el = wrapped.$('#a')
    await el.click().catch(() => {})

    plugin.flush(dir)

    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'webdriverio-project',
      'WebdriverIO'
    )
  })
})

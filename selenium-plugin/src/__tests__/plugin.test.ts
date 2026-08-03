import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WebDriver, WebElement } from 'selenium-webdriver'
import { By, error } from 'selenium-webdriver'
import { mkdtempSync, rmSync } from 'node:fs'
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

import { HealifySeleniumPlugin } from '../plugin'

let dir: string

beforeEach(() => {
  vi.clearAllMocks()
  dir = mkdtempSync(join(tmpdir(), 'healify-selenium-flush-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('HealifySeleniumPlugin', () => {
  it('wrap() devuelve un driver que resuelve findElement normalmente cuando no hace falta curar', async () => {
    const el = { __tag: 'real' } as unknown as WebElement
    const driver = {
      findElement: vi.fn().mockResolvedValue(el),
      findElements: vi.fn(),
    } as unknown as WebDriver

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    const result = await wrapped.findElement(By.css('#real'))

    expect(result).toBe(el)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('wrap() no muta el driver original — el original sigue siendo el objeto pasado', () => {
    const driver = {
      findElement: vi.fn(),
      findElements: vi.fn(),
    } as unknown as WebDriver

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)

    expect(wrapped).not.toBe(driver)
  })

  it('pasa las opciones (confidenceThreshold, onEvent) a wrapDriver', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn().mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
    mockAnalyzeAndHeal.mockReturnValue({ fixedSelector: '.x', confidence: 0.5, explanation: '', selectorType: 'CSS' })
    const onEvent = vi.fn()

    const plugin = new HealifySeleniumPlugin({ confidenceThreshold: 0.9, onEvent })
    const wrapped = plugin.wrap(driver)

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'no-suggestion' }))
  })
})

describe('flush()', () => {
  it('devuelve 0 y no escribe archivo cuando no hay eventos', () => {
    mockFlushPlugin.mockReturnValue(0)
    const plugin = new HealifySeleniumPlugin()

    const count = plugin.flush(dir)

    expect(count).toBe(0)
    // flushPlugin is called with empty arrays — it returns 0 because there's nothing to write
    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'selenium-project',
      'Selenium'
    )
  })

  it('escribe healify-report.json con los eventos acumulados', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const healedEl = { __tag: 'healed' } as unknown as WebElement
    const driver = {
      findElement: vi.fn()
        .mockRejectedValueOnce(originalErr)
        .mockResolvedValueOnce(healedEl),
      findElements: vi.fn(),
    } as unknown as WebDriver
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'testid estable',
      selectorType: 'TESTID',
    })
    mockRenderLocalReportJson.mockReturnValue('{"mock":true}')
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifySeleniumPlugin({ projectName: 'mi-proyecto' })
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#old'))

    const count = plugin.flush(dir)

    expect(count).toBe(1)
    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'mi-proyecto',
      'Selenium'
    )
  })

  it('limpia los eventos después de flush (no duplica en el próximo flush)', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn().mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.x',
      confidence: 0.9,
      explanation: 'x',
      selectorType: 'CSS',
    })
    mockRenderLocalReportJson.mockReturnValue('{}')
    mockFlushPlugin.mockReturnValueOnce(1).mockReturnValueOnce(0)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#a'))

    expect(plugin.flush(dir)).toBe(1)
    expect(plugin.flush(dir)).toBe(0)
  })

  it('acumula eventos de múltiples findElements fallidos', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn()
        .mockRejectedValueOnce(originalErr)
        .mockRejectedValueOnce(originalErr)
        .mockRejectedValueOnce(originalErr)
        .mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.stable',
      confidence: 0.92,
      explanation: 'x',
      selectorType: 'CSS',
    })
    mockRenderLocalReportJson.mockReturnValue('{}')
    mockFlushPlugin.mockReturnValue(2)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#a')).catch(() => {})
    await wrapped.findElement(By.css('#b')).catch(() => {})

    expect(plugin.flush(dir)).toBe(2)
  })

  it('usa projectName default cuando no se provee', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn().mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.x',
      confidence: 0.9,
      explanation: 'x',
      selectorType: 'CSS',
    })
    mockRenderLocalReportJson.mockReturnValue('{}')
    mockFlushPlugin.mockReturnValue(1)

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#a'))

    plugin.flush(dir)

    expect(mockFlushPlugin).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      dir,
      'selenium-project',
      'Selenium'
    )
  })

  it('el onEvent del usuario sigue funcionando junto con la acumulación interna', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn()
        .mockRejectedValueOnce(originalErr)
        .mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.x',
      confidence: 0.9,
      explanation: 'x',
      selectorType: 'CSS',
    })
    mockRenderLocalReportJson.mockReturnValue('{}')
    mockFlushPlugin.mockReturnValue(1)
    const userOnEvent = vi.fn()

    const plugin = new HealifySeleniumPlugin({ onEvent: userOnEvent })
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#a')).catch(() => {})

    expect(userOnEvent).toHaveBeenCalled()
    expect(plugin.flush(dir)).toBe(1)
  })
})

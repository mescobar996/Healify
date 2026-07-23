import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WebDriver, WebElement } from 'selenium-webdriver'
import { By, error } from 'selenium-webdriver'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockAnalyzeAndHeal, mockRenderLocalReportJson } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
  mockRenderLocalReportJson: vi.fn(),
}))

vi.mock('@healify/reporter-core', () => ({
  analyzeAndHeal: mockAnalyzeAndHeal,
  renderLocalReportJson: mockRenderLocalReportJson,
}))

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
    mockRenderLocalReportJson.mockReturnValue('{}')
    const plugin = new HealifySeleniumPlugin()

    const count = plugin.flush(dir)

    expect(count).toBe(0)
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

    const plugin = new HealifySeleniumPlugin({ projectName: 'mi-proyecto' })
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#old'))

    const count = plugin.flush(dir)

    expect(count).toBe(1)
    const written = readFileSync(join(dir, 'healify-report.json'), 'utf-8')
    expect(written).toBe('{"mock":true}')
    expect(mockRenderLocalReportJson).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'mi-proyecto',
        framework: 'Selenium',
        cases: expect.arrayContaining([
          expect.objectContaining({
            selector: '#old',
            fixedSelector: '[data-testid="real"]',
            confidence: 0.95,
          }),
        ]),
      })
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

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#a'))

    plugin.flush(dir)

    expect(mockRenderLocalReportJson).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'selenium-project' })
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
    const userOnEvent = vi.fn()

    const plugin = new HealifySeleniumPlugin({ onEvent: userOnEvent })
    const wrapped = plugin.wrap(driver)
    await wrapped.findElement(By.css('#a')).catch(() => {})

    expect(userOnEvent).toHaveBeenCalled()
    expect(plugin.flush(dir)).toBe(1)
  })
})

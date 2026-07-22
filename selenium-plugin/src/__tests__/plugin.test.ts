import { describe, it, expect, vi } from 'vitest'
import type { WebDriver, WebElement } from 'selenium-webdriver'
import { By, error } from 'selenium-webdriver'

const { mockAnalyzeAndHeal } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
}))

vi.mock('@healify/reporter-core', () => ({
  analyzeAndHeal: mockAnalyzeAndHeal,
}))

import { HealifySeleniumPlugin } from '../plugin'

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

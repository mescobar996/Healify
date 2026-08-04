import { describe, it, expect, vi, beforeEach } from 'vitest'
import { By, error, type WebDriver, type WebElement } from 'selenium-webdriver'

const { mockAnalyzeAndHeal } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
}))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return { ...actual, analyzeAndHeal: mockAnalyzeAndHeal }
})

import { wrapDriver } from '../wrap'

function makeElement(tag: string): WebElement {
  return { __tag: tag } as unknown as WebElement
}

function makeDriver(findElementImpl: ReturnType<typeof vi.fn>): WebDriver {
  return {
    findElement: findElementImpl,
    findElements: vi.fn().mockResolvedValue([]),
  } as unknown as WebDriver
}

const NO_SUCH_ELEMENT = () => new error.NoSuchElementError('no such element: Unable to locate element')
const STALE_ELEMENT = () => new error.StaleElementReferenceError('stale element reference')

describe('wrapDriver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve el elemento cuando el locator original funciona — no invoca analyzeAndHeal', async () => {
    const el = makeElement('real')
    const findElement = vi.fn().mockResolvedValue(el)
    const wrapped = wrapDriver(makeDriver(findElement))

    const result = await wrapped.findElement(By.css('#real'))

    expect(result).toBe(el)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('cura con éxito cuando el original lanza NoSuchElementError y la sugerencia encuentra el elemento', async () => {
    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(NO_SUCH_ELEMENT())
      .mockResolvedValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'testid estable detectado',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    const result = await wrapped.findElement(By.css('#old'))

    expect(result).toBe(healedEl)
    expect(findElement).toHaveBeenCalledTimes(2)
    expect(findElement).toHaveBeenNthCalledWith(2, By.css('[data-testid="real"]'))
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'healed',
        originalSelector: '#old',
        fixedSelector: '[data-testid="real"]',
        confidence: 0.95,
      })
    )
  })

  it('reporta sin sugerencia cuando la confianza queda debajo del threshold — lanza el error original', async () => {
    const findElement = vi.fn().mockRejectedValueOnce(NO_SUCH_ELEMENT())
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: 'visible=old',
      confidence: 0.75,
      explanation: 'sin candidato confiable',
      selectorType: 'CSS',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBeInstanceOf(error.NoSuchElementError)
    expect(findElement).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'no-suggestion', originalSelector: '#old', confidence: 0.75 })
    )
  })

  it('propaga errores que NO son NoSuchElementError sin intentar curar', async () => {
    const staleErr = STALE_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(staleErr)
    const wrapped = wrapDriver(makeDriver(findElement))

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(staleErr)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('un error interno de analyzeAndHeal no rompe el test del usuario — lanza el error original y reporta el detalle', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    mockAnalyzeAndHeal.mockImplementation(() => {
      throw new Error('boom interno de la heurística')
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', originalSelector: '#old', explanation: 'boom interno de la heurística' })
    )
  })

  it('dryRun=true emite el evento healed pero lanza el error original, sin aplicar el fix', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { dryRun: true, onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(findElement).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'healed', fixedSelector: '[data-testid="real"]' }))
  })

  it('locator no convertible (By.linkText) no intenta curar', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.linkText('Home'))).rejects.toBe(originalErr)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'not-convertible', originalSelector: 'Home' }))
  })

  it('si el retry con la sugerencia también falla, lanza el error original — no uno sintético', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const retryErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn()
      .mockRejectedValueOnce(originalErr)
      .mockRejectedValueOnce(retryErr)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'failed', originalSelector: '#old' }))
  })

  it('findElements (plural) llama directo al método real, sin pasar por el flujo de curado', async () => {
    const driver = makeDriver(vi.fn())
    const wrapped = wrapDriver(driver)

    await wrapped.findElements(By.css('.item'))

    expect(driver.findElements).toHaveBeenCalledWith(By.css('.item'))
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('respeta un confidenceThreshold custom', async () => {
    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(NO_SUCH_ELEMENT())
      .mockResolvedValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.stable',
      confidence: 0.78,
      explanation: 'x',
      selectorType: 'CSS',
    })
    const wrapped = wrapDriver(makeDriver(findElement), { confidenceThreshold: 0.7 })

    const result = await wrapped.findElement(By.css('#old'))

    expect(result).toBe(healedEl)
  })

  it('sugerencia sin sintaxis CSS (visible=) que tampoco es rol se trata como sin sugerencia', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "button:has-text('Add')",
      confidence: 0.92,
      explanation: 'x',
      selectorType: 'TEXT',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(findElement).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'no-suggestion',
        originalSelector: '#old',
        fixedSelector: "button:has-text('Add')",
      })
    )
  })

  it('sugerencia role(...) con nombre se convierte a XPath y SÍ reintenta — Selenium no interpreta la sintaxis de Playwright, pero puede reubicar el elemento por rol+nombre', async () => {
    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(NO_SUCH_ELEMENT())
      .mockResolvedValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "role('button', { name: 'Comprar' })",
      confidence: 0.97,
      explanation: 'x',
      selectorType: 'ROLE',
      verified: true,
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    const result = await wrapped.findElement(By.css('#old'))

    expect(result).toBe(healedEl)
    expect(findElement).toHaveBeenCalledTimes(2)
    const retryLocator = findElement.mock.calls[1][0]
    expect(retryLocator.using).toBe('xpath')
    expect(retryLocator.value).toContain("normalize-space(.)='Comprar'")
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'healed', fixedSelector: "role('button', { name: 'Comprar' })" })
    )
  })

  it('sugerencia role(...) SIN nombre no tiene con qué armar un XPath confiable — se trata como sin sugerencia', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "role('button')",
      confidence: 0.82,
      explanation: 'x',
      selectorType: 'ROLE',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(findElement).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'no-suggestion' }))
  })

  it('sondea el DOM real (executeScript) y se lo pasa a analyzeAndHeal como htmlContext', async () => {
    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(NO_SUCH_ELEMENT())
      .mockResolvedValueOnce(healedEl)
    // executeScript se usa para dos cosas: sondear la pagina y, si la sugerencia es de rol,
    // buscar el elemento atravesando shadow roots. El mock distingue por script, como el driver
    // real: el sondeo devuelve elementos, el buscador devuelve null (no hay shadow DOM aca) y
    // el flujo cae al findElement con el locator.
    const executeScript = vi.fn().mockImplementation((script: string) =>
      Promise.resolve(script.includes('healifySearch') ? null : [{ role: 'button', name: 'Comprar' }])
    )
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "role('button', { name: 'Comprar' })",
      confidence: 0.97,
      explanation: 'x',
      selectorType: 'ROLE',
    })
    const driver = { ...makeDriver(findElement), executeScript }
    const wrapped = wrapDriver(driver as unknown as WebDriver)

    const result = await wrapped.findElement(By.css('#old'))

    expect(result).toBe(healedEl)
    expect(mockAnalyzeAndHeal).toHaveBeenCalledWith(
      expect.objectContaining({ htmlContext: expect.stringContaining('button "Comprar"') })
    )
  })

  it('si executeScript tira (sesión rara, browser sin JS) no rompe nada — sigue con la heurística a ciegas', async () => {
    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(NO_SUCH_ELEMENT())
      .mockResolvedValueOnce(healedEl)
    const executeScript = vi.fn().mockRejectedValue(new Error('sesión cerrada'))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const driver = { ...makeDriver(findElement), executeScript }
    const wrapped = wrapDriver(driver as unknown as WebDriver)

    const result = await wrapped.findElement(By.css('#old'))

    expect(result).toBe(healedEl)
    expect(mockAnalyzeAndHeal).toHaveBeenCalledWith(expect.objectContaining({ htmlContext: undefined }))
  })
})

/**
 * Regresión del bug que dejaba el adapter completamente mudo, encontrado corriendo Selenium de
 * verdad (`examples/selenium-live-heal`) y no en estos tests: acá el mock y el plugin comparten
 * la misma instancia de `selenium-webdriver`, así que `instanceof` funcionaba siempre y el bug
 * era invisible.
 */
describe('wrapDriver — deteccion del error sin depender de instanceof', () => {
  it('cura aunque el NoSuchElementError venga de OTRA instancia de selenium-webdriver', async () => {
    // Reproduce lo que pasa con un monorepo, pnpm o dos versiones en el arbol: el error es el
    // correcto pero su clase es otra referencia, y `err instanceof error.NoSuchElementError`
    // da false. El sintoma era total y silencioso: el wrapper salia por la primera guarda y
    // Healify no curaba absolutamente nunca.
    class NoSuchElementError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'NoSuchElementError'
      }
    }

    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(new NoSuchElementError('no such element'))
      .mockResolvedValueOnce(healedEl)
    const executeScript = vi.fn().mockResolvedValue(null)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "[data-testid='guardar']",
      confidence: 0.97,
      explanation: 'x',
      selectorType: 'TESTID',
    })

    const driver = { ...makeDriver(findElement), executeScript }
    const wrapped = wrapDriver(driver as unknown as WebDriver)

    expect(await wrapped.findElement(By.css('#old'))).toBe(healedEl)
  })

  it('un error que no es de elemento no encontrado se re-lanza sin tocar nada', () => {
    const findElement = vi.fn().mockRejectedValue(new Error('sesion cerrada'))
    const driver = { ...makeDriver(findElement), executeScript: vi.fn() }
    const wrapped = wrapDriver(driver as unknown as WebDriver)

    return expect(wrapped.findElement(By.css('#old'))).rejects.toThrow('sesion cerrada')
  })
})

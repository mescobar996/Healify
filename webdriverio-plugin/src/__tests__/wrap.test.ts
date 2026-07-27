import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAnalyzeAndHeal } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
}))

vi.mock('@healify/reporter-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@healify/reporter-core')>()
  return { ...actual, analyzeAndHeal: mockAnalyzeAndHeal }
})

import { wrapBrowser } from '../wrap'

function makeWdioElement(methods: Record<string, unknown> = {}) {
  return {
    click: vi.fn(),
    setValue: vi.fn(),
    getText: vi.fn().mockResolvedValue(''),
    waitForExist: vi.fn(),
    ...methods,
  }
}

function makeBrowser(findImpl: ReturnType<typeof vi.fn> = vi.fn()) {
  return {
    $: findImpl,
    url: vi.fn(),
    waitUntil: vi.fn(),
  }
}

function noSuchElement(msg = 'Can\'t find element with selector: #old') {
  return new Error(msg)
}

describe('wrapBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve el elemento cuando el selector original funciona — no invoca analyzeAndHeal', async () => {
    const el = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const browser = makeBrowser(vi.fn().mockReturnValue(el))
    const wrapped = wrapBrowser(browser)

    const result = wrapped.$('#real')
    await result.click()
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('cura cuando click() tira no-such-element y la sugerencia CSS encuentra el elemento', async () => {
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
    const onEvent = vi.fn()
    const browser = makeBrowser(findImpl)
    const wrapped = wrapBrowser(browser, { onEvent })

    const el = wrapped.$('#old')
    await el.click()

    expect(findImpl).toHaveBeenCalledTimes(2)
    expect(findImpl).toHaveBeenNthCalledWith(2, '[data-testid="real"]')
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'healed',
        originalSelector: '#old',
        fixedSelector: '[data-testid="real"]',
        confidence: 0.95,
      })
    )
  })

  it('reporta no-suggestion cuando la confianza queda debajo del threshold', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: 'visible=old',
      confidence: 0.75,
      explanation: 'sin candidato confiable',
      selectorType: 'CSS',
    })
    const onEvent = vi.fn()
    const wrapped = wrapBrowser(browser, { onEvent })

    const el = wrapped.$('#old')
    await expect(el.click()).rejects.toThrow('no confident suggestion')
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'no-suggestion', originalSelector: '#old', confidence: 0.75 })
    )
  })

  it('dryRun=true emite healed pero lanza error sin aplicar el fix', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const wrapped = wrapBrowser(browser, { dryRun: true, onEvent })

    const el = wrapped.$('#old')
    await expect(el.click()).rejects.toThrow('dry run')
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'healed', fixedSelector: '[data-testid="real"]' }))
  })

  it('error que NO es no-such-element se propaga sin curar', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(new Error('stale element')) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    const wrapped = wrapBrowser(browser)

    const el = wrapped.$('#old')
    await expect(el.click()).rejects.toThrow('stale element')
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('sugerencia sin sintaxis CSS y sin rol se trata como no-suggestion', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "button:has-text('Add')",
      confidence: 0.92,
      explanation: 'x',
      selectorType: 'TEXT',
    })
    const onEvent = vi.fn()
    const wrapped = wrapBrowser(browser, { onEvent })

    const el = wrapped.$('#old')
    await expect(el.click()).rejects.toThrow('not locatable')
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'no-suggestion', fixedSelector: "button:has-text('Add')" })
    )
  })

  it('sugerencia role(...) con nombre se convierte a XPath y SÍ reintenta — WebdriverIO no interpreta la sintaxis de Playwright, pero puede reubicar el elemento por rol+nombre', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "role('button', { name: 'Comprar' })",
      confidence: 0.97,
      explanation: 'x',
      selectorType: 'ROLE',
      verified: true,
    })
    const onEvent = vi.fn()
    const browser = makeBrowser(findImpl)
    const wrapped = wrapBrowser(browser, { onEvent })

    const el = wrapped.$('#old')
    await el.click()

    expect(findImpl).toHaveBeenCalledTimes(2)
    const retrySelector = findImpl.mock.calls[1][0]
    expect(retrySelector).toMatch(/^\/\//)
    expect(retrySelector).toContain("normalize-space(.)='Comprar'")
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'healed', fixedSelector: "role('button', { name: 'Comprar' })" })
    )
  })

  it('sugerencia role(...) SIN nombre no tiene con qué armar un XPath confiable — se trata como sin sugerencia', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "role('button')",
      confidence: 0.92,
      explanation: 'x',
      selectorType: 'ROLE',
    })
    const onEvent = vi.fn()
    const wrapped = wrapBrowser(browser, { onEvent })

    const el = wrapped.$('#old')
    await expect(el.click()).rejects.toThrow('not locatable')
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'no-suggestion' }))
  })

  it('sondea el DOM real (execute) y se lo pasa a analyzeAndHeal como htmlContext', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const execute = vi.fn().mockResolvedValue([{ role: 'button', name: 'Comprar' }])
    const browser = { ...makeBrowser(vi.fn().mockReturnValue(originalEl)), execute }
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "role('button', { name: 'Comprar' })",
      confidence: 0.97,
      explanation: 'x',
      selectorType: 'ROLE',
    })
    const wrapped = wrapBrowser(browser as unknown as Parameters<typeof wrapBrowser>[0])

    const el = wrapped.$('#old')
    await el.click().catch(() => {}) // el retry puede fallar acá (mismo mock devuelve el original), no es el punto del test

    expect(execute).toHaveBeenCalledTimes(1)
    expect(mockAnalyzeAndHeal).toHaveBeenCalledWith(
      expect.objectContaining({ htmlContext: expect.stringContaining('button "Comprar"') })
    )
  })

  it('si execute() tira (sesión rara, browser sin JS) no rompe nada — sigue con la heurística a ciegas', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    const execute = vi.fn().mockRejectedValue(new Error('sesión cerrada'))
    const browser = { ...makeBrowser(findImpl), execute }
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const wrapped = wrapBrowser(browser as unknown as Parameters<typeof wrapBrowser>[0])

    const el = wrapped.$('#old')
    await el.click()

    expect(mockAnalyzeAndHeal).toHaveBeenCalledWith(expect.objectContaining({ htmlContext: undefined }))
  })

  it('respeta un confidenceThreshold custom', async () => {
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(originalEl)
      .mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.stable',
      confidence: 0.78,
      explanation: 'x',
      selectorType: 'CSS',
    })
    const browser = makeBrowser(findImpl)
    const wrapped = wrapBrowser(browser, { confidenceThreshold: 0.7 })

    const el = wrapped.$('#old')
    await el.click()

    expect(findImpl).toHaveBeenCalledTimes(2)
  })

  it('si el retry con la sugerencia también falla, reporta failed', async () => {
    const failEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const findImpl = vi.fn()
      .mockReturnValueOnce(failEl)
      .mockImplementationOnce(() => { throw new Error('element not found in DOM') })
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const browser = makeBrowser(findImpl)
    const wrapped = wrapBrowser(browser, { onEvent })

    const el = wrapped.$('#old')
    await expect(el.click()).rejects.toThrow('also failed')
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'failed', originalSelector: '#old' }))
  })
})

describe('isNoElementError — reconoce el wording real de WebdriverIO 9.x', () => {
  it('cura con el mensaje real que devuelve wdio 9.x al fallar un click (verificado contra chromedriver real)', async () => {
    // Antes de este fix, "...because element wasn't found" no matcheaba ningún patrón
    // reconocido y el healing nunca se disparaba en la práctica, aunque los tests con el
    // wording viejo ("Can't find element...") pasaran igual.
    const healedEl = makeWdioElement({ click: vi.fn().mockResolvedValue(undefined) })
    const originalEl = makeWdioElement({
      click: vi.fn().mockRejectedValue(new Error(`Can't call click on element with selector "#old" because element wasn't found`)),
    })
    const findImpl = vi.fn().mockReturnValueOnce(originalEl).mockReturnValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const browser = makeBrowser(findImpl)
    const wrapped = wrapBrowser(browser)

    const el = wrapped.$('#old')
    await el.click()

    expect(findImpl).toHaveBeenCalledTimes(2)
  })
})

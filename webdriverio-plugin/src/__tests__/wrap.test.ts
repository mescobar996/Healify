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

  it('sugerencia no CSS-compatible se trata como no-suggestion', async () => {
    const originalEl = makeWdioElement({ click: vi.fn().mockRejectedValue(noSuchElement()) })
    const browser = makeBrowser(vi.fn().mockReturnValue(originalEl))
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: "role('button', { name: 'Add' })",
      confidence: 0.92,
      explanation: 'x',
      selectorType: 'ROLE',
    })
    const onEvent = vi.fn()
    const wrapped = wrapBrowser(browser, { onEvent })

    const el = wrapped.$('#old')
    await expect(el.click()).rejects.toThrow('not CSS-compatible')
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'no-suggestion', fixedSelector: "role('button', { name: 'Add' })" })
    )
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

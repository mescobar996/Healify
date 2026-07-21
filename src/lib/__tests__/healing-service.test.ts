import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock global fetch (usado por local-llm-client.ts para hablar con Ollama) ──
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { analyzeBrokenSelector } = await import('@/lib/ai/healing-service')

const DOM_WITH_TESTID = `<div><button data-testid="submit-form" class="btn">Enviar</button></div>`
const DOM_WITH_ARIA   = `<div><button aria-label="Cerrar modal" class="x">×</button></div>`
const DOM_PLAIN       = `<div><button class="btn-unknown-123">Click</button></div>`

function mockOllamaSuccess(content: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ message: { content } }),
  })
}

function mockOllamaJsonSuccess(json: object) {
  mockOllamaSuccess(JSON.stringify(json))
}

function mockOllamaFail() {
  mockFetch.mockRejectedValue(new Error('Ollama unavailable'))
}

// ══════════════════════════════════════════════════════════════════════
describe('analyzeBrokenSelector — LLM local (Ollama)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Ollama exitoso → retorna sugerencia del modelo', async () => {
    mockOllamaJsonSuccess({ newSelector: '[data-testid="submit-btn"]', selectorType: 'TESTID', confidence: 0.97, reasoning: 'stable testid' })
    const r = await analyzeBrokenSelector('.old', 'not found', DOM_WITH_TESTID)
    expect(r).not.toBeNull()
    expect(r?.newSelector).toBe('[data-testid="submit-btn"]')
    expect(r?.confidence).toBe(0.97)
    expect(r?.selectorType).toBe('TESTID')
    expect(typeof r?.reasoning).toBe('string')
  })

  it('Ollama responde con markdown ```json block → parsea OK', async () => {
    mockOllamaSuccess('```json\n{"newSelector":"#app > button","selectorType":"CSS","confidence":0.85,"reasoning":"direct"}\n```')
    const r = await analyzeBrokenSelector('.old', 'err', DOM_PLAIN)
    expect(r?.newSelector).toBe('#app > button')
    expect(r?.confidence).toBe(0.85)
  })

  it('Ollama respuesta sin newSelector → cae a fallback', async () => {
    mockOllamaJsonSuccess({ reasoning: 'sin selector' }) // falta newSelector
    const r = await analyzeBrokenSelector('.old', 'err', DOM_WITH_TESTID)
    // fallback debe encontrar el data-testid del DOM
    expect(r).not.toBeNull()
    expect(r?.newSelector).toContain('submit-form')
  })

  it('Ollama confidence fuera de rango → sigue siendo número válido', async () => {
    mockOllamaJsonSuccess({ newSelector: '.x', selectorType: 'CSS', confidence: 1.5, reasoning: 'ok' })
    const r = await analyzeBrokenSelector('.old', 'err', DOM_PLAIN)
    // Si el modelo devuelve valor, lo usa — si no, fallback
    expect(r).not.toBeNull()
    expect(typeof r?.confidence).toBe('number')
  })

  it('Ollama responde con HTTP no-ok → cae a fallback', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'internal error' })
    const r = await analyzeBrokenSelector('.old', 'err', DOM_WITH_TESTID)
    expect(r).not.toBeNull()
    expect(r?.newSelector).toContain('submit-form')
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('analyzeBrokenSelector — fallback determinístico', () => {
  beforeEach(() => { vi.clearAllMocks(); mockOllamaFail() })

  it('DOM con data-testid → selector TESTID, confidence > 0.8', async () => {
    const r = await analyzeBrokenSelector('.broken', 'not found', DOM_WITH_TESTID)
    expect(r).not.toBeNull()
    expect(r?.newSelector).toContain('data-testid')
    expect(r?.selectorType).toBe('TESTID')
    expect(r?.confidence).toBeGreaterThan(0.8)
  })

  it('DOM con aria-label (sin testid) → selector aria, confidence > 0.7', async () => {
    const r = await analyzeBrokenSelector('.broken', 'not found', DOM_WITH_ARIA)
    expect(r?.newSelector).toContain('aria-label')
    expect(r?.confidence).toBeGreaterThan(0.7)
  })

  it('DOM sin selectores estables → devuelve original, confidence ≤ 0.5', async () => {
    const r = await analyzeBrokenSelector('.original', 'not found', DOM_PLAIN)
    expect(r).not.toBeNull()
    expect(r?.newSelector).toBe('.original')
    expect(r?.confidence).toBeLessThanOrEqual(0.5)
  })

  it('DOM vacío → nunca retorna null', async () => {
    const r = await analyzeBrokenSelector('', '', '')
    expect(r).not.toBeNull()
    expect(typeof r?.confidence).toBe('number')
  })

  it('selector con data-testid en DOM → confidence > 0.8', async () => {
    const dom = `<form><input data-testid="email-input" type="email"/></form>`
    const r = await analyzeBrokenSelector('#old-email', 'err', dom)
    expect(r?.confidence).toBeGreaterThan(0.8)
    expect(r?.newSelector).toContain('email-input')
  })

  it('selector fallback nunca retorna undefined reasoning', async () => {
    const r = await analyzeBrokenSelector('.x', 'err', DOM_PLAIN)
    expect(typeof r?.reasoning).toBe('string')
    expect(r!.reasoning.length).toBeGreaterThan(0)
  })
})

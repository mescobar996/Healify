import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ── Set env before imports so getClient() doesn't throw ────────────────
beforeAll(() => { process.env.ANTHROPIC_API_KEY = 'sk-test-mock-key' })

// ── Mock Anthropic SDK ─────────────────────────────────────────────────
const mockMessagesCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate }
  }
}))

const { analyzeBrokenSelector } = await import('@/lib/ai/healing-service')

const DOM_WITH_TESTID = `<div><button data-testid="submit-form" class="btn">Enviar</button></div>`
const DOM_WITH_ARIA   = `<div><button aria-label="Cerrar modal" class="x">×</button></div>`
const DOM_PLAIN       = `<div><button class="btn-unknown-123">Click</button></div>`

function mockClaudeSuccess(json: object) {
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(json) }]
  })
}

function mockClaudeFail() {
  mockMessagesCreate.mockRejectedValue(new Error('Claude unavailable'))
}

// ══════════════════════════════════════════════════════════════════════
describe('analyzeBrokenSelector — Claude real', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Claude exitoso → retorna sugerencia del modelo', async () => {
    mockClaudeSuccess({ newSelector: '[data-testid="submit-btn"]', selectorType: 'TESTID', confidence: 0.97, reasoning: 'stable testid' })
    const r = await analyzeBrokenSelector('.old', 'not found', DOM_WITH_TESTID)
    expect(r).not.toBeNull()
    expect(r?.newSelector).toBe('[data-testid="submit-btn"]')
    expect(r?.confidence).toBe(0.97)
    expect(r?.selectorType).toBe('TESTID')
    expect(typeof r?.reasoning).toBe('string')
  })

  it('Claude responde con markdown ```json block → parsea OK', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"newSelector":"#app > button","selectorType":"CSS","confidence":0.85,"reasoning":"direct"}\n```' }]
    })
    const r = await analyzeBrokenSelector('.old', 'err', DOM_PLAIN)
    expect(r?.newSelector).toBe('#app > button')
    expect(r?.confidence).toBe(0.85)
  })

  it('Claude respuesta sin newSelector → cae a fallback', async () => {
    mockClaudeSuccess({ reasoning: 'sin selector' }) // falta newSelector
    const r = await analyzeBrokenSelector('.old', 'err', DOM_WITH_TESTID)
    // fallback debe encontrar el data-testid del DOM
    expect(r).not.toBeNull()
    expect(r?.newSelector).toContain('submit-form')
  })

  it('Claude confidence fuera de rango → sigue siendo número válido', async () => {
    mockClaudeSuccess({ newSelector: '.x', selectorType: 'CSS', confidence: 1.5, reasoning: 'ok' })
    const r = await analyzeBrokenSelector('.old', 'err', DOM_PLAIN)
    // Si Claude devuelve valor, lo usa — si no, fallback
    expect(r).not.toBeNull()
    expect(typeof r?.confidence).toBe('number')
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('analyzeBrokenSelector — fallback determinístico', () => {
  beforeEach(() => { vi.clearAllMocks(); mockClaudeFail() })

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

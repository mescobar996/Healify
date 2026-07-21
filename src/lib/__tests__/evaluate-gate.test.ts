import { describe, it, expect } from 'vitest'
import { evaluateGate } from '@/lib/gate/evaluate-gate'

describe('evaluateGate — low_confidence', () => {
  it('bloquea cuando confidence < threshold', () => {
    const result = evaluateGate({
      confidence: 0.80,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'low_confidence', confidence: 0.80, threshold: 0.95 })
  })

  it('confidence exactamente igual al threshold: pasa (no bloquea)', () => {
    const result = evaluateGate({
      confidence: 0.95,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    expect(result.blockedBy.find(r => r.code === 'low_confidence')).toBeUndefined()
  })
})

describe('evaluateGate — fragile_selector', () => {
  it('bloquea un selector nth-child (score < 0.40)', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: 'div:nth-child(3)',
      selectorType: 'CSS',
      threshold: 0.85,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy.some(r => r.code === 'fragile_selector')).toBe(true)
  })

  it('no bloquea un data-testid robusto', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.85,
    })
    expect(result.pass).toBe(true)
  })
})

describe('evaluateGate — not_unique', () => {
  const htmlTwoMatches = '<button id="login-btn">A</button><button id="login-btn">B</button>'
  const htmlOneMatch = '<button id="login-btn">A</button>'

  it('bloquea cuando el selector matchea más de un elemento', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#login-btn',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlTwoMatches,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'not_unique', matches: 2 })
  })

  it('no bloquea cuando el selector matchea exactamente un elemento', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#login-btn',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlOneMatch,
    })
    expect(result.pass).toBe(true)
  })

  it('no bloquea cuando el selector no aparece (0 matches — puede ser truncamiento del snapshot)', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#does-not-exist',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlOneMatch,
    })
    expect(result.pass).toBe(true)
  })

  it('no bloquea selectores complejos (indeterminado: combinadores/pseudo-clases no se cuentan)', () => {
    // Nota: se usa [disabled] en vez de .disabled — la clase ".disabled" (8 chars)
    // dispara el heurístico preexistente de SelectorAnalyzer para "clases ofuscadas"
    // (/\.[a-z0-9]{5,}/i), lo cual añadiría fragile_selector y contaminaría este test,
    // que busca aislar el comportamiento de not_unique ante selectores complejos.
    const result = evaluateGate({
      confidence: 1.0,
      selector: '.form > button:not([disabled])',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlTwoMatches,
    })
    expect(result.pass).toBe(true)
  })

  it('sin domSnapshot: no se evalúa unicidad', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#login-btn',
      selectorType: 'CSS',
      threshold: 0.85,
    })
    expect(result.pass).toBe(true)
  })

  it('cuenta selectores de clase respetando límites de palabra (no substring)', () => {
    const html = '<div class="btn-group">X</div><div class="btn">Y</div><div class="btn">Z</div>'
    const result = evaluateGate({
      confidence: 1.0,
      selector: '.btn',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: html,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'not_unique', matches: 2 })
  })

  it('cuenta selectores de atributo data-*/aria-*', () => {
    const html = '<button data-testid="submit-btn">A</button><button data-testid="submit-btn">B</button>'
    const result = evaluateGate({
      confidence: 1.0,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.85,
      domSnapshot: html,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'not_unique', matches: 2 })
  })

  it('no cuenta un atributo no relacionado cuyo sufijo coincide (data-id vs id, aria-data-testid vs data-testid)', () => {
    // Regresión: \b antes del nombre de atributo también matchea justo después
    // de un "-", así que buscar "id=" encontraba "data-id=", y buscar
    // "data-testid=" encontraba "aria-data-testid=". El fix usa (?<![\w-])
    // para exigir que no haya un char de palabra ni un guion inmediatamente
    // antes del nombre de atributo real.
    const htmlId = '<button id="login-btn">A</button><input data-id="login-btn" />'
    const resultId = evaluateGate({
      confidence: 1.0,
      selector: '#login-btn',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlId,
    })
    expect(resultId.pass).toBe(true)
    expect(resultId.blockedBy.find(r => r.code === 'not_unique')).toBeUndefined()

    const htmlAttr = '<button data-testid="submit-btn">A</button><div aria-data-testid="submit-btn">B</div>'
    const resultAttr = evaluateGate({
      confidence: 1.0,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.85,
      domSnapshot: htmlAttr,
    })
    expect(resultAttr.pass).toBe(true)
    expect(resultAttr.blockedBy.find(r => r.code === 'not_unique')).toBeUndefined()
  })

  it('no cuenta un atributo no relacionado cuyo sufijo coincide con "class" (data-class vs class)', () => {
    // Misma regresión que arriba, en la rama de selectores de clase:
    // classAttrRe usaba \bclass=, que también matcheaba dentro de
    // "data-class=" / "aria-class=", extrayendo su valor como si fuera un
    // class="" real. El chequeo de pertenencia de token no salva esto
    // porque el atributo ya fue mal identificado como "class" antes de
    // llegar a esa validación.
    const html = '<div data-class="foo">A</div><div class="foo">B</div>'
    const result = evaluateGate({
      confidence: 1.0,
      selector: '.foo',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: html,
    })
    expect(result.pass).toBe(true)
    expect(result.blockedBy.find(r => r.code === 'not_unique')).toBeUndefined()
  })
})

describe('evaluateGate — múltiples razones simultáneas', () => {
  it('reporta todas las razones de bloqueo a la vez, no solo la primera', () => {
    const result = evaluateGate({
      confidence: 0.50,
      selector: 'div:nth-child(3)',
      selectorType: 'CSS',
      threshold: 0.95,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy.map(r => r.code).sort()).toEqual(['fragile_selector', 'low_confidence'])
  })
})

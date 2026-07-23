import { describe, it, expect } from 'vitest'
import { analyzeAndHeal } from '../healing-engine'

describe('analyzeAndHeal', () => {
  it('is deterministic — same selector always yields the same confidence', () => {
    const a = analyzeAndHeal({ selector: '#login-btn' })
    const b = analyzeAndHeal({ selector: '#login-btn' })
    expect(a).toEqual(b)
  })

  it('proposes a TESTID selector for data-testid input, high confidence', () => {
    const result = analyzeAndHeal({ selector: "[data-testid='add-to-cart']" })
    expect(result.selectorType).toBe('TESTID')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.needsReview).toBe(false)
  })

  it('flags XPath as fragile and proposes a role-based fallback', () => {
    const result = analyzeAndHeal({ selector: "//button[@class='remove-item']" })
    expect(result.selectorType).toBe('ROLE')
    expect(result.technicalDetails.stableAgainstDOMChanges).toBe(true)
  })

  it('keeps confidence within the documented 0.75–0.98 band', () => {
    const selectors = [
      '#a', '.b', '//c', "[data-testid='d']", '[role=button]', 'text=Hola',
      "getByRole('button', { name: 'Login' })", "[data-cy='e']", "[name='f']", "[aria-label='g']",
    ]
    for (const selector of selectors) {
      const result = analyzeAndHeal({ selector })
      expect(result.confidence).toBeGreaterThanOrEqual(0.75)
      expect(result.confidence).toBeLessThanOrEqual(0.98)
    }
  })

  it('does NOT flag an ordinary word ID as dynamic just because it contains a hyphenated a-f letter (regression)', () => {
    // "-exist" used to match /-[a-f0-9]+/ (the "e" in "exist" is a valid hex digit),
    // wrongly proposing a class-based fix for a perfectly ordinary, stable ID.
    const result = analyzeAndHeal({ selector: '#does-not-exist' })
    expect(result.explanation).not.toContain('ID dinámico')
    expect(result.technicalDetails.detectedIssue).not.toContain('Dynamic ID')
  })

  it('still flags a genuinely dynamic hashed ID (6+ hex chars after the hyphen)', () => {
    const result = analyzeAndHeal({ selector: '#thing-a3f9c1e0' })
    expect(result.explanation).toContain('ID dinámico')
    expect(result.selectorType).toBe('CSS')
  })

  it('recognizes Spanish action words for buttons (bilingual ACTIONS dictionary)', () => {
    const result = analyzeAndHeal({ selector: '#btn-guardar' })
    expect(result.selectorType).toBe('ROLE')
    expect(result.fixedSelector).toContain('Guardar')
  })

  it('recognizes Spanish field words for inputs (bilingual FIELDS dictionary)', () => {
    const result = analyzeAndHeal({ selector: 'input.campo-correo' })
    expect(result.fixedSelector).toContain('Correo')
  })

  it('does not downgrade a selector that already uses a modern Playwright locator', () => {
    const original = "getByRole('button', { name: 'Login' })"
    const result = analyzeAndHeal({ selector: original })
    expect(result.fixedSelector).toBe(original)
    expect(result.selectorType).toBe('ROLE')
    expect(result.robustnessImprovement).toBe(0)
  })

  it('preserves data-cy syntax instead of rewriting it to data-testid', () => {
    const result = analyzeAndHeal({ selector: "[data-cy='add-to-cart']" })
    expect(result.selectorType).toBe('TESTID')
    expect(result.fixedSelector).toBe("[data-cy='add-to-cart']")
    expect(result.fixedSelector).not.toContain('data-testid')
  })

  it('preserves a [name=] attribute selector with moderate confidence', () => {
    const result = analyzeAndHeal({ selector: "[name='email']" })
    expect(result.selectorType).toBe('CSS')
    expect(result.fixedSelector).toBe("[name='email']")
    expect(result.confidence).toBeGreaterThanOrEqual(0.75)
    expect(result.confidence).toBeLessThan(0.95)
  })

  it('preserves an [aria-label=] attribute selector with high confidence', () => {
    const result = analyzeAndHeal({ selector: "[aria-label='Cerrar']" })
    expect(result.selectorType).toBe('ROLE')
    expect(result.fixedSelector).toBe("[aria-label='Cerrar']")
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  describe('bug real: clase CSS-in-JS pegada a una clase semántica estable', () => {
    it('multi-clase pegada (.wrapper.css-hash) propone conservar solo la parte estable, no cae al fallback genérico', () => {
      const result = analyzeAndHeal({ selector: '.wrapper.css-1a2b3c4d5e' })
      expect(result.fixedSelector).toBe('.wrapper')
      expect(result.explanation).toContain('CSS-in-JS')
      expect(result.fixedSelector).not.toMatch(/^visible=/)
    })

    it('combinador antes de la clase volátil (.container > .css-hash) también se detecta', () => {
      const result = analyzeAndHeal({ selector: '.container > .css-1a2b3c4d' })
      expect(result.fixedSelector).toBe('.container')
      expect(result.fixedSelector).not.toMatch(/^visible=/)
    })
  })

  describe('custom synonyms (healify.config.json)', () => {
    it('usa un sinónimo de acción custom para generar la sugerencia', () => {
      const result = analyzeAndHeal({
        selector: '#btn-inspeccionar',
        customSynonyms: { actions: { inspeccionar: 'Inspeccionar' } },
      })
      expect(result.fixedSelector).toContain('Inspeccionar')
    })

    it('usa un sinónimo de campo custom para generar la sugerencia', () => {
      const result = analyzeAndHeal({
        selector: 'input.campo-matricula',
        customSynonyms: { fields: { matricula: 'Matrícula' } },
      })
      expect(result.fixedSelector).toContain('Matrícula')
    })

    it('los sinónimos custom no pisan los built-in (español sigue funcionando)', () => {
      const result = analyzeAndHeal({
        selector: '#btn-guardar',
        customSynonyms: { actions: { otro: 'Otro' } },
      })
      expect(result.fixedSelector).toContain('Guardar')
    })

    it('los sinónimos custom sí pisan built-in si tienen la misma key', () => {
      const result = analyzeAndHeal({
        selector: '#btn-guardar',
        customSynonyms: { actions: { guardar: 'Save (custom)' } },
      })
      expect(result.fixedSelector).toContain('Save (custom)')
    })

    it('sin customSynonyms: comportamiento idéntico al actual', () => {
      const without = analyzeAndHeal({ selector: '#btn-guardar' })
      const withEmpty = analyzeAndHeal({ selector: '#btn-guardar', customSynonyms: {} })
      expect(without.fixedSelector).toBe(withEmpty.fixedSelector)
    })

    it('custom synonyms vacíos no rompen nada', () => {
      const result = analyzeAndHeal({
        selector: '#btn-guardar',
        customSynonyms: { actions: {}, fields: {} },
      })
      expect(result.fixedSelector).toContain('Guardar')
    })
  })
})

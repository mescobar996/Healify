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
    for (const selector of ['#a', '.b', '//c', "[data-testid='d']", '[role=button]', 'text=Hola']) {
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
})

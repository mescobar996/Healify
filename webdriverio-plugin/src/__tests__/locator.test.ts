import { describe, it, expect } from 'vitest'
import { wdioSelectorToSelector, isWdioCssCompatible } from '../locator'

describe('wdioSelectorToSelector', () => {
  it('preserva selectores CSS tal cual', () => {
    expect(wdioSelectorToSelector('.btn.primary')).toBe('.btn.primary')
    expect(wdioSelectorToSelector('#login')).toBe('#login')
    expect(wdioSelectorToSelector('[data-testid="x"]')).toBe('[data-testid="x"]')
  })

  it('preserva XPath tal cual', () => {
    expect(wdioSelectorToSelector('//button[@id="x"]')).toBe('//button[@id="x"]')
    expect(wdioSelectorToSelector('(//div[@class="modal"])')).toBe('(//div[@class="modal"])')
  })

  it('devuelve null para selectores custom no convertibles', () => {
    expect(wdioSelectorToSelector('linkText=Home')).toBeNull()
    expect(wdioSelectorToSelector('partialText=Ho')).toBeNull()
  })

  it('trimea espacios', () => {
    expect(wdioSelectorToSelector('  .btn  ')).toBe('.btn')
  })
})

describe('isWdioCssCompatible', () => {
  it('rechaza role(...)', () => {
    expect(isWdioCssCompatible("role('button', { name: 'Add' })")).toBe(false)
  })

  it('rechaza :has-text(...)', () => {
    expect(isWdioCssCompatible("button:has-text('Add')")).toBe(false)
  })

  it('rechaza visible=...', () => {
    expect(isWdioCssCompatible('visible=oldselector')).toBe(false)
  })

  it('rechaza getByRole(...)', () => {
    expect(isWdioCssCompatible("getByRole('button', { name: 'Add' })")).toBe(false)
  })

  it('acepta selectores CSS reales', () => {
    expect(isWdioCssCompatible('[data-testid="add-to-cart"]')).toBe(true)
    expect(isWdioCssCompatible('.stable-class')).toBe(true)
    expect(isWdioCssCompatible('#stable-id')).toBe(true)
    expect(isWdioCssCompatible('//button')).toBe(true)
  })
})

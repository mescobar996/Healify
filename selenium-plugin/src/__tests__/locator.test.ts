import { describe, it, expect } from 'vitest'
import { By } from 'selenium-webdriver'
import { locatorToSelector, isSeleniumCssCompatible } from '../locator'

describe('locatorToSelector', () => {
  it('convierte By.css tal cual', () => {
    expect(locatorToSelector(By.css('.btn.primary'))).toBe('.btn.primary')
  })

  it('convierte By.xpath tal cual', () => {
    expect(locatorToSelector(By.xpath('//button[@id="x"]'))).toBe('//button[@id="x"]')
  })

  it('reescribe By.id a selector #id para activar la regla de ID dinámico', () => {
    expect(locatorToSelector(By.id('user-1234'))).toBe('#user-1234')
  })

  it('preserva By.className como selector de clase — ya empieza con "."', () => {
    expect(locatorToSelector(By.className('btn-primary'))).toBe('.btn-primary')
  })

  it('preserva By.name como selector de atributo — ya contiene "[name="', () => {
    expect(locatorToSelector(By.name('email'))).toBe('*[name="email"]')
  })

  it('devuelve null para By.linkText — no convertible', () => {
    expect(locatorToSelector(By.linkText('Home'))).toBeNull()
  })

  it('devuelve null para By.partialLinkText — no convertible', () => {
    expect(locatorToSelector(By.partialLinkText('Ho'))).toBeNull()
  })

  it('devuelve null para By.tagName — no convertible', () => {
    expect(locatorToSelector(By.tagName('button'))).toBeNull()
  })

  it('preserva el escape de Selenium para comillas dentro de By.id', () => {
    expect(locatorToSelector(By.id('a"b'))).toBe('#a\\"b')
  })

  it('devuelve null para un locator malformado en vez de tirar excepción', () => {
    expect(locatorToSelector({} as unknown as By)).toBeNull()
  })
})

describe('isSeleniumCssCompatible', () => {
  it('rechaza sugerencias tipo role(...) — sintaxis de Playwright, no CSS', () => {
    expect(isSeleniumCssCompatible("role('button', { name: 'Add' })")).toBe(false)
  })

  it('rechaza sugerencias con :has-text(...) — pseudo-clase de Playwright, no CSS nativo', () => {
    expect(isSeleniumCssCompatible("button:has-text('Add')")).toBe(false)
  })

  it('rechaza el fallback visible=... — prefijo de Playwright, no CSS', () => {
    expect(isSeleniumCssCompatible('visible=oldselector')).toBe(false)
  })

  it('rechaza sugerencias tipo getByRole(...) — locator moderno de Playwright, no CSS', () => {
    expect(isSeleniumCssCompatible("getByRole('button', { name: 'Add' })")).toBe(false)
  })

  it('acepta selectores CSS reales', () => {
    expect(isSeleniumCssCompatible('[data-testid="add-to-cart"]')).toBe(true)
    expect(isSeleniumCssCompatible('.stable-class')).toBe(true)
    expect(isSeleniumCssCompatible('#stable-id')).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { parseRoleSuggestion, roleSuggestionToXPath } from '../role-locator'

describe('parseRoleSuggestion', () => {
  it('extrae rol y nombre', () => {
    expect(parseRoleSuggestion("role('button', { name: 'Comprar' })")).toEqual({ role: 'button', name: 'Comprar' })
  })

  it('extrae solo el rol cuando no hay nombre', () => {
    expect(parseRoleSuggestion("role('button')")).toEqual({ role: 'button' })
  })

  it('acepta un nombre vacío explícito', () => {
    expect(parseRoleSuggestion("role('button', { name: '' })")).toEqual({ role: 'button', name: '' })
  })

  it('devuelve null para selectores que no son de rol', () => {
    expect(parseRoleSuggestion('#comprar-ahora')).toBeNull()
    expect(parseRoleSuggestion("[data-testid='x']")).toBeNull()
    expect(parseRoleSuggestion("button:has-text('X')")).toBeNull()
  })

  it('devuelve null para un formato de rol malformado', () => {
    expect(parseRoleSuggestion("role('button', name: 'X')")).toBeNull()
  })
})

describe('roleSuggestionToXPath', () => {
  it('button: busca por texto visible, aria-label o value de un input submit', () => {
    const xpath = roleSuggestionToXPath('button', 'Comprar')

    expect(xpath).toContain("//button[normalize-space(.)='Comprar']")
    expect(xpath).toContain("//button[@aria-label='Comprar']")
    expect(xpath).toContain("@value='Comprar'")
  })

  it('link: busca por texto visible o aria-label de un <a>', () => {
    const xpath = roleSuggestionToXPath('link', 'Inicio')

    expect(xpath).toContain("//a[normalize-space(.)='Inicio']")
  })

  it('textbox: busca por aria-label o placeholder, texto o textarea', () => {
    const xpath = roleSuggestionToXPath('textbox', 'Correo')

    expect(xpath).toContain("//input[@aria-label='Correo']")
    expect(xpath).toContain("//input[@placeholder='Correo']")
    expect(xpath).toContain("//textarea[@aria-label='Correo']")
  })

  it('checkbox y radio: buscan por aria-label', () => {
    expect(roleSuggestionToXPath('checkbox', 'Acepto')).toContain("//input[@type='checkbox'][@aria-label='Acepto']")
    expect(roleSuggestionToXPath('radio', 'Sí')).toContain("//input[@type='radio'][@aria-label='Sí']")
  })

  it('devuelve null para un rol sin mapeo conocido', () => {
    expect(roleSuggestionToXPath('heading', 'Tienda')).toBeNull()
  })

  it('devuelve null con nombre vacío — nada confiable para buscar', () => {
    expect(roleSuggestionToXPath('button', '')).toBeNull()
  })

  it('escapa un nombre con comilla simple', () => {
    expect(roleSuggestionToXPath('button', "L'Oreal")).toContain(`"L'Oreal"`)
  })

  it('escapa un nombre con comilla doble', () => {
    expect(roleSuggestionToXPath('button', 'Decí "hola"')).toContain(`'Decí "hola"'`)
  })

  it('arma un concat() cuando el nombre tiene los dos tipos de comilla', () => {
    const xpath = roleSuggestionToXPath('button', `L'Oreal dice "hola"`)

    expect(xpath).toContain('concat(')
  })
})

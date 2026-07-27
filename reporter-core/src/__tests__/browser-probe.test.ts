import { describe, it, expect } from 'vitest'
import { BROWSER_PROBE_SCRIPT, domContextFromProbeResult } from '../browser-probe'
import { parsePageSnapshot } from '../page-snapshot'

describe('BROWSER_PROBE_SCRIPT', () => {
  it('es un script válido: termina en return y no tiene una función sin invocar envolviéndolo', () => {
    // No es una función TS por diseño (ver comentario del módulo) — igual conviene una
    // verificación mínima de forma: el protocolo WebDriver ejecuta este string como CUERPO de
    // función, así que un `function() {...}` envolvente nunca se invocaría y devolvería undefined.
    expect(BROWSER_PROBE_SCRIPT.trim().startsWith('function')).toBe(false)
    expect(BROWSER_PROBE_SCRIPT.trim().endsWith('return results;')).toBe(true)
  })

  it('es JS sintácticamente válido como cuerpo de función', () => {
    expect(() => new Function(BROWSER_PROBE_SCRIPT)).not.toThrow()
  })
})

describe('domContextFromProbeResult', () => {
  it('formatea un resultado válido a líneas que parsePageSnapshot puede leer', () => {
    const domContext = domContextFromProbeResult([
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
    ])

    expect(domContext).toBeDefined()
    expect(parsePageSnapshot(domContext)).toEqual([
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
    ])
  })

  it('undefined con null — mismo criterio que Playwright sin el attachment', () => {
    expect(domContextFromProbeResult(null)).toBeUndefined()
  })

  it('undefined con un array vacío', () => {
    expect(domContextFromProbeResult([])).toBeUndefined()
  })

  it('undefined con cualquier cosa que no sea un array — un driver raro puede devolver cualquier cosa', () => {
    expect(domContextFromProbeResult('no es un array')).toBeUndefined()
    expect(domContextFromProbeResult(42)).toBeUndefined()
    expect(domContextFromProbeResult({ role: 'button', name: 'x' })).toBeUndefined()
    expect(domContextFromProbeResult(undefined)).toBeUndefined()
  })

  it('filtra elementos con forma inválida en vez de romper por uno solo', () => {
    const domContext = domContextFromProbeResult([
      { role: 'button', name: 'Comprar' },
      { role: 42, name: 'x' },
      { role: 'link' }, // sin name
      null,
      'basura',
      { role: 'link', name: 'Inicio' },
    ])

    expect(parsePageSnapshot(domContext)).toEqual([
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
    ])
  })

  it('undefined si después de filtrar no queda nada aprovechable', () => {
    expect(domContextFromProbeResult([{ role: 42 }, null, 'x'])).toBeUndefined()
  })
})

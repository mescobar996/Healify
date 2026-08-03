import { describe, it, expect } from 'vitest'
import { hasChanged, makeChangeDetector, type FileStamp } from '../watch'

function stamp(mtimeMs: number, size: number): FileStamp {
  return { mtimeMs, size }
}

describe('hasChanged()', () => {
  it('null→null es false (nunca hubo archivo)', () => {
    expect(hasChanged(null, null)).toBe(false)
  })

  it('null→stamp es true (apareció el archivo)', () => {
    expect(hasChanged(null, stamp(1, 10))).toBe(true)
  })

  it('stamp→null es true (desapareció el archivo)', () => {
    expect(hasChanged(stamp(1, 10), null)).toBe(true)
  })

  it('mismo mtime y tamaño es false', () => {
    expect(hasChanged(stamp(1, 10), stamp(1, 10))).toBe(false)
  })

  it('mtime distinto es true', () => {
    expect(hasChanged(stamp(1, 10), stamp(2, 10))).toBe(true)
  })

  it('tamaño distinto es true', () => {
    expect(hasChanged(stamp(1, 10), stamp(1, 11))).toBe(true)
  })
})

describe('makeChangeDetector()', () => {
  it('aplica la primera vez (sin estado previo)', () => {
    const d = makeChangeDetector()
    expect(d.shouldApply(stamp(1, 10))).toBe(true)
  })

  it('no vuelve a aplicar si el stamp no cambió', () => {
    const d = makeChangeDetector()
    d.shouldApply(stamp(1, 10))
    expect(d.shouldApply(stamp(1, 10))).toBe(false)
  })

  it('aplica de nuevo cuando el stamp cambia', () => {
    const d = makeChangeDetector()
    d.shouldApply(stamp(1, 10))
    expect(d.shouldApply(stamp(2, 10))).toBe(true)
  })

  it('archivo borrado (null) rehabilita: el siguiente stamp vuelve a aplicar', () => {
    const d = makeChangeDetector()
    d.shouldApply(stamp(1, 10))
    expect(d.shouldApply(null)).toBe(true)
    expect(d.shouldApply(stamp(2, 10))).toBe(true)
  })
})

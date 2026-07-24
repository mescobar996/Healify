import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getVersion } from '../version'

describe('getVersion', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-version-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('lee la versión del package.json que está un nivel arriba del baseDir', () => {
    // Simula la estructura real: baseDir = dist/, package.json en la raíz del paquete.
    const distDir = join(dir, 'dist')
    mkdirSync(distDir)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.2.3' }))

    expect(getVersion(distDir)).toBe('1.2.3')
  })

  it('devuelve "desconocida" si no hay package.json', () => {
    const distDir = join(dir, 'dist')
    mkdirSync(distDir)
    expect(getVersion(distDir)).toBe('desconocida')
  })

  it('devuelve "desconocida" si el package.json no tiene version válida', () => {
    const distDir = join(dir, 'dist')
    mkdirSync(distDir)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x' }))
    expect(getVersion(distDir)).toBe('desconocida')
  })

  it('el package.json real del paquete tiene forma de versión semver', () => {
    // Sin baseDir override: en el entorno de test __dirname es cli/src, y cli/package.json
    // existe un nivel arriba — así que este camino real también resuelve una versión válida.
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })
})

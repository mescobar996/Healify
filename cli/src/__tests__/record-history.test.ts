import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun } from '@healify/reporter-core'
import { applyFixOnce } from '../commands/fix-pr'

const REPORTE: LocalRun = {
  project: 'demo',
  framework: 'Playwright',
  generatedAt: new Date('2026-08-06T00:00:00.000Z'),
  cases: [
    {
      testName: 'agrega al carrito',
      testFile: 'e2e/checkout.spec.ts',
      selector: '#add-to-cart',
      errorMessage: "Waiting for selector '#add-to-cart' failed",
      status: 'healed',
      fixedSelector: "[data-testid='add-to-cart']",
      confidence: 0.95,
      explanation: '',
      selectorType: 'TESTID',
      cause: 'selector',
      defectId: 'HLF-000001',
      severity: 'major',
    },
  ],
}

describe('--record-history', () => {
  let dir: string
  let cwdAnterior: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-record-'))
    writeFileSync(join(dir, 'healify-report.json'), JSON.stringify(REPORTE), 'utf-8')
    // appendHistory escribe relativo a process.cwd() — el test tiene que pararse adentro.
    cwdAnterior = process.cwd()
    process.chdir(dir)
  })

  afterEach(() => {
    process.chdir(cwdAnterior)
    rmSync(dir, { recursive: true, force: true })
  })

  const historial = () => join(dir, '.healify', 'history.jsonl')

  it('un --dry-run común sigue sin dejar rastro', () => {
    // El comportamiento de siempre: dry-run no escribe nada, ni siquiera el historial.
    applyFixOnce('healify-report.json', { dryRun: true, force: false, ast: false, pageObjects: false })
    expect(existsSync(historial())).toBe(false)
  })

  it('con --record-history graba el historial aunque sea dry-run', () => {
    applyFixOnce('healify-report.json', {
      dryRun: true,
      force: false,
      ast: false,
      pageObjects: false,
      recordHistory: true,
    })

    expect(existsSync(historial())).toBe(true)
    const entrada = JSON.parse(readFileSync(historial(), 'utf-8').trim())
    expect(entrada.selector).toBe('#add-to-cart')
    expect(entrada.cause).toBe('selector')
    // El framework de la corrida se graba en cada entrada — alimenta la eficacia por framework.
    expect(entrada.framework).toBe('Playwright')
  })

  it('no toca los archivos de test — la promesa de dry-run se mantiene', () => {
    // Lo que hace defendible grabar el historial en dry-run: `.healify/` es el registro propio
    // de Healify, no el código del usuario. Si esto se rompiera, la Action estaría mintiendo
    // en su descripción ("Never modifies files").
    const testFile = join(dir, 'e2e', 'checkout.spec.ts')
    rmSync(join(dir, 'e2e'), { recursive: true, force: true })

    applyFixOnce('healify-report.json', {
      dryRun: true,
      force: false,
      ast: false,
      pageObjects: false,
      recordHistory: true,
    })

    expect(existsSync(testFile)).toBe(false)
  })

  it('un fix real sigue grabando sin necesidad del flag', () => {
    applyFixOnce('healify-report.json', { dryRun: false, force: true, ast: false, pageObjects: false })
    expect(existsSync(historial())).toBe(true)
  })
})

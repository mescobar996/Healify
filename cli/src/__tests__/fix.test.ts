import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'

const { mockIsGitDirty } = vi.hoisted(() => ({ mockIsGitDirty: vi.fn(() => false) }))
vi.mock('../git-check', () => ({ isGitDirty: mockIsGitDirty }))

import { fix } from '../fix'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: '',
    selector: '#old',
    errorMessage: 'error',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    confidence: 0.95,
    explanation: '',
    selectorType: 'TESTID',
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[]): LocalRun {
  return { project: 'test', framework: 'Playwright', generatedAt: new Date(), cases }
}

describe('fix', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-fix-'))
    mockIsGitDirty.mockReturnValue(false)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('aplica el reemplazo cuando el selector aparece una sola vez', () => {
    const file = join(dir, 'a.spec.ts')
    writeFileSync(file, `page.click('#old')`)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#old', fixedSelector: "[data-testid='new']", status: 'applied' }])
    expect(readFileSync(file, 'utf-8')).toBe(`page.click('[data-testid='new']')`)
  })

  it('salta con motivo "ambiguous" cuando el selector aparece más de una vez, sin tocar el archivo', () => {
    const file = join(dir, 'a.spec.ts')
    const original = `page.click('#old'); page.click('#old')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#old', status: 'skipped', reason: 'ambiguous' }])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('salta con motivo "not-found" cuando el selector no aparece en el archivo', () => {
    const file = join(dir, 'a.spec.ts')
    const original = `page.click('#something-else')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#old', status: 'skipped', reason: 'not-found' }])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('salta con motivo "not-found" cuando el archivo no existe', () => {
    const missing = join(dir, 'no-existe.spec.ts')

    const outcomes = fix(makeRun([makeCase({ testFile: missing })]))

    expect(outcomes).toEqual([{ testFile: missing, selector: '#old', status: 'skipped', reason: 'not-found' }])
  })

  it('salta con motivo "dirty-git" cuando el archivo tiene cambios sin commitear', () => {
    mockIsGitDirty.mockReturnValue(true)
    const file = join(dir, 'a.spec.ts')
    const original = `page.click('#old')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#old', status: 'skipped', reason: 'dirty-git' }])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('con --force aplica igual aunque el archivo tenga cambios sin commitear', () => {
    mockIsGitDirty.mockReturnValue(true)
    const file = join(dir, 'a.spec.ts')
    writeFileSync(file, `page.click('#old')`)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]), { force: true })

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`page.click('[data-testid='new']')`)
  })

  it('con --dry-run no escribe el archivo aunque reporte "applied"', () => {
    const file = join(dir, 'a.spec.ts')
    const original = `page.click('#old')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]), { dryRun: true })

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('--dry-run no bloquea por git sucio (no hace falta, no va a escribir nada)', () => {
    mockIsGitDirty.mockReturnValue(true)
    const file = join(dir, 'a.spec.ts')
    writeFileSync(file, `page.click('#old')`)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]), { dryRun: true })

    expect(outcomes[0].status).toBe('applied')
  })

  it('procesa los selectores de más largo a más corto para no corromper uno que contiene al otro', () => {
    const file = join(dir, 'a.spec.ts')
    // Solo existe '#btn-guardar' en el archivo — '#btn' solo "existe" como substring de ese.
    writeFileSync(file, `page.click('#btn-guardar')`)

    const outcomes = fix(makeRun([
      makeCase({ testFile: file, selector: '#btn', fixedSelector: "[data-testid='btn']" }),
      makeCase({ testFile: file, selector: '#btn-guardar', fixedSelector: "[data-testid='guardar']" }),
    ]))

    const bySelector = Object.fromEntries(outcomes.map((o) => [o.selector, o]))
    expect(bySelector['#btn-guardar'].status).toBe('applied')
    expect(bySelector['#btn'].status).toBe('skipped')
    expect(readFileSync(file, 'utf-8')).toBe(`page.click('[data-testid='guardar']')`)
  })

  it('ignora casos que no son "healed" (review/unresolved)', () => {
    const file = join(dir, 'a.spec.ts')
    const original = `page.click('#old')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({ testFile: file, status: 'review' })]))

    expect(outcomes).toEqual([])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('salta con motivo "not-substitutable" una sugerencia ROLE (regresión: role(...) no es un valor de selector, corrompía el archivo)', () => {
    const file = join(dir, 'checkout.spec.ts')
    const original = `await page.click('#add-to-cart-btn')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({
      testFile: file,
      selector: '#add-to-cart-btn',
      fixedSelector: "role('button', { name: 'Add' })",
    })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#add-to-cart-btn', status: 'skipped', reason: 'not-substitutable' }])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('ignora casos sin testFile', () => {
    const outcomes = fix(makeRun([makeCase({ testFile: undefined })]))
    expect(outcomes).toEqual([])
  })
})

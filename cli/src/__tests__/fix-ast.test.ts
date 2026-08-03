import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'

const { mockIsGitDirty } = vi.hoisted(() => ({ mockIsGitDirty: vi.fn(() => false) }))
vi.mock('../git-check', () => ({ isGitDirty: mockIsGitDirty }))

import { fixAst } from '../fix-ast'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: '',
    selector: '#btn-submit',
    errorMessage: 'error',
    status: 'healed',
    fixedSelector: "role('button', { name: 'Submit' })",
    confidence: 0.92,
    explanation: '',
    selectorType: 'ROLE',
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[]): LocalRun {
  return { project: 'test', framework: 'Playwright', generatedAt: new Date(), cases }
}

describe('fixAst', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-fix-ast-'))
    mockIsGitDirty.mockReturnValue(false)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('reescribe page.click(selector) a page.getByRole(...).click()', () => {
    const file = join(dir, 'click-role.spec.ts')
    writeFileSync(file, `await page.click('#btn-submit')`)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`await page.getByRole('button', { name: 'Submit' }).click()`)
  })

  it('reescribe page.fill(selector, valor) preservando el valor original', () => {
    const file = join(dir, 'fill-role.spec.ts')
    writeFileSync(file, `await page.fill('#email', 'user@example.com')`)

    const outcomes = fixAst(makeRun([makeCase({
      testFile: file,
      selector: '#email',
      fixedSelector: "role('textbox', { name: 'Email' })",
    })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com')`)
  })

  it('reescribe expect(page.locator(selector)).toBeVisible()', () => {
    const file = join(dir, 'locator-role.spec.ts')
    writeFileSync(file, `await expect(page.locator('#btn-submit')).toBeVisible()`)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()`)
  })

  it('procesa el selector más largo primero para no corromper al que lo contiene como substring', () => {
    const file = join(dir, 'multiple-selectors.spec.ts')
    writeFileSync(file, `await page.click('#btn-submit-form'); await page.click('#btn')`)

    const outcomes = fixAst(makeRun([
      makeCase({ testFile: file, selector: '#btn', fixedSelector: "role('button', { name: 'Generic' })" }),
      makeCase({ testFile: file, selector: '#btn-submit-form', fixedSelector: "role('button', { name: 'Submit Form' })" }),
    ]))

    // Los dos son ocurrencias reales y distintas en el archivo (no solo un substring
    // compartido) — el orden largo-a-corto evita que '#btn' se reemplace primero y
    // corrompa el texto de '#btn-submit-form', pero una vez resuelto el largo, el corto
    // sigue siendo una ocurrencia legítima y también se aplica.
    const bySelector = Object.fromEntries(outcomes.map((o) => [o.selector, o]))
    expect(bySelector['#btn-submit-form'].status).toBe('applied')
    expect(bySelector['#btn'].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(
      `await page.getByRole('button', { name: 'Submit Form' }).click(); await page.getByRole('button', { name: 'Generic' }).click()`
    )
  })

  it('salta con not-found si el selector solo aparece en un comentario', () => {
    const file = join(dir, 'comment-masking.spec.ts')
    writeFileSync(file, `// TODO: reemplazar '#old-btn' con role selector\nawait page.click('#real-btn')`)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file, selector: '#old-btn' })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#old-btn', status: 'skipped', reason: 'not-found' }])
    expect(readFileSync(file, 'utf-8')).toBe(`// TODO: reemplazar '#old-btn' con role selector\nawait page.click('#real-btn')`)
  })

  it('ignora casos que no son sugerencias role(...) (ej. TEXT, ya substituible tal cual por fix() normal)', () => {
    const file = join(dir, 'text-suggestion.spec.ts')
    writeFileSync(file, `await page.click('#btn')`)

    const outcomes = fixAst(makeRun([makeCase({
      testFile: file,
      selector: '#btn',
      fixedSelector: "button:has-text('Login')",
    })]))

    expect(outcomes).toEqual([])
    expect(readFileSync(file, 'utf-8')).toBe(`await page.click('#btn')`)
  })

  it('salta con not-substitutable si el método no tiene mapeo (ej. una función custom)', () => {
    const file = join(dir, 'unmapped.spec.ts')
    writeFileSync(file, `await page.waitForSelector('#btn-submit')`)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#btn-submit', status: 'skipped', reason: 'not-substitutable' }])
    expect(readFileSync(file, 'utf-8')).toBe(`await page.waitForSelector('#btn-submit')`)
  })

  it('con --dry-run no escribe el archivo aunque reporte applied', () => {
    const file = join(dir, 'dry-run.spec.ts')
    const original = `await page.click('#btn-submit')`
    writeFileSync(file, original)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file })]), { dryRun: true })

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('salta con dirty-git si el archivo tiene cambios sin commitear (sin --force ni --dry-run)', () => {
    mockIsGitDirty.mockReturnValue(true)
    const file = join(dir, 'dirty.spec.ts')
    const original = `await page.click('#btn-submit')`
    writeFileSync(file, original)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file })]))

    expect(outcomes).toEqual([{ testFile: file, selector: '#btn-submit', status: 'skipped', reason: 'dirty-git' }])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('ignora casos que no son healed o sin testFile', () => {
    expect(fixAst(makeRun([makeCase({ status: 'review' })]))).toEqual([])
    expect(fixAst(makeRun([makeCase({ testFile: undefined })]))).toEqual([])
  })

  it('salta con not-found si el path intenta escapar del proyecto (path traversal)', () => {
    const escaping = join('..', '..', 'escape-ast.spec.ts')
    const resolvedEscape = join(process.cwd(), '..', '..', 'escape-ast.spec.ts')

    const outcomes = fixAst(makeRun([makeCase({ testFile: escaping })]))

    expect(outcomes).toEqual([{ testFile: escaping, selector: '#btn-submit', status: 'skipped', reason: 'not-found' }])
    expect(existsSync(resolvedEscape)).toBe(false)
  })
})

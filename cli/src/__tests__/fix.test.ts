import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'

const { mockIsGitDirty } = vi.hoisted(() => ({ mockIsGitDirty: vi.fn(() => false) }))
vi.mock('../git-check', () => ({ isGitDirty: mockIsGitDirty }))

import { fix, describeReadError } from '../fix'

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

describe('describeReadError', () => {
  it('ENOENT (no hay reporte) → mensaje amable, exit 0, stream log', () => {
    const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    const r = describeReadError('healify-report.json', err)

    expect(r.exitCode).toBe(0)
    expect(r.stream).toBe('log')
    expect(r.message).toContain('No encontré healify-report.json')
    expect(r.message).toContain('Corré tus tests')
    expect(r.message).not.toContain('ENOENT')
  })

  it('JSON corrupto u otro error → mensaje técnico, exit 1, stream error', () => {
    const err = new SyntaxError('Unexpected token } in JSON')
    const r = describeReadError('healify-report.json', err)

    expect(r.exitCode).toBe(1)
    expect(r.stream).toBe('error')
    expect(r.message).toContain('No se pudo leer healify-report.json')
    expect(r.message).toContain('Unexpected token')
  })

  it.each(['EACCES', 'EPERM'])('%s (permisos denegados) → mensaje amable, exit 1, stream error, sin el código crudo', (code) => {
    const err = Object.assign(new Error(`${code}: permission denied, open 'healify-report.json'`), { code })
    const r = describeReadError('healify-report.json', err)

    expect(r.exitCode).toBe(1)
    expect(r.stream).toBe('error')
    expect(r.message).toContain('permisos denegados')
    expect(r.message).toContain('abierto en otro programa')
    expect(r.message).not.toContain(code)
  })
})

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

    const outcomes = fix(makeRun([makeCase({ testFile: file })]), { pageObjectRoots: [dir] })

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

    const outcomes = fix(
      makeRun([
        makeCase({ testFile: file, selector: '#btn', fixedSelector: "[data-testid='btn']" }),
        makeCase({ testFile: file, selector: '#btn-guardar', fixedSelector: "[data-testid='guardar']" }),
      ]),
      { pageObjectRoots: [dir] }
    )

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

  it('bug real: no reemplaza dentro de un comentario cuando esa es la única mención (el código real ya cambió)', () => {
    const file = join(dir, 'a.spec.ts')
    const original = `// TODO: reemplazar '#old' por el testid nuevo\npage.click('#new-real-selector')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]), { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile: file, selector: '#old', status: 'skipped', reason: 'not-found' }])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('sí reemplaza cuando el selector real está en código y también aparece mencionado en un comentario aparte', () => {
    const file = join(dir, 'a.spec.ts')
    writeFileSync(file, `// visto en el reporte: '#old'\npage.click('#old')`)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`// visto en el reporte: '#old'\npage.click('[data-testid='new']')`)
  })

  it('bloque de comentario /* ... */ tampoco cuenta como ocurrencia real', () => {
    const file = join(dir, 'a.spec.ts')
    const original = `/*\n * viejo selector: '#old'\n */\npage.click('#new-real-selector')`
    writeFileSync(file, original)

    const outcomes = fix(makeRun([makeCase({ testFile: file })]), { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile: file, selector: '#old', status: 'skipped', reason: 'not-found' }])
    expect(readFileSync(file, 'utf-8')).toBe(original)
  })

  it('salta con not-found si el path intenta escapar del proyecto (path traversal)', () => {
    const escaping = join('..', '..', 'escape.spec.ts')
    const resolvedEscape = join(process.cwd(), '..', '..', 'escape.spec.ts')

    const outcomes = fix(makeRun([makeCase({ testFile: escaping })]))

    expect(outcomes).toEqual([{ testFile: escaping, selector: '#old', status: 'skipped', reason: 'not-found' }])
    expect(existsSync(resolvedEscape)).toBe(false)
  })
})

/**
 * El caso que antes salteaba TODO en cualquier proyecto con Page Object Model: el spec llama a
 * `loginPage.submit()` y el selector roto vive en `pages/login.page.ts`.
 */
describe('fix — fallback a page objects', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-fix-pom-'))
    mockIsGitDirty.mockReturnValue(false)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function spec(): string {
    const file = join(dir, 'e2e', 'login.spec.ts')
    mkdirSync(join(dir, 'e2e'), { recursive: true })
    writeFileSync(file, `await loginPage.submit()`)
    return file
  }

  function pageObject(name: string, content: string): string {
    const file = join(dir, 'pages', name)
    mkdirSync(join(dir, 'pages'), { recursive: true })
    writeFileSync(file, content, 'utf-8')
    return file
  }

  it('aplica el fix en el page object y reporta dónde lo tocó', () => {
    const testFile = spec()
    const po = pageObject('login.page.ts', `export const submitBtn = '#old'\n`)

    const outcomes = fix(makeRun([makeCase({ testFile })]), { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([
      { testFile, selector: '#old', fixedSelector: "[data-testid='new']", status: 'applied', appliedIn: po },
    ])
    expect(readFileSync(po, 'utf-8')).toBe(`export const submitBtn = '[data-testid='new']'\n`)
  })

  it('no adivina si el selector está en dos page objects', () => {
    const testFile = spec()
    const a = pageObject('login.page.ts', `export const btn = '#old'\n`)
    const b = pageObject('checkout.page.ts', `export const btn = '#old'\n`)

    const outcomes = fix(makeRun([makeCase({ testFile })]), { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile, selector: '#old', status: 'skipped', reason: 'ambiguous' }])
    expect(readFileSync(a, 'utf-8')).toContain('#old')
    expect(readFileSync(b, 'utf-8')).toContain('#old')
  })

  it('un page object con el selector dos veces tampoco cuenta — mismo criterio que el spec', () => {
    const testFile = spec()
    const po = pageObject('login.page.ts', `const a = '#old'\nconst b = '#old'\n`)

    const outcomes = fix(makeRun([makeCase({ testFile })]), { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile, selector: '#old', status: 'skipped', reason: 'not-found' }])
    expect(readFileSync(po, 'utf-8')).toBe(`const a = '#old'\nconst b = '#old'\n`)
  })

  it('una mención solo en un comentario no habilita el reemplazo', () => {
    const testFile = spec()
    const po = pageObject('login.page.ts', `// TODO: reemplazar '#old'\nexport const btn = '#otro'\n`)

    const outcomes = fix(makeRun([makeCase({ testFile })]), { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile, selector: '#old', status: 'skipped', reason: 'not-found' }])
    expect(readFileSync(po, 'utf-8')).toContain(`// TODO: reemplazar '#old'`)
  })

  it('--dry-run no escribe el page object', () => {
    const testFile = spec()
    const po = pageObject('login.page.ts', `export const btn = '#old'\n`)

    const outcomes = fix(makeRun([makeCase({ testFile })]), { pageObjectRoots: [dir], dryRun: true })

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(po, 'utf-8')).toBe(`export const btn = '#old'\n`)
  })

  it('page object con cambios sin commitear se saltea', () => {
    mockIsGitDirty.mockReturnValue(true)
    const testFile = spec()
    const po = pageObject('login.page.ts', `export const btn = '#old'\n`)

    const outcomes = fix(makeRun([makeCase({ testFile })]), { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile, selector: '#old', status: 'skipped', reason: 'dirty-git' }])
    expect(readFileSync(po, 'utf-8')).toBe(`export const btn = '#old'\n`)
  })

  it('dos selectores que caen en el mismo page object se aplican los dos sin pisarse', () => {
    const testFile = spec()
    const po = pageObject('login.page.ts', `const user = '#old'\nconst pass = '#viejo'\n`)

    const outcomes = fix(
      makeRun([
        makeCase({ testFile }),
        makeCase({ testFile, selector: '#viejo', fixedSelector: "[data-testid='pass']" }),
      ]),
      { pageObjectRoots: [dir] }
    )

    expect(outcomes.every((o) => o.status === 'applied')).toBe(true)
    expect(readFileSync(po, 'utf-8')).toBe(`const user = '[data-testid='new']'\nconst pass = '[data-testid='pass']'\n`)
  })

  it('no toca un archivo que ya es testFile de otro caso — de eso se encarga el loop principal', () => {
    const testFile = spec()
    const otro = join(dir, 'e2e', 'otro.spec.ts')
    writeFileSync(otro, `page.click('#old')`)

    const outcomes = fix(
      makeRun([makeCase({ testFile }), makeCase({ testFile: otro })]),
      { pageObjectRoots: [dir] }
    )

    expect(outcomes).toContainEqual({ testFile, selector: '#old', status: 'skipped', reason: 'not-found' })
    expect(outcomes).toContainEqual({
      testFile: otro,
      selector: '#old',
      fixedSelector: "[data-testid='new']",
      status: 'applied',
    })
  })

  it('pageObjects:false restaura el comportamiento previo (--no-pom)', () => {
    const testFile = spec()
    const po = pageObject('login.page.ts', `export const btn = '#old'\n`)

    const outcomes = fix(makeRun([makeCase({ testFile })]), { pageObjectRoots: [dir], pageObjects: false })

    expect(outcomes).toEqual([{ testFile, selector: '#old', status: 'skipped', reason: 'not-found' }])
    expect(readFileSync(po, 'utf-8')).toBe(`export const btn = '#old'\n`)
  })
})

/**
 * Regresión del gap encontrado dogfoodeando `examples/playwright-pom`: con Playwright, casi
 * toda sugerencia con evidencia de página es de rol, y `role(...)` no es sustituible. Como el
 * chequeo de "sustituible" corría ANTES de mirar dónde vivía el selector, el fallback a page
 * objects no se disparaba nunca en el runner más usado — la feature era efectivamente código
 * muerto para Playwright.
 */
describe('fix — sugerencias de rol en page objects', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-role-pom-'))
    mockIsGitDirty.mockReturnValue(false)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function setup(framework: string) {
    const testFile = join(dir, 'e2e', 'login.spec.ts')
    mkdirSync(join(dir, 'e2e'), { recursive: true })
    writeFileSync(testFile, 'await shop.addToCart()')

    const po = join(dir, 'pages', 'shop.page.ts')
    mkdirSync(join(dir, 'pages'), { recursive: true })
    writeFileSync(po, `export const addToCart = '#old'\n`)

    const run = makeRun([
      makeCase({ testFile, fixedSelector: "role('button', { name: 'Comprar' })", selectorType: 'ROLE' }),
    ])
    return { testFile, po, run: { ...run, framework } }
  }

  it('Playwright: convierte a role=... y cura el page object', () => {
    const { testFile, po, run } = setup('Playwright')

    const outcomes = fix(run, { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([
      {
        testFile,
        selector: '#old',
        fixedSelector: 'role=button[name="Comprar"]',
        status: 'applied',
        appliedIn: po,
      },
    ])
    expect(readFileSync(po, 'utf-8')).toBe(`export const addToCart = 'role=button[name="Comprar"]'\n`)
  })

  it('Cypress: no inventa sintaxis que su motor no entiende', () => {
    // `role=button[name="X"]` es del motor de Playwright. En jQuery seria un selector invalido:
    // dejar el caso para revision manual es mejor que romper el page object.
    const { testFile, po, run } = setup('Cypress')

    const outcomes = fix(run, { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile, selector: '#old', status: 'skipped', reason: 'not-substitutable' }])
    expect(readFileSync(po, 'utf-8')).toBe(`export const addToCart = '#old'\n`)
  })

  it('si el selector SI esta en el spec, sigue yendo al AST (reescribe la llamada entera)', () => {
    const testFile = join(dir, 'a.spec.ts')
    writeFileSync(testFile, `await page.click('#old')`)
    const run = {
      ...makeRun([makeCase({ testFile, fixedSelector: "role('button', { name: 'Comprar' })" })]),
      framework: 'Playwright',
    }

    const outcomes = fix(run, { pageObjectRoots: [dir] })

    expect(outcomes).toEqual([{ testFile, selector: '#old', status: 'skipped', reason: 'not-substitutable' }])
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTestCommand, runValidation, runValidationCommand, snapshotFiles, restoreSnapshot } from '../validate'
import type { LocalRun } from '@healify/reporter-core'

function run(framework: string): LocalRun {
  return { project: 'demo', framework, generatedAt: new Date(), cases: [] }
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-validate-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('buildTestCommand', () => {
  it('playwright → npx playwright test <archivos>', () => {
    expect(buildTestCommand(run('Playwright'), ['a.spec.ts', 'b.spec.ts'])).toBe('npx playwright test a.spec.ts b.spec.ts')
  })

  it('cypress → npx cypress run --spec csv', () => {
    expect(buildTestCommand(run('Cypress'), ['a.cy.ts', 'b.cy.ts'])).toBe('npx cypress run --spec a.cy.ts,b.cy.ts')
  })

  it('selenium/webdriverio (vitest en los ejemplos) → npx vitest run', () => {
    expect(buildTestCommand(run('Selenium'), ['a.test.ts'])).toBe('npx vitest run a.test.ts')
    expect(buildTestCommand(run('WebdriverIO'), ['a.test.ts'])).toBe('npx vitest run a.test.ts')
  })

  it('framework desconocido → null (no se adivina)', () => {
    expect(buildTestCommand(run('Nightwatch'), ['a.spec.ts'])).toBeNull()
  })
})

describe('runValidationCommand', () => {
  it('exit 0 → ok', () => {
    const { ok } = runValidationCommand('node -e "process.exit(0)"')
    expect(ok).toBe(true)
  })

  it('exit != 0 → no ok, con salida', () => {
    const { ok, output } = runValidationCommand('node -e "console.error(\'boom\'); process.exit(1)"')
    expect(ok).toBe(false)
    expect(output).toContain('boom')
  })
})

describe('runValidation', () => {
  it('override gana al framework', () => {
    const result = runValidation(run('Nightwatch'), ['a.spec.ts'], 'node -e "process.exit(0)"')
    expect(result.ran).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.command).toBe('node -e "process.exit(0)"')
  })

  it('framework desconocido sin override → ran false con razón', () => {
    const result = runValidation(run('Nightwatch'), ['a.spec.ts'])
    expect(result.ran).toBe(false)
    expect(result.reason).toBe('no-framework')
  })

  it('test que falla → ran true, ok false', () => {
    const result = runValidation(run('Playwright'), ['a.spec.ts'], 'node -e "process.exit(2)"')
    expect(result.ran).toBe(true)
    expect(result.ok).toBe(false)
  })
})

describe('snapshotFiles / restoreSnapshot', () => {
  it('restaura el contenido original', () => {
    const file = join(dir, 'a.spec.ts')
    writeFileSync(file, 'original', 'utf-8')
    const snap = snapshotFiles([file])

    writeFileSync(file, 'cambiado', 'utf-8')
    restoreSnapshot(snap)

    expect(readFileSync(file, 'utf-8')).toBe('original')
  })

  it('borra archivos que no existían antes del fix', () => {
    const file = join(dir, 'nuevo.spec.ts')
    const snap = snapshotFiles([file])

    writeFileSync(file, 'creado por el fix', 'utf-8')
    restoreSnapshot(snap)

    expect(existsSync(file)).toBe(false)
  })

  it('tolera archivos que desaparecieron entre snapshot y restore', () => {
    const file = join(dir, 'a.spec.ts')
    writeFileSync(file, 'x', 'utf-8')
    const snap = snapshotFiles([file])
    rmSync(file)
    expect(() => restoreSnapshot(snap)).not.toThrow()
    expect(readFileSync(file, 'utf-8')).toBe('x')
  })
})

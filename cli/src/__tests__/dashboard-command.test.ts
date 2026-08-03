import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { appendHistory } from '../history'
import { runDashboard } from '../commands/dashboard'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: 'e2e/login.spec.ts',
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

describe('runDashboard()', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-dashboard-cmd-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('sin historial devuelve ok:true, mensaje claro y NO escribe archivo', () => {
    const result = runDashboard([], dir)

    expect(result.ok).toBe(true)
    expect(result.outPath).toBeUndefined()
    expect(result.stats.total).toBe(0)
    expect(result.lines.join('\n')).toContain('Todavía no hay historial')
    expect(existsSync(join(dir, 'healify-dashboard.html'))).toBe(false)
  })

  it('con historial escribe healify-dashboard.html por defecto y reporta cifras', () => {
    appendHistory(makeRun([makeCase({ selector: '#a' }), makeCase({ selector: '#b' })]), dir)

    const result = runDashboard([], dir)

    expect(result.ok).toBe(true)
    expect(result.outPath).toBe('healify-dashboard.html')
    expect(result.stats.total).toBe(2)
    expect(existsSync(join(dir, 'healify-dashboard.html'))).toBe(true)
    const html = readFileSync(join(dir, 'healify-dashboard.html'), 'utf-8')
    expect(html).toContain('Healify — Dashboard de curaciones')
    expect(html).toContain('#a')
    expect(result.lines.join('\n')).toContain('Dashboard generado en healify-dashboard.html')
  })

  it('--out escribe en la ruta indicada', () => {
    appendHistory(makeRun([makeCase({ selector: '#a' })]), dir)

    const result = runDashboard(['--out', 'mi-dashboard.html'], dir)

    expect(result.ok).toBe(true)
    expect(result.outPath).toBe('mi-dashboard.html')
    expect(existsSync(join(dir, 'mi-dashboard.html'))).toBe(true)
    expect(existsSync(join(dir, 'healify-dashboard.html'))).toBe(false)
  })

  it('falla con ok:false si no se puede escribir el archivo', () => {
    appendHistory(makeRun([makeCase({ selector: '#a' })]), dir)

    const result = runDashboard(['--out', 'no-existe/otro.html'], dir)

    expect(result.ok).toBe(false)
    expect(result.lines.join('\n')).toContain('No se pudo escribir')
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendRunRecord, type RunRecord } from '@healify/reporter-core'
import { runFlake } from '../commands/flake'

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    type: 'run',
    runId: 'run-1',
    timestamp: '2026-08-01T10:00:00.000Z',
    project: 'Playwright suite',
    framework: 'Playwright',
    total: 2,
    passed: 1,
    failed: 1,
    tests: [
      { testName: 'login ok', testFile: 'e2e/login.spec.ts', passed: true },
      { testName: 'pago ok', testFile: 'e2e/pago.spec.ts', passed: false },
    ],
    ...overrides,
  }
}

describe('runFlake()', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-flake-cmd-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('sin corridas devuelve ok:true, mensaje claro y tests vacíos', () => {
    const result = runFlake([], dir)

    expect(result.ok).toBe(true)
    expect(result.runs).toEqual([])
    expect(result.tests).toEqual([])
    expect(result.lines.join('\n')).toContain('Todavía no hay corridas registradas')
  })

  it('con corridas imprime flaky y siempre-roto, y el resumen', () => {
    appendRunRecord(
      makeRun({
        runId: 'r1',
        tests: [
          { testName: 'login ok', testFile: 'e2e/login.spec.ts', passed: true },
          { testName: 'pago ok', testFile: 'e2e/pago.spec.ts', passed: false },
        ],
      }),
      dir,
    )
    appendRunRecord(
      makeRun({
        runId: 'r2',
        tests: [
          { testName: 'login ok', testFile: 'e2e/login.spec.ts', passed: false },
          { testName: 'pago ok', testFile: 'e2e/pago.spec.ts', passed: false },
        ],
      }),
      dir,
    )

    const result = runFlake([], dir)

    expect(result.ok).toBe(true)
    expect(result.tests).toHaveLength(2)
    expect(result.lines.join('\n')).toContain('login ok (e2e/login.spec.ts) — 1/2 falló (50%)')
    expect(result.lines.join('\n')).toContain('pago ok (e2e/pago.spec.ts) — 2/2 falló')
    expect(result.lines.join('\n')).toContain('1 flaky de 2 tests con datos · 2 corridas registradas.')
  })

  it('sin flaky ni siempre-roto lo dice y el resumen da 0', () => {
    appendRunRecord(makeRun({ runId: 'r1', tests: [{ testName: 'login ok', testFile: 'a.spec.ts', passed: true }] }), dir)
    appendRunRecord(makeRun({ runId: 'r2', tests: [{ testName: 'login ok', testFile: 'a.spec.ts', passed: true }] }), dir)

    const result = runFlake([], dir)

    expect(result.lines.join('\n')).toContain('No hay tests flaky ni siempre-roto')
    expect(result.lines.join('\n')).toContain('0 flaky de 1 tests con datos · 2 corridas registradas.')
  })

  it('--min-runs cambia el piso para opinar', () => {
    appendRunRecord(makeRun({ runId: 'r1', tests: [{ testName: 'login ok', testFile: 'a.spec.ts', passed: false }] }), dir)
    appendRunRecord(makeRun({ runId: 'r2', tests: [{ testName: 'login ok', testFile: 'a.spec.ts', passed: true }] }), dir)

    const result = runFlake(['--min-runs', '3'], dir)

    expect(result.lines.join('\n')).toContain('No hay tests flaky ni siempre-roto')
  })
})

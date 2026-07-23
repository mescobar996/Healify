import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { appendHistory } from '../history'
import { history } from '../commands/history'

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

describe('history()', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-history-cmd-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('hasHistory: false cuando nunca se grabó nada', () => {
    expect(history(dir)).toEqual({ hasHistory: false, topRecurrent: [], rebroken: [] })
  })

  it('hasHistory: true y calcula ambas vistas cuando hay historial', () => {
    appendHistory(makeRun([makeCase({ selector: '#a' }), makeCase({ selector: '#a' })]), dir)

    const report = history(dir)

    expect(report.hasHistory).toBe(true)
    expect(report.topRecurrent).toEqual([{ selector: '#a', count: 2 }])
    expect(report.rebroken).toEqual([])
  })
})

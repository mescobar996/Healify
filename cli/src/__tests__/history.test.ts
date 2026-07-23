import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { appendHistory, readHistory } from '../history'

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

describe('appendHistory + readHistory', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-history-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('crea .healify/history.jsonl si no existe y graba una línea por caso', () => {
    appendHistory(makeRun([makeCase(), makeCase({ selector: '#other' })]), dir)

    expect(existsSync(join(dir, '.healify', 'history.jsonl'))).toBe(true)
    const entries = readHistory(dir)
    expect(entries).toHaveLength(2)
    expect(entries[0].selector).toBe('#old')
    expect(entries[1].selector).toBe('#other')
  })

  it('agrega (append) sin pisar lo que ya había', () => {
    appendHistory(makeRun([makeCase({ selector: '#first' })]), dir)
    appendHistory(makeRun([makeCase({ selector: '#second' })]), dir)

    const entries = readHistory(dir)
    expect(entries.map((e) => e.selector)).toEqual(['#first', '#second'])
  })

  it('readHistory devuelve [] si el archivo no existe todavía', () => {
    expect(readHistory(dir)).toEqual([])
  })

  it('readHistory ignora líneas corruptas sin reventar', () => {
    appendHistory(makeRun([makeCase({ selector: '#valid' })]), dir)
    const historyPath = join(dir, '.healify', 'history.jsonl')
    const raw = readFileSync(historyPath, 'utf-8')
    writeFileSync(historyPath, raw + 'esto no es json\n')

    const entries = readHistory(dir)
    expect(entries).toHaveLength(1)
    expect(entries[0].selector).toBe('#valid')
  })

  it('cada línea tiene timestamp ISO y los campos de LocalCaseResult relevantes', () => {
    appendHistory(makeRun([makeCase()]), dir)

    const [entry] = readHistory(dir)
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(entry.testFile).toBe('e2e/login.spec.ts')
    expect(entry.testName).toBe('un test')
    expect(entry.status).toBe('healed')
    expect(entry.fixedSelector).toBe("[data-testid='new']")
    expect(entry.selectorType).toBe('TESTID')
    expect(entry.confidence).toBe(0.95)
  })
})

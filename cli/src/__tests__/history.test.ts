import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { appendHistory, readHistory } from '../history'
import { computeTopRecurrent, computeRebroken, type HistoryEntry } from '../history'

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-07-01T00:00:00.000Z',
    testFile: 'e2e/login.spec.ts',
    testName: 'un test',
    selector: '#old',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    selectorType: 'TESTID',
    confidence: 0.95,
    ...overrides,
  }
}

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

describe('computeTopRecurrent', () => {
  it('cuenta apariciones por selector y ordena de mayor a menor', () => {
    const entries = [
      makeEntry({ selector: '#a' }),
      makeEntry({ selector: '#b' }),
      makeEntry({ selector: '#a' }),
      makeEntry({ selector: '#a' }),
    ]

    expect(computeTopRecurrent(entries)).toEqual([
      { selector: '#a', count: 3 },
      { selector: '#b', count: 1 },
    ])
  })

  it('respeta el límite (top N)', () => {
    const entries = ['#a', '#b', '#c'].map((selector) => makeEntry({ selector }))
    expect(computeTopRecurrent(entries, 2)).toHaveLength(2)
  })

  it('devuelve [] si no hay entradas', () => {
    expect(computeTopRecurrent([])).toEqual([])
  })
})

describe('computeRebroken', () => {
  it('marca un selector como re-roto si su primera aparición fue healed y volvió a aparecer', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]

    expect(computeRebroken(entries)).toEqual([
      { selector: '#a', count: 2, firstHealedAt: '2026-07-01T00:00:00.000Z' },
    ])
  })

  it('no marca un selector que solo aparece una vez', () => {
    const entries = [makeEntry({ selector: '#a', status: 'healed' })]
    expect(computeRebroken(entries)).toEqual([])
  })

  it('no marca un selector curado dos veces seguidas sin volver a romperse en el medio', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'healed', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]
    expect(computeRebroken(entries)).toEqual([])
  })

  it('no marca un selector cuya primera aparición nunca fue healed', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]
    expect(computeRebroken(entries)).toEqual([])
  })

  it('ordena por cantidad de apariciones descendente', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
      makeEntry({ selector: '#b', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#b', status: 'review', timestamp: '2026-07-05T00:00:00.000Z' }),
      makeEntry({ selector: '#b', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]
    expect(computeRebroken(entries).map((r) => r.selector)).toEqual(['#b', '#a'])
  })
})

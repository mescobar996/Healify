import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendRunRecord, readRunRecords, parseRunLines, serializeRunRecord, type RunRecord } from '../runs'

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    type: 'run',
    runId: '2026-08-03T10:00:00.000Z',
    timestamp: '2026-08-03T10:00:00.000Z',
    project: 'Playwright suite',
    framework: 'Playwright',
    total: 2,
    passed: 1,
    failed: 1,
    tests: [
      { testName: 'login ok', testFile: 'e2e/login.spec.ts', passed: true },
      { testName: 'logout ok', testFile: 'e2e/login.spec.ts', passed: false },
    ],
    ...overrides,
  }
}

describe('serializeRunRecord + parseRunLines', () => {
  it('redondea el run a una línea JSON parseable', () => {
    const record = makeRun()
    const lines = parseRunLines(serializeRunRecord(record) + '\n')

    expect(lines).toEqual([record])
  })

  it('ignora líneas corruptas sin romper el resto', () => {
    const good = serializeRunRecord(makeRun())
    const lines = parseRunLines(`basura no-json\n\n${good}\n{ json: roto }\n`)

    expect(lines).toEqual([makeRun()])
  })

  it('devuelve [] con cadena vacía o solo saltos de línea', () => {
    expect(parseRunLines('')).toEqual([])
    expect(parseRunLines('\n\n')).toEqual([])
  })
})

describe('appendRunRecord + readRunRecords', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-runs-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('[] cuando no existe el archivo', () => {
    expect(readRunRecords(dir)).toEqual([])
  })

  it('appendea y lee varias corridas en orden', () => {
    const first = makeRun({ runId: 'a', timestamp: '2026-08-01T10:00:00.000Z' })
    const second = makeRun({ runId: 'b', timestamp: '2026-08-02T10:00:00.000Z' })

    appendRunRecord(first, dir)
    appendRunRecord(second, dir)

    expect(readRunRecords(dir)).toEqual([first, second])
  })

  it('escribe sin BOM (JSON.parse aguanta)', () => {
    appendRunRecord(makeRun(), dir)
    const raw = readFileSync(join(dir, '.healify', 'runs.jsonl'), 'utf-8')

    expect(raw.charCodeAt(0)).not.toBe(0xfeff)
    expect(JSON.parse(raw.trim())).toEqual(makeRun())
  })
})

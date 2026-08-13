import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDefectId } from '@healify/reporter-core'
import { runConfirm } from '../commands/confirm'

let dir: string
const historyPath = () => join(dir, '.healify', 'history.jsonl')

function entry(selector: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    timestamp: '2026-08-13T00:00:00.000Z',
    testFile: 'e2e/a.spec.ts',
    testName: 'test',
    selector,
    status: 'healed',
    fixedSelector: `[data-testid='${selector.slice(1)}']`,
    selectorType: 'TESTID',
    confidence: 0.95,
    ...overrides,
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-confirm-'))
  const history = join(dir, '.healify')
  const { mkdirSync } = require('node:fs')
  mkdirSync(history, { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('runConfirm', () => {
  it('marca como aceptado el defectId indicado y reescribe el historial', () => {
    const a = entry('#btn-a')
    const b = entry('#btn-b')
    writeFileSync(historyPath(), `${JSON.stringify(a)}\n${JSON.stringify(b)}\n`, 'utf-8')
    const defectId = buildDefectId('e2e/a.spec.ts', '#btn-a')

    const result = runConfirm(['--id', defectId], dir)

    expect(result.ok).toBe(true)
    expect(result.updated).toBe(1)
    expect(result.lines[0]).toContain('aceptado')
    const lines = readFileSync(historyPath(), 'utf-8').trim().split('\n').map((l) => JSON.parse(l))
    expect(lines.find((l) => l.selector === '#btn-a').accepted).toBe(true)
    expect(lines.find((l) => l.selector === '#btn-b').accepted).toBeUndefined()
  })

  it('--rejected marca como rechazado', () => {
    writeFileSync(historyPath(), `${JSON.stringify(entry('#btn-a'))}\n`, 'utf-8')
    const defectId = buildDefectId('e2e/a.spec.ts', '#btn-a')

    const result = runConfirm(['--id', defectId, '--rejected'], dir)

    expect(result.ok).toBe(true)
    expect(result.lines[0]).toContain('rechazado')
    const parsed = JSON.parse(readFileSync(historyPath(), 'utf-8').trim().split('\n')[0])
    expect(parsed.accepted).toBe(false)
  })

  it('id inexistente → ok false con mensaje claro', () => {
    writeFileSync(historyPath(), `${JSON.stringify(entry('#btn-a'))}\n`, 'utf-8')
    const result = runConfirm(['--id', 'HLF-NOPE'], dir)
    expect(result.ok).toBe(false)
    expect(result.lines[0]).toContain('No encontré ningún selector')
  })

  it('sin --id → uso, ok false', () => {
    const result = runConfirm([], dir)
    expect(result.ok).toBe(false)
    expect(result.lines[0]).toContain('Uso:')
  })

  it('sin historial → mensaje claro, ok false', () => {
    const result = runConfirm(['--id', 'HLF-X'], dir)
    expect(result.ok).toBe(false)
    expect(result.lines[0]).toContain('No existe')
  })

  it('tolera líneas corruptas (parse tolerante) y conserva las demás', () => {
    const a = entry('#btn-a')
    writeFileSync(historyPath(), `{corrupto\n${JSON.stringify(a)}\n`, 'utf-8')
    const defectId = buildDefectId('e2e/a.spec.ts', '#btn-a')

    const result = runConfirm(['--id', defectId], dir)

    expect(result.ok).toBe(true)
    expect(result.updated).toBe(1)
  })
})

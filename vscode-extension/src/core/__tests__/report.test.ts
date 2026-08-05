import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readReportCases } from '../report'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-vscode-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const VALID_REPORT = JSON.stringify({
  cases: [{ selector: '#btn', status: 'healed', fixedSelector: "role('button', { name: 'X' })", verified: true }],
})

describe('readReportCases', () => {
  it('lee healify-report.json de la raíz del proyecto', () => {
    writeFileSync(join(dir, 'healify-report.json'), VALID_REPORT)
    expect(readReportCases(dir)).toHaveLength(1)
  })

  it('prefiere .healify/ sobre la raíz, igual que el CLI', () => {
    mkdirSync(join(dir, '.healify'))
    writeFileSync(join(dir, '.healify', 'healify-report.json'), VALID_REPORT)
    writeFileSync(join(dir, 'healify-report.json'), JSON.stringify({ cases: [] }))

    expect(readReportCases(dir)).toHaveLength(1)
  })

  it('acepta una ruta explícita', () => {
    writeFileSync(join(dir, 'otro.json'), VALID_REPORT)
    expect(readReportCases(dir, 'otro.json')).toHaveLength(1)
  })

  it('devuelve vacío si no hay reporte', () => {
    expect(readReportCases(dir)).toEqual([])
  })

  /**
   * El editor puede leer el archivo justo mientras el reporter lo está volcando. Un JSON a
   * medio escribir no puede tumbar la extensión: sin reporte simplemente no hay diagnósticos
   * de ese nivel, y el lint en vivo sigue andando.
   */
  it('devuelve vacío con un JSON a medio escribir, sin tirar', () => {
    writeFileSync(join(dir, 'healify-report.json'), '{ "cases": [{ "selec')
    expect(() => readReportCases(dir)).not.toThrow()
    expect(readReportCases(dir)).toEqual([])
  })

  it('descarta entradas con forma inesperada en vez de romper', () => {
    writeFileSync(
      join(dir, 'healify-report.json'),
      JSON.stringify({ cases: [null, 42, { selector: '#ok', status: 'healed' }, { status: 'sin-selector' }] })
    )

    const cases = readReportCases(dir)
    expect(cases).toHaveLength(1)
    expect(cases[0].selector).toBe('#ok')
  })

  it('devuelve vacío si cases no es un array', () => {
    writeFileSync(join(dir, 'healify-report.json'), JSON.stringify({ cases: 'nope' }))
    expect(readReportCases(dir)).toEqual([])
  })
})

import { describe, it, expect, vi } from 'vitest'
import { startFixWatch, parseInterval, parseReportPath, DEFAULT_INTERVAL_MS, type WatchDeps } from '../commands/watch'
import type { FileStamp } from '../watch'
import type { ApplyOptions } from '../commands/fix-pr'

const OPTS: ApplyOptions = { dryRun: false, force: false, ast: true, pageObjects: true }

/**
 * Deps falsas: el loop entero se ejecuta sin timers reales ni disco. `tick()` se dispara a
 * mano, que es lo que permite testear "no re-aplica si nada cambió" sin esperar segundos.
 */
function makeDeps(stamps: (FileStamp | null)[], applyResult: boolean | boolean[] = true) {
  const applied: string[] = []
  const logs: string[] = []
  let call = 0

  const deps: WatchDeps = {
    stamp: () => stamps[Math.min(call, stamps.length - 1)],
    apply: (path) => {
      applied.push(path)
      const result = Array.isArray(applyResult) ? applyResult[applied.length - 1] ?? true : applyResult
      return result
    },
    setInterval: () => 0,
    log: (m) => logs.push(m),
  }

  return { deps, applied, logs, advance: () => { call++ } }
}

function stamp(mtimeMs: number, size: number): FileStamp {
  return { mtimeMs, size }
}

describe('startFixWatch()', () => {
  it('aplica inmediatamente al arrancar, sin esperar un intervalo', () => {
    const { deps, applied } = makeDeps([stamp(1, 10)])

    startFixWatch('healify-report.json', OPTS, 1000, deps)

    expect(applied).toEqual(['healify-report.json'])
  })

  it('no re-aplica mientras el reporte no cambie', () => {
    const { deps, applied } = makeDeps([stamp(1, 10)])

    const tick = startFixWatch('r.json', OPTS, 1000, deps)
    tick()
    tick()

    expect(applied).toHaveLength(1)
  })

  it('re-aplica cuando el reporte cambia (corrida nueva)', () => {
    const { deps, applied, advance } = makeDeps([stamp(1, 10), stamp(2, 12)])

    const tick = startFixWatch('r.json', OPTS, 1000, deps)
    advance()
    tick()

    expect(applied).toHaveLength(2)
  })

  it('reporte borrado y recreado vuelve a aplicar', () => {
    const { deps, applied, advance } = makeDeps([stamp(1, 10), null, stamp(3, 14)])

    const tick = startFixWatch('r.json', OPTS, 1000, deps)
    advance()
    tick() // desapareció: hay cambio, pero apply falla y no cuenta como aplicado real
    advance()
    tick() // volvió: re-aplica

    expect(applied).toHaveLength(3)
  })

  it('avisa UNA sola vez que está esperando el reporte, no spamea el loop', () => {
    // stamp null constante + apply que siempre falla = el caso "todavía no corriste los tests"
    const { deps, logs } = makeDeps([null], false)

    const tick = startFixWatch('healify-report.json', OPTS, 1000, deps)
    tick()
    tick()

    const avisos = logs.filter((l) => l.includes('Esperando'))
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain('healify-report.json')
  })

  it('programa el intervalo pedido', () => {
    const { deps } = makeDeps([stamp(1, 10)])
    const spy = vi.spyOn(deps, 'setInterval')

    startFixWatch('r.json', OPTS, 2500, deps)

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 2500)
  })
})

describe('parseInterval()', () => {
  it('sin flag usa el default', () => {
    expect(parseInterval(['fix', '--watch'])).toBe(DEFAULT_INTERVAL_MS)
  })

  it('toma el valor pedido', () => {
    expect(parseInterval(['fix', '--watch', '--interval', '2500'])).toBe(2500)
  })

  it('un valor no numérico cae al default en vez de romper el loop', () => {
    expect(parseInterval(['fix', '--watch', '--interval', 'rapido'])).toBe(DEFAULT_INTERVAL_MS)
  })

  it('un intervalo demasiado chico cae al default — competiría con la escritura del reporte', () => {
    expect(parseInterval(['fix', '--watch', '--interval', '5'])).toBe(DEFAULT_INTERVAL_MS)
  })

  it('trunca a entero', () => {
    expect(parseInterval(['fix', '--watch', '--interval', '1500.7'])).toBe(1500)
  })
})

describe('parseReportPath()', () => {
  it('sin path posicional usa healify-report.json', () => {
    expect(parseReportPath(['fix', '--dry-run'])).toBe('healify-report.json')
  })

  it('toma el path posicional', () => {
    expect(parseReportPath(['fix', 'otro-reporte.json', '--dry-run'])).toBe('otro-reporte.json')
  })

  it('regresión: el valor de --interval NO es el path del reporte', () => {
    // Bug real: `find(a => !a.startsWith('--'))` tomaba "500" como el path, y el watch
    // terminaba vigilando un archivo llamado "500" que nunca iba a existir.
    expect(parseReportPath(['fix', '--watch', '--interval', '500'])).toBe('healify-report.json')
  })

  it('con --interval Y path explícito, gana el path', () => {
    expect(parseReportPath(['fix', '--watch', '--interval', '500', 'mi-reporte.json'])).toBe('mi-reporte.json')
  })

  it('el path antes de --interval también se respeta', () => {
    expect(parseReportPath(['fix', 'mi-reporte.json', '--watch', '--interval', '500'])).toBe('mi-reporte.json')
  })
})

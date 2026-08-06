import { stampOf, makeChangeDetector, type FileStamp } from '../watch'
import { applyFixOnce, type ApplyOptions } from './fix-pr'

/**
 * `healify fix --watch` — vigila el reporte y re-aplica en cada corrida nueva.
 *
 * El análogo del `--ui` de Playwright para el lado de Healify: en vez de correr los tests,
 * esperar, y acordarse de volver a tipear `healify fix`, el loop lo hace solo cada vez que el
 * runner escribe un reporte nuevo.
 *
 * Todo el estado externo (reloj, disco, salida) entra por `WatchDeps` para que el loop se
 * pueda testear entero sin timers reales ni tocar el filesystem — que es la única forma de
 * verificar "no re-aplica si nada cambió" sin que el test tarde segundos de verdad.
 */

export const DEFAULT_INTERVAL_MS = 1000
/** Piso del intervalo: por debajo de esto el polling compite con la escritura del reporte y
 * empieza a leer archivos a medio escribir. */
const MIN_INTERVAL_MS = 100

export interface WatchDeps {
  stamp: (path: string) => FileStamp | null
  /** Una pasada de fix. `false` si el reporte todavía no se puede leer. */
  apply: (path: string, opts: ApplyOptions) => boolean
  setInterval: (fn: () => void, ms: number) => unknown
  log: (message: string) => void
}

const defaultDeps: WatchDeps = {
  stamp: stampOf,
  apply: applyFixOnce,
  setInterval: (fn, ms) => setInterval(fn, ms),
  log: (message) => console.log(message),
}

/**
 * Flags de `fix` que consumen el argumento siguiente. Importa para no confundir ese valor con
 * el path posicional del reporte: hasta que existió `--interval`, ningún flag llevaba valor y
 * "el primer argumento que no empieza con --" alcanzaba. Con `fix --watch --interval 500`, esa
 * heurística tomaba `500` como si fuera `healify-report.json` (bug real, encontrado corriendo
 * el comando de verdad — los tests con deps inyectadas no lo veían porque no parsean argv).
 */
const VALUE_FLAGS = new Set(['--interval'])

/**
 * Path posicional del reporte, salteando los valores de los flags que los consumen.
 * `healify-report.json` si no hay ninguno.
 */
export function parseReportPath(args: string[], fallback = 'healify-report.json'): string {
  const rest = args.slice(1)
  for (let i = 0; i < rest.length; i++) {
    if (VALUE_FLAGS.has(rest[i])) {
      i++ // saltear el valor del flag, no es el path
      continue
    }
    if (!rest[i].startsWith('--')) return rest[i]
  }
  return fallback
}

/**
 * `--interval <ms>`. Un valor no numérico o absurdamente chico cae al default en vez de romper:
 * el usuario está pidiendo un loop, no una validación de argumentos.
 */
export function parseInterval(args: string[]): number {
  const index = args.indexOf('--interval')
  if (index === -1) return DEFAULT_INTERVAL_MS
  const raw = Number(args[index + 1])
  if (!Number.isFinite(raw) || raw < MIN_INTERVAL_MS) return DEFAULT_INTERVAL_MS
  return Math.floor(raw)
}

/**
 * Arranca el loop. Devuelve el tick para poder dispararlo a mano en tests; en producción lo
 * llama el `setInterval`.
 *
 * La primera pasada es inmediata (no espera un intervalo): si ya hay un reporte cuando arrancás
 * el watch, se aplica ahí mismo.
 */
export function startFixWatch(
  reportPath: string,
  opts: ApplyOptions,
  intervalMs: number = DEFAULT_INTERVAL_MS,
  deps: WatchDeps = defaultDeps
): () => void {
  const detector = makeChangeDetector()
  let warnedMissing = false

  function tick(): void {
    if (!detector.shouldApply(deps.stamp(reportPath))) return

    if (!deps.apply(reportPath, opts)) {
      // Sin reporte todavía. Se avisa una sola vez: en un loop de 1 s, repetirlo sería spam
      // que además taparía la salida útil cuando el reporte por fin aparezca.
      if (!warnedMissing) {
        warnedMissing = true
        deps.log(`Esperando ${reportPath} — corré tus tests y lo aplico solo.`)
      }
      return
    }

    warnedMissing = false
    deps.log('')
  }

  tick()
  deps.setInterval(tick, intervalMs)
  return tick
}

/** Punto de entrada del CLI. Imprime el encabezado y arranca el loop, que no termina nunca. */
export function runFixWatch(reportPath: string, opts: ApplyOptions, intervalMs: number): void {
  const flags = [opts.dryRun ? '--dry-run' : '', opts.recordHistory ? '--record-history' : '', opts.ast ? '' : '--no-ast', opts.pageObjects ? '' : '--no-pom']
    .filter(Boolean)
    .join(' ')

  console.log(`Healify fix --watch — ${reportPath}${flags ? ` (${flags})` : ''}`)
  console.log(`Vigilando cada ${intervalMs} ms. Ctrl+C para salir.\n`)

  startFixWatch(reportPath, opts, intervalMs)
}

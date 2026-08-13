import { analyzeAndHeal, domContextFromProbeResult, resolveLocatorStrategy, readRepertoire } from '@healify/reporter-core'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { performance } from 'perf_hooks'

/**
 * `healify heal` — el motor expuesto como comando que habla JSON, para que cualquier
 * lenguaje que pueda spawnear un subproceso lo use sin reescribir la heurística.
 *
 * La lógica vive acá, separada de `index.ts` (que solo lee stdin y escribe stdout) — mismo
 * patrón que `commands/doctor.ts`/`commands/init.ts`: testeable sin tocar streams reales.
 *
 * Métricas locales (sin telemetría externa): cada corrida mide el tiempo de sus fases y
 * acumula estadísticas en `~/.healify/stats.json`, para que el usuario vea qué tan bien le
 * va el healing sin que un solo byte salga de la máquina.
 */

export interface HealCommandInput {
  selector: string
  testFile?: string
  errorMessage?: string
  /** El mismo array que devuelve BROWSER_PROBE_SCRIPT al correr en el browser — de cualquier
   * lenguaje, vía su propio driver.execute_script()/executeScript() equivalente. Sin validar
   * acá: viene de JSON externo, `domContextFromProbeResult` es quien de verdad lo verifica. */
  pageElements?: unknown
  /** Atributos de test-id adicionales del proyecto, para extender los 5 built-in. */
  customTestIds?: string[]
}

export interface HealCommandOutput {
  fixedSelector: string
  confidence: number
  verified: boolean
  fromRepertoire: boolean
  needsReview: boolean
  explanation: string
  selectorType: string
  /** Lo que un driver de cualquier lenguaje puede ejecutar de verdad — ya resuelto, no hace
   * falta que el cliente sepa nada sobre la sintaxis role(...) de Playwright. */
  locator: { strategy: 'css' | 'xpath' | 'unsupported'; value: string | null }
  /** Alternativas del motor ordenadas por prioridad, además de la ganadora. La primera (si
   * existe) es la sugerencia que solo pierde contra el selector verificado en vivo — el mismo
   * concepto de recovery-tries de Healenium, expuesto para que el cliente pueda reintentar
   * cuando el locator principal falle. */
  alternatives?: { selector: string; confidence: number }[]
  /** Tiempo de cada fase de la corrida, en ms — para que el caller mida sin tocar la nube. */
  timings: HealPhaseTimings
}

/** Tiempo de ejecución por fase de la corrida, en ms. Todo medido local, nada sale de la máquina. */
export interface HealPhaseTimings {
  /** Procesar y validar el payload del probe en vivo que mandó el caller (`domContextFromProbeResult`). */
  probeMs: number
  /** Motor: análisis del selector + generación de estrategias de sanado (`analyzeAndHeal`). */
  analysisMs: number
  /** Resto del pipeline de healing: leer el repertorio, resolver el locator ejecutable y armar la respuesta. */
  healingMs: number
  /** Duración total de la corrida. */
  totalMs: number
}

export type HealCommandResult = { ok: true; output: HealCommandOutput } | { ok: false; error: string }

/** Opciones de la corrida — todas inyectables para no depender del estado real de la máquina en tests. */
export interface HealRunOptions {
  /** Ruta del archivo de estadísticas locales. `null` desactiva el guardado. Default: `~/.healify/stats.json`. */
  statsPath?: string | null
}

/** Estadísticas acumuladas del comando heal. Viven SOLO en la máquina del usuario (`~/.healify/stats.json`). */
export interface HealStats {
  /** Total de selectores analizados. */
  totalAnalyzed: number
  /** Los que terminaron en una sugerencia aplicable directo (`needsReview === false`). */
  healed: number
  /** Los que no: sugerencia que requiere revisión manual. */
  failed: number
  /** Conteo por tipo de selector resultante (role/testid/css/...), en minúscula. */
  byType: Record<string, number>
  /** Suma de duraciones totales (ms) — insumo del promedio. */
  totalHealingMs: number
  /** Tiempo promedio de healing por selector analizado (ms). */
  avgHealingMs: number
}

/** Estadísticas vacías — el punto de partida de cualquier corrida. */
export function emptyHealStats(): HealStats {
  return { totalAnalyzed: 0, healed: 0, failed: 0, byType: {}, totalHealingMs: 0, avgHealingMs: 0 }
}

/** `~/.healify/stats.json` — la estadística vive con el usuario, nunca se envía a ningún lado. */
export function defaultStatsPath(): string {
  return join(homedir(), '.healify', 'stats.json')
}

/** Lee las estadísticas acumuladas. Tolerante por diseño: archivo ausente o corrupto → arranca de cero. */
export function readHealStats(path: string = defaultStatsPath()): HealStats {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (isRawStats(parsed)) {
      return {
        totalAnalyzed: parsed.totalAnalyzed,
        healed: asNumber(parsed.healed),
        failed: asNumber(parsed.failed),
        byType: asCountMap(parsed.byType),
        totalHealingMs: asNumber(parsed.totalHealingMs),
        avgHealingMs: asNumber(parsed.avgHealingMs),
      }
    }
  } catch {
    // archivo ausente o corrupto: empezar de cero, nunca romper el heal por esto
  }
  return emptyHealStats()
}

/** Forma mínima del `stats.json` que escribe el propio Healify; se valida el único campo obligatorio. */
interface RawStats {
  totalAnalyzed: number
  healed?: unknown
  failed?: unknown
  byType?: unknown
  totalHealingMs?: unknown
  avgHealingMs?: unknown
}

function isRawStats(value: unknown): value is RawStats {
  return typeof value === 'object' && value !== null && 'totalAnalyzed' in value && typeof value.totalAnalyzed === 'number'
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

/** Reconstruye el mapa por tipo copiando solo entradas numéricas — nunca confiar en el objeto crudo del disco. */
function asCountMap(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {}
  const result: Record<string, number> = {}
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number') result[key] = count
  }
  return result
}

/** Escribe las estadísticas. Falla en silencio: perder stats no debe romper el heal. */
export function writeHealStats(stats: HealStats, path: string = defaultStatsPath()): void {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(stats, null, 2), 'utf-8')
  } catch {
    // sin permisos o disco lleno: el heal sigue siendo más importante que las métricas
  }
}

/** Acumula una corrida en las estadísticas y devuelve el nuevo estado (sin escribir a disco). */
export function accumulateHealStats(
  previous: HealStats,
  outcome: 'healed' | 'failed',
  selectorType: string,
  totalMs: number
): HealStats {
  const key = selectorType.toLowerCase()
  const totalAnalyzed = previous.totalAnalyzed + 1
  return {
    totalAnalyzed,
    healed: previous.healed + (outcome === 'healed' ? 1 : 0),
    failed: previous.failed + (outcome === 'failed' ? 1 : 0),
    byType: { ...previous.byType, [key]: (previous.byType[key] ?? 0) + 1 },
    totalHealingMs: previous.totalHealingMs + totalMs,
    avgHealingMs: Math.round((previous.totalHealingMs + totalMs) / totalAnalyzed),
  }
}

/**
 * Resumen humano para `heal --stats`, leído de las estadísticas acumuladas. Ej:
 * `✅ 3 selectores sanados (2 roles, 1 testid) en 234ms — tasa de éxito: 67%`
 */
export function formatHealStatsSummary(stats: HealStats): string {
  const types = Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${count} ${pluralizeType(type, count)}`)
  const byType = types.length > 0 ? ` (${types.join(', ')})` : ''
  const rate = stats.totalAnalyzed > 0 ? Math.round((stats.healed / stats.totalAnalyzed) * 100) : 0
  return `✅ ${stats.healed} selectores sanados${byType} en ${stats.avgHealingMs}ms — tasa de éxito: ${rate}%`
}

function pluralizeType(type: string, count: number): string {
  if (count === 1) return type
  if (type === 'css' || type === 'mixed') return type
  return type.endsWith('s') ? type : `${type}s`
}

function isValidInput(value: unknown): value is HealCommandInput {
  if (typeof value !== 'object' || value === null) return false
  return 'selector' in value && typeof value.selector === 'string' && value.selector.length > 0
}

/**
 * `cwd` inyectable para tests (evita depender de `.healify/history.jsonl` real del proceso).
 * El repertorio se consulta acá, del lado del servidor — el cliente no necesita saber nada
 * sobre su formato ni su ubicación.
 *
 * Cada corrida mide el tiempo de sus fases y acumula estadísticas en `~/.healify/stats.json`
 * (desactivables con `{ statsPath: null }` o redirigibles en tests). Sin telemetría externa.
 */
export function runHeal(rawInput: unknown, cwd: string = process.cwd(), options?: HealRunOptions): HealCommandResult {
  if (!isValidInput(rawInput)) {
    return { ok: false, error: "Input inválido: se espera un JSON con al menos { \"selector\": string }." }
  }

  const tStart = performance.now()
  try {
    // domContextFromProbeResult valida la forma real (no confiar a ciegas en JSON que vino de
    // otro lenguaje) además de formatear — mismo criterio que ya usan los plugins JS con lo
    // que devuelve executeScript(). Es la fase "probe" del lado del servidor.
    const tProbeStart = performance.now()
    const htmlContext = domContextFromProbeResult(rawInput.pageElements)
    const tProbeEnd = performance.now()
    const repertoire = readRepertoire(cwd)

    const tAnalysisStart = performance.now()
    const heal = analyzeAndHeal({
      selector: rawInput.selector,
      testFile: rawInput.testFile,
      errorMessage: rawInput.errorMessage,
      htmlContext,
      repertoire,
      customTestIds: rawInput.customTestIds,
    })
    const tAnalysisEnd = performance.now()

    // El "healing" final: convertir la sugerencia ganadora en un locator ejecutable.
    const locator = resolveLocatorStrategy(heal.fixedSelector)
    const tEnd = performance.now()

    const totalMs = tEnd - tStart
    const probeMs = tProbeEnd - tProbeStart
    const analysisMs = tAnalysisEnd - tAnalysisStart
    const healingMs = Math.max(0, totalMs - probeMs - analysisMs)

    const output: HealCommandOutput = {
      fixedSelector: heal.fixedSelector,
      confidence: heal.confidence,
      verified: heal.verified,
      fromRepertoire: heal.fromRepertoire,
      needsReview: heal.needsReview,
      explanation: heal.explanation,
      selectorType: heal.selectorType,
      locator,
      alternatives: heal.alternatives,
      timings: { probeMs, analysisMs, healingMs, totalMs },
    }

    if (options?.statsPath !== null) {
      const statsPath = options?.statsPath ?? defaultStatsPath()
      // Una sugerencia que necesita revisión manual no es un sanado en firme: se cuenta como
      // fallida para la tasa de éxito. Los errores de protocolo (input inválido) ni siquiera
      // llegan acá — no son un análisis de selector.
      const stats = accumulateHealStats(
        readHealStats(statsPath),
        heal.needsReview ? 'failed' : 'healed',
        heal.selectorType,
        totalMs
      )
      writeHealStats(stats, statsPath)
    }

    return { ok: true, output }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

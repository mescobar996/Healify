import { createHash } from 'node:crypto'
import { buildDashboardStats, FAILURE_CAUSE_LABEL, type FailureCause, type HistoryEntry, type TimelinePoint } from '@healify/reporter-core'

/**
 * Lógica pura del dashboard `--serve`: agrupar el historial por selector, calcular
 * resúmenes, timelines y el vistazo general. Nada de servidor acá — testeable sin abrir
 * un puerto. Las rutas HTTP viven en dashboard-routes.ts y el server en dashboard-app.ts.
 */

export interface SelectorSummary {
  id: string
  selector: string
  testFile: string | null
  type: string
  failCount: number
  lastSuggestion: string | null
  lastHealed: string | null
  firstSeen: string
  lastSeen: string
  chronic: boolean
}

export interface SelectorSuggestion {
  timestamp: string
  testFile: string | null
  testName: string | null
  status: 'healed' | 'review' | 'unresolved'
  fixedSelector: string | null
  confidence: number | null
  verified: boolean | null
  cause: string | null
}

export interface SelectorDetail extends SelectorSummary {
  suggestions: SelectorSuggestion[]
  timeline: TimelinePoint[]
}

export interface StatsOverview {
  totalAnalyzed: number
  healed: number
  failed: number
  byType: Record<string, number>
  avgHealingMs: number
  totalHealingMs: number
  healRate: number
  /** Eficacia de los fixes: de los confirmados vía `healify confirm`, cuántos se aceptaron
   * sin revertir. `rate` es null hasta que haya al menos una confirmación. */
  efficacy: {
    accepted: number
    rejected: number
    unconfirmed: number
    rate: number | null
  }
  /** Reporte de eficacia completo (sección "Eficacia" del dashboard): totales, desglose por
   * framework, tendencia en la ventana pedida y desglose por causa de fallo. */
  efficacyReport: EfficacyReport
  history: {
    total: number
    healed: number
    review: number
    unresolved: number
    healedRate: number
    firstSeen: string | null
    lastSeen: string | null
    timeline: TimelinePoint[]
  }
}

/** Agregados de aceptación/rechazo de un grupo de entradas. `rate` es null hasta que haya
 * al menos una confirmación (0/0 no es un número). */
export interface EfficacyTotals {
  accepted: number
  rejected: number
  /** Sin confirmar vía `healify confirm` — no cuentan para la tasa pero se reportan. */
  pending: number
  rate: number | null
}

/** Un día de la tendencia de eficacia. */
export interface TrendEfficacyPoint {
  date: string
  accepted: number
  rejected: number
}

/** Aceptación/rechazo por causa de fallo (clave = etiqueta de FAILURE_CAUSE_LABEL). */
export interface CauseEfficacy {
  accepted: number
  rejected: number
  total: number
}

/** Reporte de la sección "Eficacia": totales + desgloses que alimentan los gráficos. */
export interface EfficacyReport {
  totals: EfficacyTotals
  /** Por framework; las entradas viejas sin campo `framework` caen en "unknown". */
  byFramework: Record<string, EfficacyTotals>
  /** Diario, desde (hoy - ventana + 1) hasta hoy, días sin datos en 0. */
  trend: TrendEfficacyPoint[]
  /** Por causa de fallo, con etiquetas locales ("Selector roto", "Aserción", …). */
  byCause: Record<string, CauseEfficacy>
}

/** Clave canónica de agrupación: archivo + selector, la misma que usa computeChronic. */
function selectorKey(entry: Pick<HistoryEntry, 'testFile' | 'selector'>): string {
  return `${entry.testFile ?? ''}\u0000${entry.selector}`
}

/** Id estable para la API: sha256(testFile+selector). Determinista, no depende del orden. */
export function selectorId(entry: Pick<HistoryEntry, 'testFile' | 'selector'>): string {
  return createHash('sha256').update(selectorKey(entry)).digest('hex')
}

function selectorTypeOf(entries: HistoryEntry[]): string {
  for (let i = entries.length - 1; i >= 0; i--) {
    const type = entries[i].selectorType
    if (type) return type.toLowerCase()
  }
  return 'unknown'
}

function statusOf(status: string): 'healed' | 'review' | 'unresolved' {
  if (status === 'healed' || status === 'review' || status === 'unresolved') return status
  return 'unresolved'
}

/** Agrupa por archivo+selector y calcula el resumen de cada uno, ordenado por roturas desc. */
export function buildSelectorSummaries(entries: HistoryEntry[]): SelectorSummary[] {
  const byKey = new Map<string, HistoryEntry[]>()
  for (const e of entries) {
    const key = selectorKey(e)
    const list = byKey.get(key)
    if (list) list.push(e)
    else byKey.set(key, [e])
  }

  const summaries: SelectorSummary[] = []
  for (const [, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const lastHealed = [...sorted].reverse().find((e) => e.status === 'healed')?.timestamp ?? null
    const lastSuggestion = [...sorted].reverse().find((e) => e.fixedSelector)?.fixedSelector ?? null

    summaries.push({
      id: selectorId(first),
      selector: first.selector,
      testFile: first.testFile ?? null,
      type: selectorTypeOf(sorted),
      failCount: list.length,
      lastSuggestion,
      lastHealed,
      firstSeen: first.timestamp,
      lastSeen: last.timestamp,
      chronic: list.length >= 3,
    })
  }

  return summaries.sort((a, b) => b.failCount - a.failCount || a.selector.localeCompare(b.selector))
}

function timelinePerSelector(entries: HistoryEntry[]): TimelinePoint[] {
  return buildDashboardStats(entries).timeline
}

/** Detalle de un selector por id. undefined si no existe. */
export function buildSelectorDetail(entries: HistoryEntry[], id: string): SelectorDetail | undefined {
  const summaries = buildSelectorSummaries(entries)
  const summary = summaries.find((s) => s.id === id)
  if (!summary) return undefined

  const mine = entries.filter((e) => selectorId(e) === id).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const suggestions: SelectorSuggestion[] = mine.map((e) => ({
    timestamp: e.timestamp,
    testFile: e.testFile ?? null,
    testName: e.testName ?? null,
    status: statusOf(e.status),
    fixedSelector: e.fixedSelector ?? null,
    confidence: typeof e.confidence === 'number' ? e.confidence : null,
    verified: typeof e.verified === 'boolean' ? e.verified : null,
    cause: e.cause ?? null,
  }))

  return { ...summary, suggestions, timeline: timelinePerSelector(mine) }
}

/** Vistazo general: stats.json + resumen del histórico de history.jsonl. `windowDays` es la
 * ventana de la tendencia de eficacia (7 o 30); fuera de esos dos valores cae a 30. */
export function buildStatsOverview(healStats: HealStatsLike, entries: HistoryEntry[], windowDays: number = 30): StatsOverview {
  const history = buildDashboardStats(entries)
  return {
    totalAnalyzed: healStats.totalAnalyzed,
    healed: healStats.healed,
    failed: healStats.failed,
    byType: healStats.byType,
    avgHealingMs: healStats.avgHealingMs,
    totalHealingMs: healStats.totalHealingMs,
    healRate: healStats.totalAnalyzed > 0 ? healStats.healed / healStats.totalAnalyzed : 0,
    efficacy: computeEfficacy(entries),
    efficacyReport: computeEfficacyReport(entries, windowDays),
    history: {
      total: history.total,
      healed: history.healed,
      review: history.review,
      unresolved: history.unresolved,
      healedRate: history.healedRate,
      firstSeen: history.firstSeen,
      lastSeen: history.lastSeen,
      timeline: history.timeline,
    },
  }
}

/** Aceptados vs rechazados entre las entradas confirmadas (`healify confirm`); las sin
 * confirmar no cuentan para la tasa pero se reportan — la eficacia no puede esconder
 * fixes que nadie validó. */
function computeEfficacy(entries: HistoryEntry[]): StatsOverview['efficacy'] {
  const accepted = entries.filter((e) => e.accepted === true).length
  const rejected = entries.filter((e) => e.accepted === false).length
  const confirmed = accepted + rejected
  return {
    accepted,
    rejected,
    unconfirmed: entries.length - confirmed,
    rate: confirmed > 0 ? accepted / confirmed : null,
  }
}

const EFFICACY_WINDOW_DAYS = 30

function efficacyTotals(entries: HistoryEntry[]): EfficacyTotals {
  const accepted = entries.filter((e) => e.accepted === true).length
  const rejected = entries.filter((e) => e.accepted === false).length
  const confirmed = accepted + rejected
  return {
    accepted,
    rejected,
    pending: entries.length - confirmed,
    rate: confirmed > 0 ? accepted / confirmed : null,
  }
}

/** Ventana válida para la tendencia de eficacia: solo 7 o 30 días; cualquier otra cosa cae
 * al default — la UI nunca pide otra, y un valor raro no debe romper ni inventar rangos. */
export function normalizeEfficacyWindow(value: string | undefined | null, fallback: number = EFFICACY_WINDOW_DAYS): number {
  if (value === '7') return 7
  if (value === '30') return 30
  return fallback
}

/** Fecha UTC `YYYY-MM-DD` del día de un timestamp; null si el timestamp no parsea (entrada
 * corrupta — se ignora, no rompe la tendencia). */
function dayOf(timestamp: string): string | null {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

/** Reporte completo de eficacia. La agregación es server-side a propósito: la UI solo
 * renderiza lo que ya viene agregado (SC-003 del spec). `windowDays` limita la tendencia,
 * no los totales — los totales y desgloses son siempre del historial completo. */
export function computeEfficacyReport(entries: HistoryEntry[], windowDays: number = EFFICACY_WINDOW_DAYS): EfficacyReport {
  const totals = efficacyTotals(entries)

  const byFramework: Record<string, EfficacyTotals> = {}
  const frameworkGroups = new Map<string, HistoryEntry[]>()
  for (const e of entries) {
    const key = (e.framework ?? 'unknown').toLowerCase()
    const list = frameworkGroups.get(key)
    if (list) list.push(e)
    else frameworkGroups.set(key, [e])
  }
  for (const [key, group] of frameworkGroups) {
    byFramework[key] = efficacyTotals(group)
  }

  const byCause: Record<string, CauseEfficacy> = {}
  for (const e of entries) {
    const cause: FailureCause = e.cause && e.cause in FAILURE_CAUSE_LABEL ? e.cause : 'unknown'
    const label = FAILURE_CAUSE_LABEL[cause]
    const current = byCause[label] ?? { accepted: 0, rejected: 0, total: 0 }
    current.total += 1
    if (e.accepted === true) current.accepted += 1
    else if (e.accepted === false) current.rejected += 1
    byCause[label] = current
  }

  const trend = buildEfficacyTrend(entries, windowDays)

  return { totals, byFramework, byCause, trend }
}

/** Tendencia diaria de aceptados/rechazados desde (hoy - windowDays + 1) hasta hoy, con días
 * sin datos en 0. Los timestamps futuros se ignoran (no son parte del pasado observable). */
function buildEfficacyTrend(entries: HistoryEntry[], windowDays: number): TrendEfficacyPoint[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))

  const byDay = new Map<string, TrendEfficacyPoint>()
  const day = new Date(start)
  while (day.getTime() <= today.getTime()) {
    const key = day.toISOString().slice(0, 10)
    byDay.set(key, { date: key, accepted: 0, rejected: 0 })
    day.setUTCDate(day.getUTCDate() + 1)
  }

  for (const e of entries) {
    const date = dayOf(e.timestamp)
    if (!date) continue
    const point = byDay.get(date)
    if (!point) continue // fuera de la ventana
    if (e.accepted === true) point.accepted += 1
    else if (e.accepted === false) point.rejected += 1
  }

  return [...byDay.values()]
}

/** Forma mínima de `HealStats` que necesita el overview — evita acoplar la capa pura al storage. */
interface HealStatsLike {
  totalAnalyzed: number
  healed: number
  failed: number
  byType: Record<string, number>
  avgHealingMs: number
  totalHealingMs: number
}

import { createHash } from 'node:crypto'
import { buildDashboardStats, type HistoryEntry, type TimelinePoint } from '@healify/reporter-core'

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

/** Vistazo general: stats.json + resumen del histórico de history.jsonl. */
export function buildStatsOverview(healStats: HealStatsLike, entries: HistoryEntry[]): StatsOverview {
  const history = buildDashboardStats(entries)
  return {
    totalAnalyzed: healStats.totalAnalyzed,
    healed: healStats.healed,
    failed: healStats.failed,
    byType: healStats.byType,
    avgHealingMs: healStats.avgHealingMs,
    totalHealingMs: healStats.totalHealingMs,
    healRate: healStats.totalAnalyzed > 0 ? healStats.healed / healStats.totalAnalyzed : 0,
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

/** Forma mínima de `HealStats` que necesita el overview — evita acoplar la capa pura al storage. */
interface HealStatsLike {
  totalAnalyzed: number
  healed: number
  failed: number
  byType: Record<string, number>
  avgHealingMs: number
  totalHealingMs: number
}

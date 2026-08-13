/** Contrato de datos del dashboard. Espejo de lo que sirve `healify dashboard --serve`
 *  en `/api/stats`, `/api/selectors` y `/api/selectors/:id`. No inventa campos: esto es lo
 *  que realmente se puede derivar de `~/.healify/stats.json` + `.healify/history.jsonl`. */

export type SelectorStatus = 'healed' | 'review' | 'unresolved'

export interface TrendPoint {
  date: string
  healed: number
  review: number
  unresolved: number
}

/** Vistazo general: agregados de stats.json + resumen del histórico (history.jsonl). */
export interface StatsOverview {
  totalAnalyzed: number
  healed: number
  failed: number
  byType: Record<string, number>
  avgHealingMs: number
  totalHealingMs: number
  healRate: number
  /** Eficacia de los fixes confirmados con `healify confirm`. rate null = sin confirmaciones. */
  efficacy: {
    accepted: number
    rejected: number
    unconfirmed: number
    rate: number | null
  }
  /** Reporte completo de la sección "Eficacia": totales + desgloses ya agregados server-side. */
  efficacyReport: EfficacyReport
  history: {
    total: number
    healed: number
    review: number
    unresolved: number
    healedRate: number
    firstSeen: string | null
    lastSeen: string | null
    timeline: TrendPoint[]
  }
}

/** Agregados de aceptación/rechazo de un grupo. rate null = sin confirmaciones. */
export interface EfficacyTotals {
  accepted: number
  rejected: number
  pending: number
  rate: number | null
}

/** Un día de la tendencia de eficacia. */
export interface TrendEfficacyPoint {
  date: string
  accepted: number
  rejected: number
}

/** Aceptación/rechazo por causa de fallo (clave = etiqueta local, ej. "Selector roto"). */
export interface CauseEfficacy {
  accepted: number
  rejected: number
  total: number
}

/** Reporte de la sección "Eficacia" — espejo de lo que sirve /api/stats. */
export interface EfficacyReport {
  totals: EfficacyTotals
  byFramework: Record<string, EfficacyTotals>
  trend: TrendEfficacyPoint[]
  byCause: Record<string, CauseEfficacy>
}

/** Un selector roto tal como aparece en .healify/history.jsonl, agregado por archivo+selector. */
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

/** Una aparición individual del selector en el historial. */
export interface SelectorSuggestion {
  timestamp: string
  testFile: string | null
  testName: string | null
  status: SelectorStatus
  fixedSelector: string | null
  confidence: number | null
  verified: boolean | null
  cause: string | null
}

/** Detalle completo de un selector: resumen + historial + tendencia propia. */
export interface SelectorDetail extends SelectorSummary {
  suggestions: SelectorSuggestion[]
  timeline: TrendPoint[]
}
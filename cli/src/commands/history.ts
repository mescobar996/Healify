import {
  readHistory,
  computeTopRecurrent,
  computeRebroken,
  computeChronic,
  type RecurrentSelector,
  type RebrokenSelector,
  type ChronicSelector,
} from '../history'

export interface HistoryReport {
  hasHistory: boolean
  topRecurrent: RecurrentSelector[]
  rebroken: RebrokenSelector[]
  /** Selectores que se rompieron 3 veces o más, con la recomendación de qué hacer. */
  chronic: ChronicSelector[]
}

/** Lee .healify/history.jsonl y arma las vistas — no modifica nada. */
export function history(cwd: string = process.cwd()): HistoryReport {
  const entries = readHistory(cwd)
  if (entries.length === 0) return { hasHistory: false, topRecurrent: [], rebroken: [], chronic: [] }
  return {
    hasHistory: true,
    topRecurrent: computeTopRecurrent(entries),
    rebroken: computeRebroken(entries),
    chronic: computeChronic(entries),
  }
}

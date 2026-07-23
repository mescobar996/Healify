import { readHistory, computeTopRecurrent, computeRebroken, type RecurrentSelector, type RebrokenSelector } from '../history'

export interface HistoryReport {
  hasHistory: boolean
  topRecurrent: RecurrentSelector[]
  rebroken: RebrokenSelector[]
}

/** Lee .healify/history.jsonl y arma las dos vistas — no modifica nada. */
export function history(cwd: string = process.cwd()): HistoryReport {
  const entries = readHistory(cwd)
  if (entries.length === 0) return { hasHistory: false, topRecurrent: [], rebroken: [] }
  return { hasHistory: true, topRecurrent: computeTopRecurrent(entries), rebroken: computeRebroken(entries) }
}

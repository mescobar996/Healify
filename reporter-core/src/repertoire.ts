import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LocalCaseStatus } from './local-mode'

/**
 * El repertorio: memoria de curaciones pasadas, leída de `.healify/history.jsonl`.
 *
 * La heurística "a ciegas" es determinística — el mismo selector siempre produce la misma
 * salida (vía el ajuste por hash). Reutilizar una entrada del historial que se curó a ciegas
 * no agrega nada: recalcularla da exactamente lo mismo. El valor real está en las entradas
 * `verified: true` (confirmadas contra la página real en una corrida que sí tenía el browser
 * vivo o el snapshot de Playwright) — esas sí valen la pena recordar cuando la corrida actual
 * no puede verificar nada por su cuenta (Cypress, siempre; o cualquier adapter si el snapshot
 * no estuvo disponible esa vez).
 */
export interface HistoryEntry {
  timestamp: string
  testFile?: string
  testName: string
  selector: string
  status: LocalCaseStatus
  fixedSelector: string
  selectorType: string
  confidence: number
  /** true si esta curación se confirmó contra la página real en el momento en que se grabó. */
  verified?: boolean
}

const HISTORY_RELATIVE_PATH = join('.healify', 'history.jsonl')

/**
 * Parseo tolerante línea a línea. Compartido entre `cli` (que arma el archivo) y acá (que lo
 * consulta) — una sola implementación, no dos que puedan divergir. Una línea corrupta (ej.
 * escritura interrumpida a mitad) se ignora, nunca rompe el resto.
 */
export function parseHistoryLines(raw: string): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line))
    } catch {
      // línea corrupta — se ignora, no revienta el resto.
    }
  }
  return entries
}

/** [] si el archivo no existe o no se puede leer — el repertorio es un complemento, nunca
 * debe bloquear ni romper una corrida por su ausencia. */
export function readRepertoire(cwd: string = process.cwd()): HistoryEntry[] {
  const fullPath = join(cwd, HISTORY_RELATIVE_PATH)
  if (!existsSync(fullPath)) return []

  let raw: string
  try {
    raw = readFileSync(fullPath, 'utf-8')
  } catch {
    return []
  }

  return parseHistoryLines(raw)
}

/**
 * ¿Ya vimos este defecto antes, confirmado contra la página real? Coincidencia por selector
 * exacto + `testFile` exacto (mismo criterio que `defectId`) — incluye el caso en que ambos
 * lados son `undefined` (Selenium/WebdriverIO, que no tienen granularidad de archivo en
 * ningún otro lado del modelo, así que ahí el match es por selector solo).
 *
 * Solo entradas `verified: true` — ver el comentario de cabecera del módulo. Con varias
 * coincidencias, gana la más reciente por `timestamp`.
 */
export function findRepertoireMatch(entries: HistoryEntry[], selector: string, testFile?: string): HistoryEntry | null {
  const candidates = entries.filter((e) => e.verified === true && e.selector === selector && e.testFile === testFile)
  if (candidates.length === 0) return null

  return candidates.reduce((latest, candidate) => (candidate.timestamp > latest.timestamp ? candidate : latest))
}

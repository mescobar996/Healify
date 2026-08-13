import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LocalRun } from '@healify/reporter-core'
import {
  parseHistoryLines,
  computeTopRecurrent,
  computeRebroken,
  computeChronic,
  type HistoryEntry,
  type RecurrentSelector,
  type RebrokenSelector,
  type ChronicSelector,
} from '@healify/reporter-core'

export type { HistoryEntry, RecurrentSelector, RebrokenSelector, ChronicSelector }
export { computeTopRecurrent, computeRebroken, computeChronic }

const HISTORY_RELATIVE_PATH = join('.healify', 'history.jsonl')

/**
 * Graba TODOS los casos de la corrida (healed/review/unresolved), no solo lo que fix()
 * pudo aplicar — así "recurrente"/"re-roto" reflejan selectores rotos reales, no solo los
 * auto-aplicables. Si falla la escritura (permisos, disco lleno), solo avisa por consola —
 * el historial es un complemento, nunca debe bloquear el flujo principal de fix().
 */
export function appendHistory(run: LocalRun, cwd: string = process.cwd()): void {
  const fullPath = join(cwd, HISTORY_RELATIVE_PATH)
  const now = new Date().toISOString()

  const lines = run.cases
    .map((c) => {
      const entry: HistoryEntry = {
        timestamp: now,
        testFile: c.testFile,
        testName: c.testName,
        selector: c.selector,
        status: c.status,
        fixedSelector: c.fixedSelector,
        selectorType: c.selectorType,
        confidence: c.confidence,
        verified: c.verified,
        cause: c.cause,
        framework: run.framework,
      }
      return JSON.stringify(entry)
    })
    .join('\n') + '\n'

  try {
    mkdirSync(dirname(fullPath), { recursive: true })
    appendFileSync(fullPath, lines, 'utf-8')
  } catch (error) {
    console.warn(`⚠ no se pudo escribir el historial (${HISTORY_RELATIVE_PATH}): ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** [] si el archivo no existe o no se puede leer. Líneas corruptas se ignoran, no revientan el resto. */
export function readHistory(cwd: string = process.cwd()): HistoryEntry[] {
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

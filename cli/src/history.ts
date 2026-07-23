import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'

export interface HistoryEntry {
  timestamp: string
  testFile?: string
  testName: string
  selector: string
  status: LocalCaseResult['status']
  fixedSelector: string
  selectorType: string
  confidence: number
}

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

  const entries: HistoryEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line))
    } catch {
      // línea corrupta (ej. escritura interrumpida a mitad) — se ignora.
    }
  }
  return entries
}

export interface RecurrentSelector {
  selector: string
  count: number
}

/** Agrupa por selector exacto, cuenta apariciones en todo el historial, top N desc. */
export function computeTopRecurrent(entries: HistoryEntry[], limit: number = 10): RecurrentSelector[] {
  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.selector, (counts.get(e.selector) ?? 0) + 1)
  return [...counts.entries()]
    .map(([selector, count]) => ({ selector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export interface RebrokenSelector {
  selector: string
  count: number
  firstHealedAt: string
}

/**
 * Aproximación, no medición exacta: el historial no sabe si fix() realmente aplicó el
 * selector al archivo (pudo saltarse por ambiguous/dirty-git/not-substitutable) — solo
 * sabe que el motor lo curó con confianza suficiente (status 'healed') la primera vez que
 * apareció, y que el mismo selector volvió a aparecer roto después.
 */
export function computeRebroken(entries: HistoryEntry[]): RebrokenSelector[] {
  const bySelector = new Map<string, HistoryEntry[]>()
  for (const e of entries) {
    const list = bySelector.get(e.selector) ?? []
    list.push(e)
    bySelector.set(e.selector, list)
  }

  const result: RebrokenSelector[] = []
  for (const [selector, list] of bySelector) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    if (sorted[0].status !== 'healed') continue
    result.push({ selector, count: list.length, firstHealedAt: sorted[0].timestamp })
  }
  return result.sort((a, b) => b.count - a.count)
}

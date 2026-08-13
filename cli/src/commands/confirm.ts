import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDefectId, parseHistoryLines } from '@healify/reporter-core'

/**
 * `healify confirm --id <defectId> [--accepted|--rejected]` — marca las entradas del historial
 * cuyo defectId coincide como aceptadas o rechazadas. Es la métrica de calidad del feedback:
 * "cuántos arreglos se aceptan sin revert". Sin confirmación, las entradas quedan sin marcar
 * y la eficacia del dashboard se calcula solo sobre las confirmadas.
 */

export interface ConfirmResult {
  ok: boolean
  updated: number
  id: string
  accepted: boolean
  lines: string[]
}

const HISTORY_RELATIVE_PATH = join('.healify', 'history.jsonl')

export function runConfirm(args: string[], cwd: string = process.cwd()): ConfirmResult {
  const idIndex = args.indexOf('--id')
  const id = idIndex >= 0 ? args[idIndex + 1] : undefined
  if (!id || id.length === 0) {
    return { ok: false, updated: 0, id: '', accepted: true, lines: ['Uso: healify confirm --id <defectId> [--accepted|--rejected]'] }
  }
  const accepted = args.includes('--rejected') ? false : true

  const fullPath = join(cwd, HISTORY_RELATIVE_PATH)
  if (!existsSync(fullPath)) {
    return { ok: false, updated: 0, id, accepted, lines: [`No existe ${HISTORY_RELATIVE_PATH} — todavía no hay historial para confirmar.`] }
  }

  let entries
  try {
    entries = parseHistoryLines(readFileSync(fullPath, 'utf-8'))
  } catch {
    return { ok: false, updated: 0, id, accepted, lines: [`No se pudo leer ${HISTORY_RELATIVE_PATH}.`] }
  }

  let updated = 0
  for (const entry of entries) {
    if (buildDefectId(entry.testFile, entry.selector) === id) {
      entry.accepted = accepted
      updated++
    }
  }

  if (updated === 0) {
    return { ok: false, updated: 0, id, accepted, lines: [`No encontré ningún selector con id ${id} en el historial.`] }
  }

  writeFileSync(fullPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8')
  const label = accepted ? 'aceptado' : 'rechazado'
  return {
    ok: true,
    updated,
    id,
    accepted,
    lines: [`✅ ${updated} fix${updated === 1 ? '' : 'es'} marcado${updated === 1 ? '' : 's'} como ${label} (${id}).`],
  }
}

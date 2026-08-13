import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Registro de corridas: los resultados por test de cada corrida (`.healify/runs.jsonl`).
 *
 * Complemento de `history.jsonl` (que guarda solo los selectores rotos): acá vive lo que el
 * historial no tiene — los tests que PASARON — porque sin el denominador "cuántas veces corrió
 * el test y en cuántas pasó" no hay forma de distinguir un test flaky de uno siempre roto.
 *
 * Lo escriben los reporters de Playwright y Cypress (que ven cada test) en `onEnd`/`after:run`;
 * lo lee `healify flake`. Selenium/WebdriverIO curan en vivo y no tienen concepto de suite —
 * no aportan corridas, y está bien: el comando solo muestra datos donde existen.
 */
export interface RunOutcome {
  testName: string
  testFile?: string
  passed: boolean
}

export interface RunRecord {
  type: 'run'
  /** Identifica la corrida (timestamp ISO) para agrupar resultados a lo largo del tiempo. */
  runId: string
  timestamp: string
  project: string
  framework: string
  total: number
  passed: number
  failed: number
  durationMs?: number
  /** Solo tests que terminaron passed o failed — los skipped no aportan ni pass ni fail. */
  tests: RunOutcome[]
}

const RUNS_RELATIVE_PATH = join('.healify', 'runs.jsonl')

/** Una corrida como línea JSON — el discriminador `type: 'run'` deja espacio a otros tipos. */
export function serializeRunRecord(run: RunRecord): string {
  return JSON.stringify(run)
}

/** Parseo tolerante línea a línea (mismo espíritu que `parseHistoryLines`): una línea
 * corrupta se ignora, nunca rompe el resto. */
function isRunRecord(value: unknown): value is RunRecord {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'run'
}

/** Parseo tolerante línea a línea de .healify/runs.jsonl: una línea corrupta se ignora, nunca rompe el resto. */
export function parseRunLines(raw: string): RunRecord[] {
  const records: RunRecord[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed: unknown = JSON.parse(line)
      if (isRunRecord(parsed)) records.push(parsed)
    } catch {
      // línea corrupta — se ignora, no revienta el resto.
    }
  }
  return records
}

/** [] si el archivo no existe o no se puede leer — complemento, nunca bloquea la corrida. */
export function readRunRecords(cwd: string = process.cwd()): RunRecord[] {
  const fullPath = join(cwd, RUNS_RELATIVE_PATH)
  if (!existsSync(fullPath)) return []

  let raw: string
  try {
    raw = readFileSync(fullPath, 'utf-8')
  } catch {
    return []
  }

  return parseRunLines(raw)
}

/**
 * Appendea la corrida al registro. Si falla la escritura (permisos, disco lleno), solo avisa —
 * el registro es un complemento de diagnóstico, nunca debe romper la corrida real.
 */
export function appendRunRecord(run: RunRecord, cwd: string = process.cwd()): void {
  const fullPath = join(cwd, RUNS_RELATIVE_PATH)

  try {
    mkdirSync(dirname(fullPath), { recursive: true })
    appendFileSync(fullPath, serializeRunRecord(run) + '\n', 'utf-8')
  } catch (error) {
    console.warn(`⚠ no se pudo escribir el registro de corridas (${RUNS_RELATIVE_PATH}): ${error instanceof Error ? error.message : String(error)}`)
  }
}

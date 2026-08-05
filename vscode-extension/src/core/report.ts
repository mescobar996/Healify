import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Lee el `healify-report.json` que dejó la última corrida de tests.
 *
 * Mismo orden de búsqueda que usa el CLI (`findLastReportCase` en
 * cli/src/commands/explain.ts): primero `.healify/`, después la raíz del proyecto.
 */

export interface ReportCase {
  selector: string
  status: string
  fixedSelector?: string
  confidence?: number
  explanation?: string
  verified?: boolean
  testFile?: string
}

const CANDIDATE_PATHS = ['.healify/healify-report.json', 'healify-report.json']

/**
 * Devuelve los casos del reporte, o lista vacía si no hay reporte, está corrupto o tiene una
 * forma que no reconocemos.
 *
 * Nunca tira: un JSON a medio escribir —el editor puede leerlo justo mientras el reporter lo
 * está volcando— no puede tumbar la extensión. Sin reporte simplemente no hay diagnósticos de
 * ese nivel, y el lint en vivo sigue funcionando igual.
 */
export function readReportCases(projectRoot: string, explicitPath?: string): ReportCase[] {
  const paths = explicitPath ? [explicitPath] : CANDIDATE_PATHS

  for (const rel of paths) {
    const fullPath = join(projectRoot, rel)
    if (!existsSync(fullPath)) continue

    try {
      const parsed = JSON.parse(readFileSync(fullPath, 'utf-8')) as unknown
      const cases = (parsed as { cases?: unknown }).cases
      if (!Array.isArray(cases)) continue

      return cases.filter(isReportCase)
    } catch {
      continue
    }
  }

  return []
}

function isReportCase(value: unknown): value is ReportCase {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ReportCase>
  return typeof candidate.selector === 'string' && typeof candidate.status === 'string'
}

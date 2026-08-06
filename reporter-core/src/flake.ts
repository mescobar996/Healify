import type { RunRecord } from './runs'

/**
 * Detección de flakiness: qué tests son verdes en algunas corridas y rojos en otras.
 *
 * La diferencia con el historial de selectores rotos: acá hay denominador. `history.jsonl`
 * solo prueba "el test apareció roto N veces"; con los resultados por corrida se puede
 * responder la pregunta de un lead: "¿está fallando a veces (flaky, hay que aislar) o
 * siempre (roto, hay que arreglar ya)?".
 */
export type FlakeVerdict = 'healthy' | 'flaky' | 'always-failing' | 'insufficient-data'

export interface FlakyTest {
  testName: string
  testFile?: string
  /** Corridas registradas en las que el test terminó passed o failed (skipped no cuenta). */
  runs: number
  passed: number
  failed: number
  /** failed/runs, 0..1. El "flakiness score" en el sentido de Cypress Cloud. */
  flakeRate: number
  verdict: FlakeVerdict
}

const VERDICT_RANK: Record<FlakeVerdict, number> = {
  flaky: 0,
  'always-failing': 1,
  healthy: 2,
  'insufficient-data': 3,
}

/** La regla de veredicto, en un solo lugar — la usan `detectFlakyTests` y `flakeVerdictFor`,
 * que si no podrían responder distinto sobre el mismo test. */
function verdictFrom(passed: number, failed: number, minRuns: number): FlakeVerdict {
  const total = passed + failed
  if (total < minRuns) return 'insufficient-data'
  if (failed === 0) return 'healthy'
  return failed === total ? 'always-failing' : 'flaky'
}

/**
 * Veredicto de un test puntual, sin construir la lista entera.
 *
 * Existe para el motor de sanado, que necesita preguntar por UN test mientras decide qué
 * hacer con él. `detectFlakyTests` sigue siendo la vista para el comando `flake`.
 *
 * Mismo criterio de agrupación que `defectId` y `detectFlakyTests`: `testFile` + `testName`.
 */
export function flakeVerdictFor(
  runs: RunRecord[],
  testName: string,
  testFile?: string,
  opts: { minRuns?: number } = {}
): FlakeVerdict {
  let passed = 0
  let failed = 0
  for (const run of runs) {
    for (const outcome of run.tests) {
      if (outcome.testName !== testName || outcome.testFile !== testFile) continue
      if (outcome.passed) passed++
      else failed++
    }
  }
  return verdictFrom(passed, failed, opts.minRuns ?? 2)
}

/**
 * Agrupa los outcomes por `testFile` + `testName` (mismo criterio que `defectId`: mismo
 * nombre en archivos distintos es otro test) y clasifica cada uno.
 *
 * Un test necesita al menos `minRuns` (default 2) corridas registradas para opinar — con una
 * sola corrida, "falló una vez" no distingue flaky de defecto real.
 */
export function detectFlakyTests(runs: RunRecord[], opts: { minRuns?: number } = {}): FlakyTest[] {
  const minRuns = opts.minRuns ?? 2

  const byKey = new Map<string, { testName: string; testFile?: string; passed: number; failed: number }>()
  for (const run of runs) {
    for (const outcome of run.tests) {
      const key = `${outcome.testFile ?? ''}\u0000${outcome.testName}`
      const group = byKey.get(key) ?? { testName: outcome.testName, testFile: outcome.testFile, passed: 0, failed: 0 }
      if (outcome.passed) group.passed++
      else group.failed++
      byKey.set(key, group)
    }
  }

  const tests: FlakyTest[] = []
  for (const group of byKey.values()) {
    const total = group.passed + group.failed
    const verdict = verdictFrom(group.passed, group.failed, minRuns)
    tests.push({
      testName: group.testName,
      testFile: group.testFile,
      runs: total,
      passed: group.passed,
      failed: group.failed,
      flakeRate: total === 0 ? 0 : group.failed / total,
      verdict,
    })
  }

  // flaky primero (más rate primero), luego siempre-roto (más fallos primero), luego healthy,
  // y los que no tienen datos al final — el comando puede filtrarlos.
  return tests.sort((a, b) => {
    const rank = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]
    if (rank !== 0) return rank
    const rate = b.flakeRate - a.flakeRate
    if (rate !== 0) return rate
    const byName = (a.testName + (a.testFile ?? '')).localeCompare(b.testName + (b.testFile ?? ''))
    return byName
  })
}

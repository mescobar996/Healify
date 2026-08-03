import { readRunRecords, detectFlakyTests, type RunRecord, type FlakyTest } from '@healify/reporter-core'

export interface FlakeCommandResult {
  ok: boolean
  lines: string[]
  tests: FlakyTest[]
  runs: RunRecord[]
}

/**
 * `healify flake` — los tests que a veces pasan y a veces fallan, sobre las corridas que
 * registraron los reporters de Playwright/Cypress en `.healify/runs.jsonl`.
 *
 * La diferencia con `healify history`/dashboard: acá hay denominador. "Apareció roto N veces"
 * (historial) no distingue el test flaky del siempre roto; "verde en 3 corridas y rojo en 2"
 * sí. Solo lee, no modifica nada.
 */
export function runFlake(args: string[], cwd: string = process.cwd()): FlakeCommandResult {
  const minRunsArg = args.indexOf('--min-runs')
  const minRunsValue = minRunsArg >= 0 ? Number(args[minRunsArg + 1]) : NaN
  const minRuns = Number.isFinite(minRunsValue) && minRunsValue >= 1 ? minRunsValue : undefined

  const runs = readRunRecords(cwd)
  if (runs.length === 0) {
    return {
      ok: true,
      lines: [
        'Todavía no hay corridas registradas — corré tus tests con el reporter de Healify (Playwright o Cypress) al menos 2 veces para empezar a detectar flakiness.',
      ],
      tests: [],
      runs,
    }
  }

  const tests = detectFlakyTests(runs, minRuns ? { minRuns } : undefined)
  const relevant = tests.filter((t) => t.verdict === 'flaky' || t.verdict === 'always-failing')

  const lines: string[] = []
  if (relevant.length === 0) {
    lines.push('No hay tests flaky ni siempre-roto en las corridas registradas.')
  } else {
    lines.push('Flaky (verde en unas corridas, rojo en otras):')
    for (const t of relevant.filter((t) => t.verdict === 'flaky')) {
      lines.push(`  ${t.testName}${t.testFile ? ` (${t.testFile})` : ''} — ${t.failed}/${t.runs} falló (${Math.round(t.flakeRate * 100)}%)`)
    }
    lines.push('Siempre-roto (falló en TODAS las corridas registradas):')
    for (const t of relevant.filter((t) => t.verdict === 'always-failing')) {
      lines.push(`  ${t.testName}${t.testFile ? ` (${t.testFile})` : ''} — ${t.failed}/${t.runs} falló`)
    }
  }
  lines.push(`${relevant.filter((t) => t.verdict === 'flaky').length} flaky de ${tests.length} tests con datos · ${runs.length} corridas registradas.`)

  return { ok: true, lines, tests, runs }
}

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runLocalHealing, renderLocalReportHtml, renderLocalReportJson, type LocalCaseResult } from '@healify/reporter-core'

/**
 * Corre la heurística local (sin red) sobre cada test fallido y al final de
 * la corrida escribe healify-report.html/json en el directorio de trabajo.
 */
export function HealifyCypressPlugin(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): Cypress.PluginConfigOptions {
  const localResults: LocalCaseResult[] = []

  on('after:spec', (spec, results) => {
    for (const test of results.tests ?? []) {
      if (test.state !== 'failed') continue
      try {
        localResults.push(
          runLocalHealing({
            testName: test.title.join(' > '),
            testFile: spec.relative,
            errorMessage: test.displayError ?? 'Unknown error',
          })
        )
      } catch {
        // Nunca romper la corrida real por un fallo del healing local.
      }
    }
  })

  on('after:run', () => {
    if (localResults.length === 0) return
    try {
      const run = { project: 'Cypress suite', framework: 'Cypress', generatedAt: new Date(), cases: localResults }
      writeFileSync(join(process.cwd(), 'healify-report.html'), renderLocalReportHtml(run))
      writeFileSync(join(process.cwd(), 'healify-report.json'), renderLocalReportJson(run))
    } catch {
      // Fire-and-forget: el reporte local nunca debe romper la corrida.
    }
  })

  return config
}

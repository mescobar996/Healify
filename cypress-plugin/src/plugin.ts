import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveConfig,
  reportFailure,
  extractSelectorFromError,
  runLocalHealing,
  renderLocalReportHtml,
  renderLocalReportJson,
  type LocalCaseResult,
} from '@healify/reporter-core'

/**
 * Sin HEALIFY_API_KEY no hay cuenta ni servidor — en vez de quedar en no-op,
 * el plugin corre la heurística local (sin red) y al final de la corrida
 * escribe healify-report.html/json en el directorio de trabajo.
 */
export function HealifyCypressPlugin(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): Cypress.PluginConfigOptions {
  const healifyConfig = resolveConfig()

  if (healifyConfig) {
    on('after:spec', async (spec, results) => {
      const reports = (results.tests ?? [])
        .filter((test) => test.state === 'failed')
        .map((test) => {
          const errorMessage = test.displayError ?? 'Unknown error'
          return reportFailure(healifyConfig, {
            testName: test.title.join(' > '),
            testFile: spec.relative,
            selector: extractSelectorFromError(errorMessage),
            error: errorMessage,
          })
        })
      await Promise.allSettled(reports)
    })
    return config
  }

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

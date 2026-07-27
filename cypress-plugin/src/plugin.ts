import { writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  runLocalHealing,
  renderLocalReportHtml,
  renderLocalReportJson,
  renderLocalReportMarkdown,
  printSummary,
  baseEnvironment,
  statsFromCases,
  type LocalCaseResult,
  type CaseAttachment,
} from '@healify/reporter-core'

/**
 * Corre la heurística local (sin red) sobre cada test fallido y al final de la corrida
 * escribe healify-report.html/json/md en el directorio de trabajo.
 *
 * El reporte se escribe siempre, también cuando todos los tests pasan — mismo criterio que
 * el reporter de Playwright: un entregable de QA tiene que poder decir "PASS", no solo
 * aparecer cuando algo se rompe.
 *
 * Cypress no expone los pasos ejecutados de un test (no hay equivalente a los `steps` de
 * Playwright), así que ese campo queda sin llenar en vez de rellenarse con algo inventado.
 */
export function HealifyCypressPlugin(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): Cypress.PluginConfigOptions {
  const localResults: LocalCaseResult[] = []
  let total = 0
  let passed = 0
  let failed = 0
  let durationMs = 0
  let browser: string | undefined

  on('after:spec', (spec, results) => {
    durationMs += results.stats?.duration ?? 0
    total += results.stats?.tests ?? results.tests?.length ?? 0
    passed += results.stats?.passes ?? 0
    failed += results.stats?.failures ?? 0

    for (const test of results.tests ?? []) {
      if (test.state !== 'failed') continue
      try {
        localResults.push(
          runLocalHealing({
            testName: test.title.join(' > '),
            testFile: spec.relative,
            errorMessage: test.displayError ?? 'Unknown error',
            durationMs: test.duration,
            attachments: collectAttachments(results),
          })
        )
      } catch {
        // Nunca romper la corrida real por un fallo del healing local.
      }
    }
  })

  // `results` puede llegar vacío (Cypress no lo pasa en todos los modos de ejecución), así
  // que todo lo que salga de ahí se lee de forma defensiva: sin datos, el campo se omite.
  on('after:run', (results) => {
    try {
      browser =
        results && 'browserName' in results ? `${results.browserName} ${results.browserVersion ?? ''}`.trim() : undefined
      const run = {
        project: 'Cypress suite',
        framework: 'Cypress',
        generatedAt: new Date(),
        cases: localResults,
        verdict: (failed === 0 ? 'passed' : 'failed') as 'passed' | 'failed',
        stats: statsFromCases(localResults, { total, passed, failed, durationMs }),
        environment: baseEnvironment('Cypress', {
          frameworkVersion: results && 'cypressVersion' in results ? results.cypressVersion : undefined,
          browser,
          baseURL: typeof config.baseUrl === 'string' ? config.baseUrl : undefined,
        }),
      }
      writeFileSync(join(process.cwd(), 'healify-report.html'), renderLocalReportHtml(run))
      writeFileSync(join(process.cwd(), 'healify-report.json'), renderLocalReportJson(run))
      writeFileSync(join(process.cwd(), 'healify-report.md'), renderLocalReportMarkdown(run))
    } catch {
      // Fire-and-forget: el reporte local nunca debe romper la corrida.
    }
    printSummary(localResults)
  })

  return config
}

/**
 * Screenshots y video que Cypress ya escribió en disco. Se enlazan por ruta relativa al cwd
 * — nunca se copia ni se embebe el archivo.
 */
function collectAttachments(results: CypressCommandLine.RunResult): CaseAttachment[] | undefined {
  const attachments: CaseAttachment[] = []

  for (const shot of results.screenshots ?? []) {
    attachments.push({
      name: shot.name || 'screenshot',
      path: toRelative(shot.path),
      contentType: 'image/png',
    })
  }
  if (results.video) {
    attachments.push({ name: 'video', path: toRelative(results.video), contentType: 'video/mp4' })
  }

  return attachments.length > 0 ? attachments : undefined
}

function toRelative(absolute: string): string {
  return relative(process.cwd(), absolute).replace(/\\/g, '/')
}

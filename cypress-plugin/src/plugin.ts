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
  readRepertoire,
  analyzeAndHeal,
  resolveLocatorStrategy,
  domContextFromProbeResult,
  BROWSER_PROBE_SCRIPT,
  buildDefectId,
  severityFor,
  buildAuditEntry,
  writeAuditReport,
  loadConfig,
  type LocalCaseResult,
  type CaseAttachment,
  type AuditEntry,
  type HealResponse,
  type SelectorType,
} from '@healify/reporter-core'
import type { HealTaskInput, HealTaskOutput, RecordEventInput } from './support-protocol'

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
  // Casos que curó `cy.healifyGet` en vivo (comando opcional de support.ts) — el test
  // correspondiente termina PASANDO, así que Cypress nunca lo reporta en after:spec como
  // fallido. Sin este array esos casos quedarían invisibles en el reporte, a pesar de haber
  // curado un selector roto de verdad.
  const liveResults: LocalCaseResult[] = []
  const auditEntries: AuditEntry[] = []
  let total = 0
  let passed = 0
  let failed = 0
  let durationMs = 0
  let browser: string | undefined
  // Cypress nunca tiene el árbol de accesibilidad de Playwright ni el browser vivo en la
  // mano como Selenium/WebdriverIO — es el adapter donde el repertorio más aporta, porque
  // sin él la heurística siempre está a ciegas. Se lee una sola vez por registro del plugin.
  const repertoire = readRepertoire(process.cwd())
  // Umbrales, testIds y sinónimos del proyecto — una sola lectura por registro del plugin.
  const healifyConfig = loadConfig(process.cwd())

  // `cy.healifyGet` (support.ts) corre en el browser, sin acceso a analyzeAndHeal() ni al
  // repertorio (viven en Node) — dos tasks lo puentean. 'healify:probe-script'/'healify:heal'
  // son consultas puras (sin efecto de lado); 'healify:record-event' es el único que escribe,
  // y solo después de que el browser confirmó cómo terminó el retry (igual que `emit()` en
  // selenium-plugin/webdriverio-plugin, un proceso más allá).
  on('task', {
    'healify:probe-script': () => BROWSER_PROBE_SCRIPT,

    'healify:heal': (input: HealTaskInput): HealTaskOutput => {
      const result = analyzeAndHeal({
        selector: input.selector,
        testFile: input.testFile,
        htmlContext: domContextFromProbeResult(input.pageElements),
        repertoire,
        customTestIds: healifyConfig.customTestIds,
        customSynonyms: healifyConfig.customSynonyms,
        maxAlternatives: healifyConfig.maxAlternatives,
      })
      return {
        fixedSelector: result.fixedSelector,
        confidence: result.confidence,
        verified: result.verified,
        fromRepertoire: result.fromRepertoire,
        explanation: result.explanation,
        locator: resolveLocatorStrategy(result.fixedSelector),
      }
    },

    'healify:record-event': (event: RecordEventInput): null => {
      const status: LocalCaseResult['status'] =
        event.type === 'healed' ? 'healed' : event.type === 'no-suggestion' || event.type === 'failed' ? 'unresolved' : 'review'
      liveResults.push({
        testName: event.originalSelector,
        testFile: event.testFile,
        selector: event.originalSelector,
        errorMessage: `${event.type}: ${event.originalSelector}`,
        status,
        fixedSelector: event.fixedSelector ?? '',
        confidence: event.confidence ?? 0,
        explanation: event.explanation ?? '',
        selectorType: event.type === 'healed' ? 'HEALED' : 'UNKNOWN',
        verified: event.verified,
        fromRepertoire: event.fromRepertoire,
        defectId: buildDefectId(event.testFile, event.originalSelector),
        severity: severityFor(status),
        expected: `El selector ${event.originalSelector} encuentra un elemento en la página.`,
        actual: `${event.type}: ${event.originalSelector}`,
      })
      return null
    },

    'healify:audit-entry': (input: {
      selector: string
      error: string
      url?: string
      html?: string
      stackTrace?: string
      testName?: string
      testFile?: string
    }): null => {
      try {
        const selectorType: SelectorType = input.selector.startsWith('//') || input.selector.startsWith('(') ? 'XPATH' : 'CSS'
        const response: HealResponse = {
          fixedSelector: input.selector,
          confidence: 0,
          verified: false,
          fromRepertoire: false,
          explanation: '',
          selectorType,
          needsReview: false,
          robustnessImprovement: 0,
          alternatives: [],
          technicalDetails: {
            detectedIssue: input.error,
            proposedSolution: '',
            accessibilityCompliant: false,
            stableAgainstDOMChanges: false,
          },
        }
        const entry = buildAuditEntry(
          response,
          { selector: input.selector, testName: input.testName, testFile: input.testFile },
          { errorMessage: input.error, domSnippet: input.html }
        )
        auditEntries.push(entry)
      } catch {
        // Nunca romper la corrida real por un fallo del audit.
      }
      return null
    },
  })

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
            repertoire,
          }, healifyConfig)
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
      const cases = [...localResults, ...liveResults]
      const run = {
        project: 'Cypress suite',
        framework: 'Cypress',
        generatedAt: new Date(),
        cases,
        verdict: (failed === 0 ? 'passed' : 'failed') as 'passed' | 'failed',
        stats: statsFromCases(cases, { total, passed, failed, durationMs }),
        environment: baseEnvironment('Cypress', {
          frameworkVersion: results && 'cypressVersion' in results ? results.cypressVersion : undefined,
          browser,
          baseURL: typeof config.baseUrl === 'string' ? config.baseUrl : undefined,
        }),
      }
      writeFileSync(join(process.cwd(), 'healify-report.html'), renderLocalReportHtml(run))
      writeFileSync(join(process.cwd(), 'healify-report.json'), renderLocalReportJson(run))
      writeFileSync(join(process.cwd(), 'healify-report.md'), renderLocalReportMarkdown(run))
      if (auditEntries.length > 0) {
        writeAuditReport(auditEntries, process.cwd(), 'Cypress suite', 'Cypress')
      }
    } catch {
      // Fire-and-forget: el reporte local nunca debe romper la corrida.
    }
    printSummary([...localResults, ...liveResults])
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

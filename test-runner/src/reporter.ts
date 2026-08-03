import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter'
import {
  runLocalHealing,
  buildAuditEntry,
  renderLocalReportHtml,
  renderLocalReportJson,
  renderLocalReportMarkdown,
  printSummary,
  baseEnvironment,
  statsFromCases,
  readRepertoire,
  writeAuditReport,
  type LocalCaseResult,
  type CaseAttachment,
  type RunEnvironment,
  type HistoryEntry,
  type AuditEntry,
} from '@healify/reporter-core'

/**
 * Corre la heurística local (sin red) sobre cada test fallido y al final de la corrida
 * escribe healify-report.html/json/md en el directorio de trabajo.
 *
 * El reporte se escribe SIEMPRE, incluso cuando todos los tests pasan: un reporte de QA sin
 * el caso "todo verde" no sirve como entregable, porque no distingue "salió todo bien" de
 * "no se corrió nada".
 */
export default class HealifyReporter implements Reporter {
  private localResults: LocalCaseResult[] = []
  private auditEntries: AuditEntry[] = []
  private total = 0
  private passed = 0
  private failed = 0
  private startedAt = Date.now()
  private environment: RunEnvironment = baseEnvironment('Playwright')
  private repertoire: HistoryEntry[] = []

  onBegin(config: FullConfig, suite: Suite): void {
    this.startedAt = Date.now()
    this.total = suite.allTests().length
    // Se lee una sola vez por corrida, no por test — el archivo no cambia mientras la suite
    // corre. Solo entra en juego cuando esta corrida no pudo verificar nada por su cuenta
    // (ver el comentario de cabecera de reporter-core/src/repertoire.ts).
    this.repertoire = readRepertoire(process.cwd())

    // El navegador y la baseURL viven en el project que Playwright resolvió, no en la config
    // cruda. Se toma el primero: con varios projects el reporte igual dice cuál miró.
    const project = config.projects[0]
    this.environment = baseEnvironment('Playwright', {
      frameworkVersion: config.version,
      browser: project?.name,
      baseURL: typeof project?.use?.baseURL === 'string' ? project.use.baseURL : undefined,
    })
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed') this.passed++
    else if (result.status === 'failed' || result.status === 'timedOut') this.failed++

    if (result.status !== 'failed' && result.status !== 'timedOut') return

    // Bug real encontrado probando contra Playwright de verdad: cuando el click() nunca
    // resuelve, el TEST entero timeoutea y Playwright reporta DOS errores — errors[0] es
    // el genérico "Test timeout of 30000ms exceeded." (sin selector), y el selector real
    // vive en errors[1] ("page.click: ... Call log: - waiting for locator('#x')"). Tomar
    // solo error/errors[0] (como hacía antes) deja este caso, el más común en la práctica,
    // siempre como 'Unknown selector'. Se concatenan todos los mensajes de errors[] para
    // que extractSelectorFromError() encuentre el patrón sin importar en cuál esté.
    const errorMessage =
      result.errors.map((e) => e.message ?? e.value).filter(Boolean).join('\n') ||
      result.error?.message ||
      result.error?.value ||
      'Unknown error'
    const testName = test.titlePath().filter(Boolean).join(' > ')
    // Relativa al cwd, no absoluta: la ruta viaja dentro del reporte (que se comparte y se
    // pega en tickets) y además alimenta el defectId. Con la ruta absoluta, dos personas del
    // mismo equipo generaban IDs distintos para el mismo defecto, y el reporte filtraba la
    // estructura de carpetas de quien lo corrió.
    const testFile = relative(process.cwd(), test.location.file).replace(/\\/g, '/')

    try {
      const domContext = readPageSnapshot(result)
      const screenshotPath = readScreenshotPath(result)
      const healResult = runLocalHealing({
        testName,
        testFile,
        errorMessage,
        line: test.location.line,
        durationMs: result.duration,
        steps: describeSteps(result.steps),
        attachments: collectAttachments(result),
        domContext,
        repertoire: this.repertoire,
      })
      this.localResults.push(healResult)

      if (healResult.selector !== 'Unknown selector' && healResult.healResponse) {
        this.auditEntries.push(
          buildAuditEntry(
            healResult.healResponse,
            { selector: healResult.selector, testName, testFile },
            { errorMessage, domSnippet: domContext, screenshotPath, line: test.location.line },
          ),
        )
      }
    } catch {
      // Nunca romper la corrida real por un fallo del healing local.
    }
  }

  onEnd(result: FullResult): void {
    try {
      const run = {
        project: 'Playwright suite',
        framework: 'Playwright',
        generatedAt: new Date(),
        cases: this.localResults,
        verdict: (result.status === 'passed' ? 'passed' : 'failed') as 'passed' | 'failed',
        stats: statsFromCases(this.localResults, {
          total: this.total,
          passed: this.passed,
          failed: this.failed,
          durationMs: Date.now() - this.startedAt,
        }),
        environment: this.environment,
      }
      writeFileSync(join(process.cwd(), 'healify-report.html'), renderLocalReportHtml(run))
      writeFileSync(join(process.cwd(), 'healify-report.json'), renderLocalReportJson(run))
      writeFileSync(join(process.cwd(), 'healify-report.md'), renderLocalReportMarkdown(run))

      if (this.auditEntries.length > 0) {
        writeAuditReport(this.auditEntries, process.cwd(), 'Playwright suite', 'Playwright')
        console.log(`📝 Audit report written to healify-audit.json (${this.auditEntries.length} failures)`)
      }
    } catch (err) {
      console.warn('healify: error writing report:', err instanceof Error ? err.message : String(err))
    }
    printSummary(this.localResults)
  }
}

/**
 * Los pasos que Playwright registró de verdad durante el test, que es lo que sirve como
 * "pasos para reproducir" en un reporte de defectos. Solo se toman los de categoría
 * `test.step` (los que el usuario escribió) y las llamadas a la API de página — el resto
 * (hooks, fixtures, expects internos) es ruido de infraestructura.
 */
function describeSteps(steps: TestStep[] | undefined): string[] | undefined {
  const relevant = (steps ?? [])
    .filter((s) => s.category === 'test.step' || s.category === 'pw:api')
    .map((s) => s.title.trim())
    .filter(Boolean)
  return relevant.length > 0 ? relevant : undefined
}

/**
 * El árbol de accesibilidad de la página en el momento del fallo.
 *
 * Playwright lo escribe solo, sin que el usuario configure nada, como un attachment llamado
 * `error-context` (ver `_snapshotForAI` en playwright/lib/index.js). Es lo que le permite al
 * motor confrontar sus sugerencias contra lo que había de verdad en pantalla en vez de
 * adivinar nombres por diccionario.
 *
 * Dos límites que conviene tener presentes:
 * - El árbol se toma al terminar el test, no en el instante exacto del click fallido. En la
 *   práctica coinciden, porque el test aborta en el fallo.
 * - Con `PLAYWRIGHT_NO_COPY_PROMPT` seteado, Playwright no lo genera. Ahí no hay dato y el
 *   motor vuelve a la heurística a ciegas de siempre.
 */
function readPageSnapshot(result: TestResult): string | undefined {
  const attachment = (result.attachments ?? []).find((a) => a.name === 'error-context' && a.path)
  if (!attachment?.path) return undefined
  try {
    return readFileSync(attachment.path, 'utf-8')
  } catch {
    return undefined
  }
}

/**
 * Lee la ruta del screenshot capturado por captureScreenshot() desde los attachments del test.
 *
 * El helper captureScreenshot() guarda el archivo en disco y lo adjunta con el nombre
 * 'healify-screenshot'. Esta función busca ese attachment y devuelve la ruta relativa al cwd.
 */
function readScreenshotPath(result: TestResult): string | undefined {
  const attachment = (result.attachments ?? []).find(
    (a) => a.name === 'healify-screenshot' && a.path
  )
  if (!attachment?.path) return undefined
  return relative(process.cwd(), attachment.path).replace(/\\/g, '/')
}

/**
 * Evidencia que Playwright ya escribió en disco (screenshot, video, trace) si el usuario la
 * tiene configurada. Se enlaza por ruta relativa al cwd, para que el link del reporte
 * resuelva desde donde queda el HTML. Nunca se copia ni se embebe el archivo.
 */
function collectAttachments(result: TestResult): CaseAttachment[] | undefined {
  const attachments = (result.attachments ?? [])
    .filter((a) => a.path)
    .map((a) => ({
      name: a.name,
      path: relative(process.cwd(), a.path as string).replace(/\\/g, '/'),
      contentType: a.contentType,
    }))
  return attachments.length > 0 ? attachments : undefined
}

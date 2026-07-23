import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { runLocalHealing, renderLocalReportHtml, renderLocalReportJson, printSummary, type LocalCaseResult } from '@healify/reporter-core'

/**
 * Corre la heurística local (sin red) sobre cada test fallido y al final de
 * la corrida escribe healify-report.html/json en el directorio de trabajo.
 */
export default class HealifyReporter implements Reporter {
  private localResults: LocalCaseResult[] = []

  onTestEnd(test: TestCase, result: TestResult): void {
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
    const testFile = test.location.file

    try {
      this.localResults.push(runLocalHealing({ testName, testFile, errorMessage }))
    } catch {
      // Nunca romper la corrida real por un fallo del healing local.
    }
  }

  onEnd(): void {
    if (this.localResults.length === 0) return

    try {
      const run = { project: 'Playwright suite', framework: 'Playwright', generatedAt: new Date(), cases: this.localResults }
      writeFileSync(join(process.cwd(), 'healify-report.html'), renderLocalReportHtml(run))
      writeFileSync(join(process.cwd(), 'healify-report.json'), renderLocalReportJson(run))
    } catch {
      // Fire-and-forget: el reporte local nunca debe romper la corrida.
    }
    printSummary(this.localResults)
  }
}

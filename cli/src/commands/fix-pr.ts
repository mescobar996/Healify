import { readFileSync } from 'node:fs'
import type { LocalRun } from '@healify/reporter-core'
import { fix, describeReadError, type FixOutcome } from '../fix'
import { fixAst } from '../fix-ast'
import { detectGitHubCLI, createBranch, createCommit, createPRInstructions, createPRWithGH } from '../pr'
import { appendHistory } from '../history'
import { runInteractiveFix } from '../interactive'
import { promptLine } from '../prompt'
import { runFixWatch, parseInterval, parseReportPath } from './watch'

/** Escapa caracteres especiales de Markdown que podrían romper el formato de tabla. */
function sanitizeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function reasonText(outcome: Extract<FixOutcome, { status: 'skipped' }>, astUsed: boolean): string {
  switch (outcome.reason) {
    case 'ambiguous':
      return `'${outcome.selector}' aparece más de una vez, ambiguo`
    case 'dirty-git':
      return 'cambios sin commitear (usá --force para ignorar)'
    case 'not-found':
      return 'no se encontró ni en el archivo de test ni en ningún page object del proyecto'
    case 'not-substitutable':
      return astUsed
        ? 'la sugerencia no es un rol reescribible (método sin mapeo, o no es una llamada de page/locator) — revisar y aplicar a mano'
        : 'la sugerencia no es un valor de selector sustituible directamente (formato de rol legible) — sacá --no-ast para que se reescriba sola, o revisá y aplicá a mano'
    case 'declined':
      return 'vos decidiste no aplicarlo'
  }
}

export function printOutcomes(outcomes: FixOutcome[], run: LocalRun, astUsed: boolean): void {
  if (run.cases.length === 0) {
    console.log('Ningún selector roto en la última corrida — no hay nada que aplicar.')
    return
  }

  let applied = 0
  let skipped = 0

  for (const outcome of outcomes) {
    if (outcome.status === 'applied') {
      applied++
      // Cuando se aplicó en un page object, el archivo tocado no es el que falló: decir cuál
      // es lo único que le permite al usuario revisar el cambio.
      const where = outcome.appliedIn
        ? `${outcome.appliedIn} (page object de ${outcome.testFile})`
        : outcome.testFile
      console.log(`✓ ${where} — ${outcome.selector} → ${outcome.fixedSelector}`)
    } else {
      skipped++
      console.log(`⚠ ${outcome.testFile} — saltado: ${reasonText(outcome, astUsed)}`)
    }
  }

  const reviewCount = run.cases.filter((c) => c.status === 'review').length
  const reviewSuffix = reviewCount > 0
    ? ` · ${reviewCount} caso${reviewCount === 1 ? '' : 's'} "review" sin tocar (ver healify-report.html)`
    : ''

  console.log(`\n${applied} selector${applied === 1 ? '' : 'es'} aplicado${applied === 1 ? '' : 's'} · ${skipped} salteado${skipped === 1 ? '' : 's'}${reviewSuffix}`)
}

export interface ApplyOptions {
  dryRun: boolean
  force: boolean
  /** Reescribir las sugerencias `role(...)` con AST (`page.click` → `page.getByRole`). */
  ast: boolean
  pageObjects: boolean
  /** Grabar el historial aunque sea `--dry-run`. Existe para CI: la Action corre siempre en
   * dry-run porque su promesa es no tocar archivos, y sin esto nunca acumularía historial —
   * `computeChronic`/`computeRebroken` verían siempre una sola corrida y no podrían concluir
   * nada. `.healify/history.jsonl` es el registro propio de Healify, no un archivo de test:
   * escribirlo no rompe la promesa de no modificar el código del usuario. */
  recordHistory?: boolean
}

/** El historial se graba en un fix real, o cuando se pide explícitamente en dry-run. */
function shouldRecordHistory(opts: Pick<ApplyOptions, 'dryRun' | 'recordHistory'>): boolean {
  return !opts.dryRun || opts.recordHistory === true
}

/**
 * Núcleo de una aplicación: sustitución de texto y, para lo que no era sustituible, reescritura
 * por AST. Es lo único con lógica no trivial de `runFix`, y está acá afuera para que cada
 * iteración de `fix --watch` sea **exactamente** la misma pasada que un `healify fix` suelto —
 * si esto se duplicara, las dos ramas divergirían en el primer bugfix que se aplique a una sola.
 *
 * `run` es el reporte tal como se leyó (lo usa el armado del PR, que necesita confidence y
 * verified originales); `runForFix` puede diferir cuando `--interactive` filtró casos.
 */
export function applyRun(run: LocalRun, runForFix: LocalRun, opts: ApplyOptions): FixOutcome[] {
  const { dryRun, force, ast, pageObjects } = opts
  const outcomes = fix(runForFix, { dryRun, force, pageObjects })

  if (!ast) return outcomes

  const notSubstitutableKeys = new Set(
    outcomes
      .filter((o): o is Extract<FixOutcome, { status: 'skipped' }> => o.status === 'skipped' && o.reason === 'not-substitutable')
      .map((o) => `${o.testFile}::${o.selector}`)
  )
  const astRun: LocalRun = { ...runForFix, cases: runForFix.cases.filter((c) => notSubstitutableKeys.has(`${c.testFile}::${c.selector}`)) }
  const astByKey = new Map(fixAst(astRun, { dryRun, force }).map((o) => [`${o.testFile}::${o.selector}`, o]))

  for (let i = 0; i < outcomes.length; i++) {
    const astOutcome = astByKey.get(`${outcomes[i].testFile}::${outcomes[i].selector}`)
    if (astOutcome) outcomes[i] = astOutcome
  }

  return outcomes
}

/**
 * Una pasada completa contra un reporte en disco: leer → grabar historial → aplicar → imprimir.
 * Devuelve `false` si el reporte no se pudo leer, sin terminar el proceso — en `--watch` eso no
 * es un error, es "todavía no corriste los tests".
 */
export function applyFixOnce(reportPath: string, opts: ApplyOptions): boolean {
  let run: LocalRun
  try {
    run = JSON.parse(readFileSync(reportPath, 'utf-8'))
  } catch {
    return false
  }

  if (shouldRecordHistory(opts)) appendHistory(run, process.cwd())
  printOutcomes(applyRun(run, run, opts), run, opts.ast)
  return true
}

export function runFix(args: string[]): void {
  const dryRun = args.includes('--dry-run')
  const recordHistory = args.includes('--record-history')
  const force = args.includes('--force')
  const pr = args.includes('--pr')
  const ast = !args.includes('--no-ast')
  const pageObjects = !args.includes('--no-pom')
  const interactive = args.includes('--interactive')
  const reportPath = parseReportPath(args)

  // --watch es un loop: no termina, y --pr/--interactive no tienen sentido adentro (crear una
  // PR por cada corrida, o preguntar mientras el usuario está mirando otra cosa). Se delega
  // antes de leer nada, porque en watch el reporte puede todavía no existir.
  if (args.includes('--watch')) {
    return runFixWatch(reportPath, { dryRun, force, ast, pageObjects, recordHistory }, parseInterval(args))
  }

  let run: LocalRun
  try {
    run = JSON.parse(readFileSync(reportPath, 'utf-8'))
  } catch (error) {
    const { message, exitCode, stream } = describeReadError(reportPath, error)
    if (stream === 'log') console.log(message)
    else console.error(message)
    process.exit(exitCode)
  }

  const canPrompt = interactive && !!process.stdin.isTTY
  if (interactive && !canPrompt) {
    console.log('--interactive pedido, pero no hay una terminal para preguntar — sigo en modo automático.\n')
  }

  console.log(`Healify fix — ${reportPath}${ast ? '' : ' (--no-ast)'}${canPrompt ? ' (interactivo)' : ''}\n`)

  if (shouldRecordHistory({ dryRun, recordHistory })) appendHistory(run, process.cwd())

  let runForFix = run
  let declinedOutcomes: FixOutcome[] = []
  if (canPrompt) {
    const { approved, declined } = runInteractiveFix(run.cases, promptLine)
    declinedOutcomes = declined
    const declinedKeys = new Set(declined.map((d) => `${d.testFile}::${d.selector}`))
    runForFix = {
      ...run,
      cases: run.cases
        .filter((c) => !declinedKeys.has(`${c.testFile}::${c.selector}`))
        .map((c) => (approved.has(`${c.testFile}::${c.selector}`) ? { ...c, status: 'healed' as const } : c)),
    }
  }

  const outcomes = applyRun(run, runForFix, { dryRun, force, ast, pageObjects })

  // Map original case data for PR body (confidence, originalSelector, verified come from run.cases)
  const caseByKey = new Map(run.cases.map(c => [`${c.testFile}::${c.selector}`, c]))

  if (pr && outcomes.some(o => o.status === 'applied')) {
    const appliedCount = outcomes.filter(o => o.status === 'applied').length

    try {
      const branchName = createBranch()
      const modifiedFiles = [...new Set(outcomes.filter(o => o.status === 'applied').map(o => o.testFile))]
      createCommit(appliedCount, modifiedFiles)

      const hasGH = detectGitHubCLI()
      if (hasGH) {
        const appliedOutcomes = outcomes.filter(o => o.status === 'applied')
        const appliedCases = appliedOutcomes.map(o => ({
          outcome: o,
          originalCase: caseByKey.get(`${o.testFile}::${o.selector}`),
        })).filter((x): x is { outcome: Extract<FixOutcome, { status: 'applied' }>; originalCase: NonNullable<ReturnType<typeof caseByKey.get>> } => !!x.originalCase)
        const lowConfidence = appliedCases.filter(x => (x.originalCase.confidence ?? 0) < 0.90)
        const reviewCount = lowConfidence.length
        
        const tableRows = appliedCases.map(({ outcome: o, originalCase: c }) => 
          `| ${sanitizeMarkdownCell(c.selector)} | ${sanitizeMarkdownCell(o.fixedSelector)} | ${c.confidence ?? 0}% | ${c.verified ? '✅' : '⚠️'} |`
        ).join('\n')
        
        const reviewRows = lowConfidence.map(({ outcome: o, originalCase: c }) => 
          `| ${sanitizeMarkdownCell(c.selector)} | ${sanitizeMarkdownCell(o.fixedSelector)} | ${c.confidence ?? 0}% | ⚠️ |`
        ).join('\n')
        
        const prBody = `## Healify Auto-Fix

Resumen: ${appliedCount} selectores arreglados, ${reviewCount} necesitan revisión

### Selectores aplicados
| Original | Propuesto | Confianza | Verificado |
|----------|-----------|-----------|------------|
${tableRows}

${reviewCount > 0 ? `### Selectores que necesitan revisión
(los que confidence < 90%)

${reviewRows}
` : ''}Audit completo: healify-audit.json`
        const prURL = createPRWithGH('healify: fix broken selectors', prBody)
        console.log(`✅ PR created: ${prURL}`)
      } else {
        const instructions = createPRInstructions(branchName)
        console.log(instructions)
      }
    } catch (error) {
      console.error(`❌ Error creating PR: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  printOutcomes([...outcomes, ...declinedOutcomes], run, ast)
}

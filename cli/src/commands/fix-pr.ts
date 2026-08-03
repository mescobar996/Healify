import { readFileSync } from 'node:fs'
import type { LocalRun } from '@healify/reporter-core'
import { fix, describeReadError, type FixOutcome } from '../fix'
import { fixAst } from '../fix-ast'
import { detectGitHubCLI, createBranch, createCommit, createPRInstructions, createPRWithGH } from '../pr'
import { appendHistory } from '../history'
import { runInteractiveFix } from '../interactive'
import { promptLine } from '../prompt'

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
      return 'ya no se encontró en el archivo'
    case 'not-substitutable':
      return astUsed
        ? 'la sugerencia no es un rol reescribible (método sin mapeo, o no es una llamada de page/locator) — revisar y aplicar a mano'
        : 'la sugerencia no es un valor de selector sustituible directamente (formato de rol legible) — sacá --no-ast para que se reescriba sola, o revisá y aplicá a mano'
    case 'declined':
      return 'vos decidiste no aplicarlo'
  }
}

function printOutcomes(outcomes: FixOutcome[], run: LocalRun, astUsed: boolean): void {
  if (run.cases.length === 0) {
    console.log('Ningún selector roto en la última corrida — no hay nada que aplicar.')
    return
  }

  let applied = 0
  let skipped = 0

  for (const outcome of outcomes) {
    if (outcome.status === 'applied') {
      applied++
      console.log(`✓ ${outcome.testFile} — ${outcome.selector} → ${outcome.fixedSelector}`)
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

export function runFix(args: string[]): void {
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const pr = args.includes('--pr')
  const ast = !args.includes('--no-ast')
  const interactive = args.includes('--interactive')
  const reportPath = args.slice(1).find((a) => !a.startsWith('--')) ?? 'healify-report.json'

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

  if (!dryRun) appendHistory(run, process.cwd())

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

  const outcomes = fix(runForFix, { dryRun, force })

  // Map original case data for PR body (confidence, originalSelector, verified come from run.cases)
  const caseByKey = new Map(run.cases.map(c => [`${c.testFile}::${c.selector}`, c]))
  if (ast) {
    const notSubstitutableKeys = new Set(
      outcomes
        .filter((o): o is Extract<FixOutcome, { status: 'skipped' }> => o.status === 'skipped' && o.reason === 'not-substitutable')
        .map((o) => `${o.testFile}::${o.selector}`)
    )
    const astRun: LocalRun = { ...runForFix, cases: runForFix.cases.filter((c) => notSubstitutableKeys.has(`${c.testFile}::${c.selector}`)) }
    const astByKey = new Map(fixAst(astRun, { dryRun, force }).map((o) => [`${o.testFile}::${o.selector}`, o]))
    for (let i = 0; i < outcomes.length; i++) {
      const key = `${outcomes[i].testFile}::${outcomes[i].selector}`
      const astOutcome = astByKey.get(key)
      if (astOutcome) outcomes[i] = astOutcome
    }
  }

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

#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import type { LocalRun } from '@healify/reporter-core'
import { fix, type FixOutcome } from './fix'

function reasonText(outcome: Extract<FixOutcome, { status: 'skipped' }>): string {
  switch (outcome.reason) {
    case 'ambiguous':
      return `'${outcome.selector}' aparece más de una vez, ambiguo`
    case 'dirty-git':
      return 'cambios sin commitear (usá --force para ignorar)'
    case 'not-found':
      return 'ya no se encontró en el archivo'
    case 'not-substitutable':
      return 'la sugerencia no es un valor de selector sustituible directamente (formato de rol legible) — revisar y aplicar a mano'
  }
}

function printOutcomes(outcomes: FixOutcome[], run: LocalRun): void {
  let applied = 0
  let skipped = 0

  for (const outcome of outcomes) {
    if (outcome.status === 'applied') {
      applied++
      console.log(`✓ ${outcome.testFile} — ${outcome.selector} → ${outcome.fixedSelector}`)
    } else {
      skipped++
      console.log(`⚠ ${outcome.testFile} — saltado: ${reasonText(outcome)}`)
    }
  }

  const reviewCount = run.cases.filter((c) => c.status === 'review').length
  const reviewSuffix = reviewCount > 0
    ? ` · ${reviewCount} caso${reviewCount === 1 ? '' : 's'} "review" sin tocar (ver healify-report.html)`
    : ''

  console.log(`\n${applied} selector${applied === 1 ? '' : 'es'} aplicado${applied === 1 ? '' : 's'} · ${skipped} salteado${skipped === 1 ? '' : 's'}${reviewSuffix}`)
}

function main(): void {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command !== 'fix') {
    console.error('Uso: healify fix [reporte.json] [--dry-run] [--force]')
    process.exit(1)
  }

  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const reportPath = args.slice(1).find((a) => !a.startsWith('--')) ?? 'healify-report.json'

  let run: LocalRun
  try {
    run = JSON.parse(readFileSync(reportPath, 'utf-8'))
  } catch (error) {
    console.error(`No se pudo leer ${reportPath}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  console.log(`Healify fix — ${reportPath}\n`)
  const outcomes = fix(run, { dryRun, force })
  printOutcomes(outcomes, run)
}

main()

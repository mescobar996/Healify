#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import type { LocalRun } from '@healify/reporter-core'
import { fix, type FixOutcome } from './fix'
import { init, type InitReport } from './commands/init'
import { doctor, type DoctorReport } from './commands/doctor'

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

function runFix(args: string[]): void {
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

function printInitReport(report: InitReport): void {
  console.log('Healify init\n')

  for (const r of report.results) {
    if (r.installed === 'already-installed') console.log(`✅ ${r.package} ya estaba instalado`)
    else if (r.installed === 'installed') console.log(`✅ ${r.package} instalado`)
    else console.log(`❌ No pudimos instalar ${r.package} — instalalo a mano: npm install --save-dev ${r.package}`)

    if (r.framework === 'selenium') {
      console.log(`ℹ Selenium no tiene config para editar — envolvé tu driver a mano, ver el README de ${r.package}`)
      continue
    }

    if (r.config === 'already-wired') console.log(`✅ el config ya tenía Healify configurado`)
    else if (r.config === 'edited') console.log(`✅ config actualizado con Healify`)
    else if (r.config === 'no-config-found') console.log(`⚠ no encontramos el config de ${r.framework} — agregalo a mano, ver README`)
    else console.log(`⚠ el config tiene una forma que no reconocemos — agregá Healify a mano, ver README`)
  }
}

function runInit(): void {
  const report = init()

  if (report.frameworks.length === 0) {
    console.error('No detectamos Playwright, Cypress ni Selenium en este proyecto.')
    console.error('Healify soporta: Playwright (@playwright/test), Cypress (cypress), Selenium (selenium-webdriver).')
    console.error('Instalá uno de estos frameworks primero y volvé a correr: npx healify init')
    process.exit(1)
  }

  printInitReport(report)
}

function printDoctorReport(report: DoctorReport): void {
  console.log('Healify doctor\n')
  for (const check of report.checks) {
    console.log(`${check.ok ? '✅' : '❌'} ${check.label}`)
    if (!check.ok && check.fix) console.log(`   fix: ${check.fix}`)
  }
}

function printHelp(): void {
  console.log(`Uso: healify <comando>

Comandos:
  init                                       Detecta tu framework, instala el paquete de Healify que falte y configura el reporter/plugin
  doctor                                     Verifica que Healify esté instalado y bien configurado
  fix [reporte.json] [--dry-run] [--force]   Aplica las sugerencias de mayor confianza directo en tus archivos de test`)
}

function main(): void {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'init') return runInit()
  if (command === 'doctor') return printDoctorReport(doctor())
  if (command === 'fix') return runFix(args)

  printHelp()
  if (command) process.exit(1)
}

main()

#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import type { LocalRun } from '@healify/reporter-core'
import { fix, type FixOutcome } from './fix'
import { init, type InitReport, type FrameworkInitResult } from './commands/init'
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

/** Mensaje final por framework — ninguno asume que ya hay algo para "correr": init no genera tests. */
function nextStepFor(framework: FrameworkInitResult['framework']): string {
  if (framework === 'selenium') {
    return '✅ Instalado. Ver healify.selenium.example.ts para el patrón de wrap() — copialo a tu código real, no hay nada que ejecutar acá.'
  }
  const testDir = framework === 'playwright' ? 'e2e/' : 'cypress/e2e/'
  return `✅ Config lista. Escribí tu primer test en ${testDir} y corré tus tests — cuando un selector se rompa vas a tener healify-report.html.`
}

function printInitReport(report: InitReport): void {
  console.log('Healify init\n')

  if (report.prompted) {
    console.log(`ℹ No detectamos ningún framework de e2e — armamos ${report.results[0].framework} desde cero.\n`)
  }

  for (const r of report.results) {
    if (r.installed === 'already-installed') console.log(`✅ ${r.package} ya estaba instalado`)
    else if (r.installed === 'installed') console.log(`✅ ${r.package} instalado`)
    else console.log(`❌ No pudimos instalar ${r.package} — instalalo a mano: npm install --save-dev ${r.package}`)

    if (r.config === 'scaffolded') {
      if (r.scaffoldedFiles && r.scaffoldedFiles.length > 0) {
        console.log(`✅ archivos creados:`)
        for (const f of r.scaffoldedFiles) console.log(`   - ${f}`)
      } else {
        console.log(`✅ ${r.framework} ya tenía todos los archivos de Healify`)
      }
    } else if (r.config === 'already-wired') {
      console.log(`✅ el config ya tenía Healify configurado`)
    } else if (r.config === 'edited') {
      console.log(`✅ config actualizado con Healify`)
    } else if (r.config === 'no-config-found') {
      console.log(`⚠ no encontramos el config de ${r.framework} — agregalo a mano, ver README`)
    } else {
      console.log(`⚠ el config tiene una forma que no reconocemos — agregá Healify a mano, ver README`)
    }

    console.log(`\n${nextStepFor(r.framework)}`)
  }
}

function runInit(): void {
  printInitReport(init())
}

function printDoctorReport(report: DoctorReport): void {
  console.log('Healify doctor\n')
  for (const check of report.checks) {
    const icon = check.info ? 'ℹ️' : check.ok ? '✅' : '❌'
    console.log(`${icon} ${check.label}`)
    if (!check.ok && check.fix) console.log(`   fix: ${check.fix}`)
  }
}

function printHelp(): void {
  console.log(`Uso: healify <comando>

Comandos:
  init                                       Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte y configura el reporter/plugin (sin generar tests)
  doctor                                     Verifica que Healify esté instalado y bien configurado
  fix [reporte.json] [--dry-run] [--force]   Aplica las sugerencias de mayor confianza directo en tus archivos de test`)
}

function main(): void {
  const args = process.argv.slice(2)
  const command = args[0]

  // --help/-h en cualquier posición muestra el uso y no ejecuta nada — antes 'init --help'
  // corría init de verdad (instalaba paquetes, editaba configs), confirmado corriendo el
  // binario real. --help nunca debe tener efectos secundarios.
  if (args.includes('--help') || args.includes('-h')) return printHelp()

  if (command === 'init') return runInit()
  if (command === 'doctor') return printDoctorReport(doctor())
  if (command === 'fix') return runFix(args)

  printHelp()
  if (command) process.exit(1)
}

main()

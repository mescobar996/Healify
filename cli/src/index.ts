#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import type { LocalRun } from '@healify/reporter-core'
import { fix, describeReadError, type FixOutcome } from './fix'
import { fixAst } from './fix-ast'
import { appendHistory } from './history'
import { init, type InitReport, type FrameworkInitResult } from './commands/init'
import { doctor, type DoctorReport } from './commands/doctor'
import { history, type HistoryReport } from './commands/history'
import { getVersion } from './version'

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
        : 'la sugerencia no es un valor de selector sustituible directamente (formato de rol legible) — probá --ast (experimental) o revisá y aplicá a mano'
  }
}

function printOutcomes(outcomes: FixOutcome[], run: LocalRun, astUsed: boolean): void {
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

function runFix(args: string[]): void {
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const ast = args.includes('--ast')
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

  console.log(`Healify fix — ${reportPath}${ast ? ' (--ast)' : ''}\n`)

  // Se graba ANTES de aplicar los fixes, con el estado real del reporte (todos los casos,
  // no solo lo que fix() termina aplicando) — así "recurrente"/"re-roto" reflejan selectores
  // rotos de verdad, no solo los auto-aplicables. --dry-run nunca graba: el gh-action corre
  // `fix --dry-run` en cada PR, y si eso grabara el historial se llenaría de ruido de CI que
  // no representa corridas reales de un dev.
  if (!dryRun) appendHistory(run, process.cwd())

  // --ast es aditivo, no reemplaza a fix(): primero corre el reemplazo de texto normal
  // (cubre TESTID/CSS/TEXT, que ya son valores de selector pegables tal cual), y solo
  // reintenta con reescritura AST los casos que ese primer paso saltó como
  // 'not-substitutable' (los role(...), que fix() nunca puede aplicar). Si --ast
  // reemplazara a fix() en vez de complementarlo, los casos TEXT/CSS quedarían sin
  // procesar en silencio.
  const outcomes = fix(run, { dryRun, force })
  if (ast) {
    const notSubstitutableKeys = new Set(
      outcomes
        .filter((o): o is Extract<FixOutcome, { status: 'skipped' }> => o.status === 'skipped' && o.reason === 'not-substitutable')
        .map((o) => `${o.testFile}::${o.selector}`)
    )
    const astRun: LocalRun = { ...run, cases: run.cases.filter((c) => notSubstitutableKeys.has(`${c.testFile}::${c.selector}`)) }
    const astByKey = new Map(fixAst(astRun, { dryRun, force }).map((o) => [`${o.testFile}::${o.selector}`, o]))
    for (let i = 0; i < outcomes.length; i++) {
      const key = `${outcomes[i].testFile}::${outcomes[i].selector}`
      const astOutcome = astByKey.get(key)
      if (astOutcome) outcomes[i] = astOutcome
    }
  }

  printOutcomes(outcomes, run, ast)
}

/** Mensaje final por framework — ninguno asume que ya hay algo para "correr": init no genera tests. */
function nextStepFor(result: FrameworkInitResult): string {
  const { framework, ext, moduleType } = result
  if (framework === 'selenium') {
    return '✅ Instalado. Ver healify.selenium.example.ts para el patrón de wrap() — copialo a tu código real, no hay nada que ejecutar acá.'
  }
  if (framework === 'webdriverio') {
    return '✅ Instalado. Ver healify.wdio.example.ts para el patrón de wrap() — copialo a tu código real, no hay nada que ejecutar acá.'
  }
  const isPlaywright = framework === 'playwright'
  const testFile = isPlaywright ? `e2e/mi-primer-test.spec.${ext}` : `cypress/e2e/mi-primer-test.cy.${ext}`
  // En un proyecto JS + CommonJS, `import` no corre: el snippet tiene que ser copiable tal cual.
  const importLine =
    ext === 'js' && moduleType === 'cjs'
      ? "const { test, expect } = require('@playwright/test')"
      : "import { test, expect } from '@playwright/test'"
  const snippet = isPlaywright
    ? [
        importLine,
        '',
        "test('mi primer test', async ({ page }) => {",
        "  await page.goto('/')",
        "  await page.click('#reemplazar-por-tu-selector-real')",
        '})',
      ]
    : [
        "it('mi primer test', () => {",
        "  cy.visit('/')",
        "  cy.get('#reemplazar-por-tu-selector-real').click()",
        '})',
      ]

  return [
    '✅ Config lista. Healify no te genera tests: el primer selector que cure tiene que ser',
    '   uno de tu propia app. Creá este archivo y editalo:',
    '',
    `   ${testFile}`,
    '',
    ...snippet.map((line) => (line === '' ? '' : `   ${line}`)),
    '',
    "   Reemplazá '#reemplazar-por-tu-selector-real' por un selector de tu app (un botón, un",
    '   link, cualquier elemento que ya exista). Corré tus tests y, cuando ese selector se',
    '   rompa, vas a tener healify-report.html.',
  ].join('\n')
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

    console.log(`\n${nextStepFor(r)}`)
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

function printHistoryReport(report: HistoryReport): void {
  console.log('Healify history\n')

  if (!report.hasHistory) {
    console.log('Todavía no hay historial — corré healify fix (sin --dry-run) al menos una vez para empezar a registrar selectores rotos.')
    return
  }

  console.log('Top selectores recurrentes:')
  for (const r of report.topRecurrent) {
    console.log(`  ${r.count}x  ${r.selector}`)
  }

  console.log('\nSelectores re-rotos (aproximado: se curaron con confianza antes y volvieron a aparecer rotos después):')
  if (report.rebroken.length === 0) {
    console.log('  ninguno todavía')
  } else {
    for (const r of report.rebroken) {
      console.log(`  ${r.count}x  ${r.selector} (curado por primera vez ${r.firstHealedAt})`)
    }
  }
}

function printHelp(): void {
  console.log(`Uso: healify <comando>

Comandos:
  init                                       Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte y configura el reporter/plugin (sin generar tests)
  doctor                                     Verifica que Healify esté instalado y bien configurado
  fix [reporte.json] [--dry-run] [--force] [--ast]   Aplica las sugerencias de mayor confianza directo en tus archivos de test
                                                       --ast (experimental) también reescribe sugerencias role(...) vía AST
  history                                    Muestra selectores recurrentes y re-rotos de .healify/history.jsonl (se graba en cada fix real, no en --dry-run)

Flags globales:
  --version, -v                              Muestra la versión instalada de @healify/cli
  --help, -h                                 Muestra esta ayuda`)
}

function main(): void {
  const args = process.argv.slice(2)
  const command = args[0]

  // --version/-v en cualquier posición imprime la versión y no ejecuta nada. Sin esto, un
  // usuario que sospecha tener una versión vieja (el pozo del caret) no tiene forma de
  // chequearla con la propia herramienta.
  if (args.includes('--version') || args.includes('-v')) return console.log(getVersion())

  // --help/-h en cualquier posición muestra el uso y no ejecuta nada — antes 'init --help'
  // corría init de verdad (instalaba paquetes, editaba configs), confirmado corriendo el
  // binario real. --help nunca debe tener efectos secundarios.
  if (args.includes('--help') || args.includes('-h')) return printHelp()

  if (command === 'init') return runInit()
  if (command === 'doctor') return printDoctorReport(doctor())
  if (command === 'fix') return runFix(args)
  if (command === 'history') return printHistoryReport(history())

  printHelp()
  if (command) process.exit(1)
}

main()

#!/usr/bin/env node
import { BROWSER_PROBE_SCRIPT } from '@healify/reporter-core'
import { init, type InitReport, type FrameworkInitResult } from './commands/init'
import { doctor, type DoctorReport } from './commands/doctor'
import { history, type HistoryReport } from './commands/history'
import { runHeal, readHealStats, formatHealStatsSummary } from './commands/heal'
import { runExplain } from './commands/explain'
import { runFix } from './commands/fix-pr'
import { runReport } from './commands/report'
import { runDashboard, runDashboardServe, type DashboardServeResult } from './commands/dashboard'
import { runFlake } from './commands/flake'
import { getVersion } from './version'
import { runAiSetup, runAiStatus, runAiExplain, runAiChat, runAiModels } from './commands/ai'

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

  // Primero lo accionable: un conteo no le dice a nadie qué hacer, una recomendación sí.
  if (report.chronic.length > 0) {
    console.log('Selectores crónicos (3+ roturas) — acá conviene dejar de parchear:')
    for (const c of report.chronic) {
      const donde = c.testFile ? ` (${c.testFile})` : ''
      console.log(`  ${c.selector}${donde}`)
      console.log(`    ${c.recommendation}`)
    }
    console.log('')
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

function readStdinWithTimeout(timeoutMs: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        process.stdin.destroy()
        reject(new Error(`stdin timeout after ${timeoutMs}ms — pipe JSON data or use a file`))
      }
    }, timeoutMs)

    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
    process.stdin.on('end', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve(Buffer.concat(chunks).toString('utf-8'))
      }
    })
    process.stdin.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(err)
      }
    })

    // If stdin is already closed (piped and finished), resolve immediately
    if (process.stdin.readableEnded || process.stdin.readableFlowing === false && process.stdin.readableLength > 0) {
      // Already has data or ended — let events handle it
    }
  })
}

/**
 * `healify heal` — el motor expuesto para cualquier lenguaje que pueda spawnear un
 * subproceso: JSON por stdin, JSON por stdout. Ver `commands/heal.ts` para el contrato
 * completo y `docs/adapters/README.md` para ejemplos de integración.
 *
 * `--stats` imprime el resumen de las estadísticas acumuladas en `~/.healify/stats.json`.
 * Va a stderr a propósito: stdout sigue siendo JSON puro, para no romperle el parsing al
 * caller de cualquier lenguaje.
 */
async function runHealCommand(args: string[]): Promise<void> {
  const showStats = args.includes('--stats')
  let raw: string
  try {
    raw = await readStdinWithTimeout(5000)
  } catch (error) {
    console.log(JSON.stringify({ error: `No se pudo leer stdin: ${error instanceof Error ? error.message : String(error)}` }))
    process.exit(1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.log(JSON.stringify({ error: 'stdin no es JSON válido. Se espera { "selector": "..." } como mínimo.' }))
    process.exit(1)
  }

  const result = runHeal(parsed)
  if (!result.ok) {
    console.log(JSON.stringify({ error: result.error }))
    process.exit(1)
  }
  console.log(JSON.stringify(result.output))
  if (showStats) console.error(formatHealStatsSummary(readHealStats()))
}

function runReportCommand(args: string[]): void {
  runReport(args).then((result) => {
    console.log(result.lines.join('\n'))
    if (!result.ok) process.exit(1)
  })
}

function printDashboardServeResult(result: DashboardServeResult): void {
  console.log(result.lines.join('\n'))
  if (!result.ok) return process.exit(1)
  const close = result.close
  if (!close) return
  const shutdown = () => {
    close().then(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function runDashboardCommand(args: string[]): void {
  if (args.includes('--serve')) {
    // El servidor mantiene el event loop vivo: no hace falta nada más para que el proceso dure.
    runDashboardServe(args).then(printDashboardServeResult)
    return
  }
  const result = runDashboard(args)
  console.log(result.lines.join('\n'))
  if (!result.ok) process.exit(1)
}

function runFlakeCommand(args: string[]): void {
  const result = runFlake(args)
  console.log(result.lines.join('\n'))
  if (!result.ok) process.exit(1)
}

function runExplainCommand(args: string[]): void {
  const result = runExplain(args)
  if (!result.ok) {
    console.error(result.error)
    process.exit(1)
  }
  console.log(result.humanText)
}

function printHelp(): void {
  console.log(`Uso: healify <comando>

Comandos:
  init                                       Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte y configura el reporter/plugin (sin generar tests)
  doctor                                     Verifica que Healify esté instalado y bien configurado
  fix [reporte.json] [--dry-run] [--force] [--pr] [--no-ast] [--no-pom] [--interactive] [--watch]   Aplica las sugerencias de mayor confianza directo en tus archivos de test
                                                        --pr crea branch, commit y PR con los cambios
                                                        --no-ast desactiva la reescritura de sugerencias role(...) (page.click → page.getByRole)
                                                        --no-pom no busca el selector en los page objects cuando no está en el archivo de test
                                                       --interactive pregunta caso por caso en vez de aplicar todo solo (necesita una terminal real)
                                                        --watch [--interval <ms>] se queda vigilando el reporte y re-aplica en cada corrida nueva (Ctrl+C para salir)
                                                        --record-history graba .healify/history.jsonl aunque sea --dry-run (para CI, que nunca toca archivos)
  history                                    Muestra selectores recurrentes y re-rotos de .healify/history.jsonl (se graba en cada fix real, no en --dry-run)
  report [reporte.json] [--dry-run]          Reporta los defectos de la corrida a tu Jira (o webhook) — dedupe por defectId, opt-in (agile.enabled: true)
                                                        --dry-run imprime qué se reportaría sin tocar la red
  dashboard [--out <path>] [--serve] [--port <n>] [--open]   Genera healify-dashboard.html, la vista offline del histórico (misma estética que healify-report.html)
                                                        --out cambia la ruta del archivo (default: healify-dashboard.html)
                                                        --serve levanta un servidor local con la UI de dashboard-web + la API JSON (stats.json + history.jsonl)
                                                        --port cambia el puerto del servidor (default: 5173)
                                                        --open abre el navegador al arrancar el servidor
  flake [--min-runs <n>]                     Detecta tests flaky (verde en unas corridas, rojo en otras) sobre .healify/runs.jsonl, lo que registran los reporters de Playwright/Cypress en cada corrida
                                                        --min-runs cambia la cantidad mínima de corridas para opinar (default: 2)
  heal [--stats]                              Motor vía JSON por stdin/stdout, para usar desde Python/Java/C#/etc. Ver docs/adapters/README.md
                                                        --stats imprime el resumen de las estadísticas acumuladas en ~/.healify/stats.json (sin telemetría: nunca sale de tu máquina)
  probe-script                               Imprime el script que hay que correr con execute_script() para sondear el DOM (insumo de "heal")
  explain [selector] [--json]                Explica POR QUÉ un selector es frágil y qué propone el motor. Sin args, analiza el último fallo del reporte

Comandos IA (requiere Ollama):
  ai setup                                   Configura IA local: detecta Ollama, sugiere modelo según RAM, guarda configuración
  ai status                                  Muestra estado de Ollama y modelos instalados
  ai explain <selector>                      Explica con IA por qué un selector es frágil (requiere Ollama)
  ai chat                                    Chat interactivo con IA sobre tests
  ai models                                  Lista modelos de Ollama disponibles y recomendados

Flags globales:
  --version, -v                              Muestra la versión instalada de @healify/cli
  --help, -h                                 Muestra esta ayuda`)
}

/**
 * Los comandos asíncronos que se disparan fire-and-forget (heal, ai) nunca deben morir con un
 * `unhandledRejection` y un stack trace sin contexto: el CLI es la cara del motor y un fallo
 * inesperado se reporta igual de limpio que un error conocido.
 */
function handleCommandError(error: unknown): void {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
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
  if (command === 'report') return runReportCommand(args.slice(1))
  if (command === 'dashboard') return runDashboardCommand(args.slice(1))
  if (command === 'flake') return runFlakeCommand(args.slice(1))
  if (command === 'heal') { void runHealCommand(args.slice(1)).catch(handleCommandError); return }
  if (command === 'explain') return runExplainCommand(args.slice(1))
  if (command === 'probe-script') return console.log(BROWSER_PROBE_SCRIPT)

  // Comandos IA
  if (command === 'ai') {
    const aiCommand = args[1]
    if (aiCommand === 'setup') { void runAiSetup().catch(handleCommandError); return }
    if (aiCommand === 'status') { void runAiStatus().catch(handleCommandError); return }
    if (aiCommand === 'explain') { void runAiExplain(args.slice(2)).catch(handleCommandError); return }
    if (aiCommand === 'chat') { void runAiChat().catch(handleCommandError); return }
    if (aiCommand === 'models') { void runAiModels().catch(handleCommandError); return }
    console.log('Uso: healify ai <setup|status|explain|chat|models>')
    process.exit(1)
  }

  printHelp()
  if (command) process.exit(1)
}

main()

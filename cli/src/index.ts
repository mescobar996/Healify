#!/usr/bin/env node
import { BROWSER_PROBE_SCRIPT } from '@healify/reporter-core'
import { init, HEALIFY_SCRIPTS, type InitReport, type FrameworkInitResult } from './commands/init'
import { doctor, type DoctorReport } from './commands/doctor'
import { history, type HistoryReport } from './commands/history'
import { runHeal, readHealStats, formatHealStatsSummary } from './commands/heal'
import { runExplain } from './commands/explain'
import { runFix } from './commands/fix-pr'
import { runReport } from './commands/report'
import { runDashboard, runDashboardServe, type DashboardServeResult } from './commands/dashboard'
import { runFlake } from './commands/flake'
import { runConfirm } from './commands/confirm'
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

/** Comando para correr la suite de tests según el framework detectado — el primer paso
 * del cierre de `init` tiene que decir qué ejecutar, no dejar que el usuario lo adivine. */
function testCommandFor(framework: string): string {
  switch (framework) {
    case 'playwright':
      return 'npx playwright test'
    case 'cypress':
      return 'npx cypress run'
    case 'webdriverio':
      return 'npx wdio run'
    case 'selenium':
      return 'npm test'
    default:
      return 'npm test'
  }
}

function printInitReport(report: InitReport): void {
  if (report.dryRun) {
    printInitDryRun(report)
    return
  }

  // Paso 1: detección, con la evidencia — el usuario ve POR QUÉ lo detectamos.
  const detected = report.detected ?? report.results.map((r) => ({ framework: r.framework, evidence: [] as string[] }))
  console.log('1/4 Detectando tu framework de tests…')
  if (report.prompted) {
    console.log(`   ℹ No detectamos ningún framework de e2e — armamos ${report.results[0].framework} desde cero.`)
  } else {
    for (const d of detected) {
      const label = d.framework.charAt(0).toUpperCase() + d.framework.slice(1)
      console.log(`   ✔ ${label}${d.evidence.length > 0 ? ` — ${d.evidence.join(' · ')}` : ''}`)
    }
  }

  // Paso 2: instalación.
  console.log('\n2/4 Instalando lo que falta…')
  for (const r of report.results) {
    if (r.installed === 'already-installed') console.log(`   ✔ ${r.package} ya estaba instalado`)
    else if (r.installed === 'installed') console.log(`   ✔ ${r.package} instalado`)
    else console.log(`   ❌ No pudimos instalar ${r.package} — instalalo a mano: npm install --save-dev ${r.package}`)
  }

  // Paso 3: configuración.
  console.log('\n3/4 Conectando Healify…')
  for (const r of report.results) {
    if (r.config === 'scaffolded') {
      if (r.scaffoldedFiles && r.scaffoldedFiles.length > 0) {
        console.log('   ✔ archivos creados:')
        for (const f of r.scaffoldedFiles) console.log(`     - ${f}`)
      } else {
        console.log(`   ✔ ${r.framework} ya tenía todos los archivos de Healify`)
      }
    } else if (r.config === 'already-wired') {
      console.log(`   ✔ el config ya tenía Healify configurado`)
    } else if (r.config === 'edited') {
      console.log(`   ✔ config actualizado con Healify`)
    } else if (r.config === 'no-config-found') {
      console.log(`   ⚠ no encontramos el config de ${r.framework} — agregalo a mano, ver README`)
    } else {
      console.log(`   ⚠ el config tiene una forma que no reconocemos — agregá Healify a mano, ver README`)
    }
  }

  // Paso 4: scripts de conveniencia.
  const scriptsAdded = report.scriptsAdded ?? []
  console.log('\n4/4 Scripts en tu package.json…')
  if (scriptsAdded.length > 0) {
    for (const name of scriptsAdded) {
      const script = HEALIFY_SCRIPTS.find((s) => s.name === name)
      if (script) console.log(`   ✔ "${name}": ${script.command}`)
    }
  } else {
    console.log('   ✔ ya estaban todos')
  }

  // Verificación instantánea: el mismo `healify doctor`, corrido acá para cerrar con el
  // estado real — nada de "debería andar", se muestra lo que hay.
  console.log('\nVerificación instantánea — healify doctor:')
  printDoctorReport(doctor())

  // Cierre: un solo siguiente paso, siempre el mismo camino — con el comando de test
  // concreto del framework detectado, no una instrucción genérica.
  const testCommands = [...new Set(report.results.map((r) => testCommandFor(r.framework)))]
  const testLine = testCommands.length === 1
    ? `Corré tus tests: ${testCommands[0]}`
    : `Corré tus tests (${testCommands.join(' o ')}) — los tuyos, Healify no te genera tests.`
  console.log('\n🎉 Listo. Tu primer "momento Healify" es así:')
  console.log(`   1. ${testLine}`)
  console.log('   2. Cuando un selector se rompa:  npm run healify')
  console.log('   3. Mirá lo que pasó:             npm run healify:dashboard')

  if (report.portWarning) console.log(`\n⚠ ${report.portWarning}`)

  // Siguiente paso por framework: para Selenium/WebdriverIO es el patrón de wrap(), para
  // Playwright/Cypress el snippet de primer test (por si el proyecto todavía no tiene uno).
  for (const r of report.results) {
    if (r.framework === 'selenium' || r.framework === 'webdriverio' || r.framework === 'playwright' || r.framework === 'cypress') {
      console.log(`\n${nextStepFor(r)}`)
    }
  }
}

/** `--dry-run`: el plan completo sin tocar nada. */
function printInitDryRun(report: InitReport): void {
  const plan = report.plan ?? { install: [], configs: [], scripts: [] }
  console.log('Healify init --dry-run — nada se escribió, esto es lo que haríamos:\n')

  const detected = report.detected ?? []
  console.log('Detectar:')
  if (report.prompted) console.log('   ⚠ ningún framework de e2e — preguntaríamos cuál armar')
  else if (detected.length === 0) console.log('   — nada detectado')
  else for (const d of detected) console.log(`   ✔ ${d.framework}${d.evidence.length > 0 ? ` — ${d.evidence.join(' · ')}` : ''}`)

  console.log('\nInstalar:')
  if (plan.install.length === 0) console.log('   — nada que instalar')
  else for (const line of plan.install) console.log(`   ✔ ${line}`)

  console.log('\nConfigurar:')
  if (plan.configs.length === 0) console.log('   — nada que configurar')
  else for (const line of plan.configs) console.log(`   ✔ ${line}`)

  console.log('\nScripts en package.json:')
  if (plan.scripts.length === 0) console.log('   — ya estaban todos')
  else for (const name of plan.scripts) {
    const script = HEALIFY_SCRIPTS.find((s) => s.name === name)
    if (script) console.log(`   ✔ "${name}": ${script.command}`)
  }

  console.log('\nCorré `npx @healify/cli init` para aplicarlo.')
}

function runInit(args: string[]): void {
  // El encabezado va antes de init(): en el CASO A interactivo el prompt de elección de
  // framework ocurre dentro de init(), y el usuario tiene que ver el contexto primero.
  if (!args.includes('--dry-run')) {
    console.log('Healify init — dejemos todo listo para tu primera curación.\n')
  }
  printInitReport(init(process.cwd(), { dryRun: args.includes('--dry-run') }))
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
  init                                       Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte, configura el reporter/plugin y añade scripts npm (sin generar tests). Con --dry-run solo muestra el plan
  doctor                                     Verifica que Healify esté instalado y bien configurado
  fix [reporte.json] [--dry-run] [--force] [--pr] [--no-ast] [--no-pom] [--interactive] [--watch] [--validate] [--suggest-only] [--min-confidence <n>] [--test-command <cmd>]   Aplica las sugerencias de mayor confianza directo en tus archivos de test
                                                        --pr crea branch, commit y PR con los cambios
                                                        --no-ast desactiva la reescritura de sugerencias role(...) (page.click → page.getByRole)
                                                        --no-pom no busca el selector en los page objects cuando no está en el archivo de test
                                                       --interactive pregunta caso por caso en vez de aplicar todo solo (necesita una terminal real)
                                                        --watch [--interval <ms>] se queda vigilando el reporte y re-aplica en cada corrida nueva (Ctrl+C para salir)
                                                        --record-history graba .healify/history.jsonl aunque sea --dry-run (para CI, que nunca toca archivos)
                                                        --validate vuelve a correr el test del caso tras aplicar; si falla, revierte el cambio (usa --test-command para proyectos custom)
                                                        --suggest-only imprime las sugerencias (viejo → nuevo, confianza, verificado) sin modificar archivos
                                                        --min-confidence <n> piso de confianza para aplicar (default 0.8); bajo el umbral, solo sugerencia
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
  confirm --id <defectId> [--accepted|--rejected]   Marca los fixes de un defectId como aceptados o rechazados en el historial (métrica de eficacia del dashboard)

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

/** Dispatch del CLI: parsea argv, imprime ayuda/versión o delega al comando correspondiente. */
export function runCli(args: string[]): void {
  const command = args[0]

  // --version/-v en cualquier posición imprime la versión y no ejecuta nada. Sin esto, un
  // usuario que sospecha tener una versión vieja (el pozo del caret) no tiene forma de
  // chequearla con la propia herramienta.
  if (args.includes('--version') || args.includes('-v')) return console.log(getVersion())

  // --help/-h en cualquier posición muestra el uso y no ejecuta nada — antes 'init --help'
  // corría init de verdad (instalaba paquetes, editaba configs), confirmado corriendo el
  // binario real. --help nunca debe tener efectos secundarios.
  if (args.includes('--help') || args.includes('-h')) return printHelp()

  if (command === 'init') return runInit(args)
  if (command === 'doctor') return printDoctorReport(doctor())
  if (command === 'fix') return runFix(args)
  if (command === 'history') return printHistoryReport(history())
  if (command === 'report') return runReportCommand(args.slice(1))
  if (command === 'dashboard') return runDashboardCommand(args.slice(1))
  if (command === 'flake') return runFlakeCommand(args.slice(1))
  if (command === 'heal') { void runHealCommand(args.slice(1)).catch(handleCommandError); return }
  if (command === 'explain') return runExplainCommand(args.slice(1))
  if (command === 'probe-script') return console.log(BROWSER_PROBE_SCRIPT)
  if (command === 'confirm') {
    const result = runConfirm(args.slice(1))
    for (const line of result.lines) console.log(line)
    if (!result.ok) process.exit(1)
    return
  }

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

// Solo se dispara cuando el binario corre como entrypoint: importar index.ts desde un test
// (o desde otro módulo) no debe ejecutar comandos con efectos secundarios.
if (require.main === module) {
  runCli(process.argv.slice(2))
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import {
  detectFramework,
  findConfigForFramework,
  healifyPackageFor,
  installCommand,
  hasTypescript,
  detectModuleType,
  detectBaseUrl,
  type Framework,
  type ModuleType,
  type DetectResult,
} from '../detect'
import { wirePlaywrightConfig, wireCypressConfig, type EditStatus } from '../config-edit'
import { scaffoldPlaywright, scaffoldCypress, scaffoldSelenium, scaffoldWebdriverio, type ScaffoldFile } from '../scaffold'
import { promptFrameworkChoice } from '../prompt'

export type ConfigOutcome = EditStatus | 'no-config-found' | 'scaffolded'

export interface FrameworkInitResult {
  framework: Framework
  package: string
  installed: 'already-installed' | 'installed' | 'install-failed'
  config: ConfigOutcome
  scaffoldedFiles?: string[]
  /** Forma real del proyecto, la misma que se usó para scaffoldear — para que el mensaje
   * final sugiera un archivo de test que coincida (nada de pedir un `.ts` en un proyecto
   * sin TypeScript, ni `import` en uno CommonJS). */
  ext: 'ts' | 'js'
  moduleType: ModuleType
}

export interface InitReport {
  frameworks: Framework[]
  results: FrameworkInitResult[]
  /** true si no se detectó ningún framework y se eligió uno interactivamente (CASO A). */
  prompted: boolean
  /** Evidencia de detección por framework — para que el output explique POR QUÉ se detectó. */
  detected?: Array<{ framework: Framework; evidence: string[] }>
  /** Scripts añadidos a package.json en esta corrida (`healify`, `healify:dry`, `healify:dashboard`). */
  scriptsAdded?: string[]
  /** true en `--dry-run`: nada se instaló, editó ni escribió — `plan` dice qué se haría. */
  dryRun?: boolean
  plan?: DryRunPlan
  /** Advertencia sobre el puerto detectado en baseURL — si algo ya responde ahí. */
  portWarning?: string
}

export interface DryRunPlan {
  install: string[]
  configs: string[]
  scripts: string[]
}

export interface InitOptions {
  /** Inyectable para tests — evita el prompt real de stdin. */
  chooseFramework?: (defaultFramework: Framework) => Framework
  /** Inyectable para tests — evita el chequeo real de puerto. */
  checkPort?: (port: number) => boolean
  /** `--dry-run`: detectar y planificar sin tocar nada (sin install, sin scaffold, sin scripts). */
  dryRun?: boolean
}

function isInstalled(cwd: string, pkg: string): boolean {
  try {
    const raw = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return pkg in { ...raw.dependencies, ...raw.devDependencies }
  } catch {
    return false
  }
}

/** Scripts de conveniencia que `init` ofrece añadir — los mismos comandos que el usuario
 * va a necesitar el día que un selector se rompa. Nada de inventos: los tres son reales. */
export const HEALIFY_SCRIPTS: Array<{ name: string; command: string }> = [
  { name: 'healify', command: 'healify fix' },
  { name: 'healify:dry', command: 'healify fix --dry-run' },
  { name: 'healify:dashboard', command: 'healify dashboard --serve' },
]

/**
 * Añade a package.json los scripts de Healify que falten, sin pisar los que ya existen.
 * Devuelve los nombres añadidos ([] si ya estaban todos o si no hay package.json legible).
 * `dryRun` solo calcula, no escribe. Se reformatea el JSON con indentación estándar de 2
 * espacios — lo mismo que hace `npm pkg set`, aceptado como costo menor.
 */
export function addNpmScripts(cwd: string, dryRun: boolean = false): string[] {
  const pkgPath = join(cwd, 'package.json')
  let pkg: { scripts?: Record<string, string> }
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return []
  }

  const scripts = pkg.scripts ?? {}
  const added: string[] = []
  for (const script of HEALIFY_SCRIPTS) {
    if (typeof scripts[script.name] !== 'string') {
      scripts[script.name] = script.command
      added.push(script.name)
    }
  }

  if (added.length > 0 && !dryRun) {
    pkg.scripts = scripts
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  }
  return added
}

function installPackage(cwd: string, packageManager: ReturnType<typeof detectFramework>['packageManager'], pkg: string): FrameworkInitResult['installed'] {
  if (isInstalled(cwd, pkg)) return 'already-installed'
  try {
    // execSync (no execFileSync): en Windows npm/yarn/pnpm son .cmd, no .exe — llamarlos
    // directo sin shell tira ENOENT, y con .cmd explícito tira EINVAL (Node bloquea
    // ejecutar .cmd/.bat sin shell desde CVE-2024-27980). Confirmado corriendo el
    // binario real, ambos casos. execSync sí resuelve bien porque siempre usa shell.
    // Seguro acá porque packageManager y pkg salen de constantes propias del código
    // (detectPackageManager()/healifyPackageFor()), nunca de input del usuario.
    execSync(installCommand(packageManager, pkg), { cwd, stdio: 'ignore' })
    return 'installed'
  } catch {
    return 'install-failed'
  }
}

function writeScaffoldFiles(cwd: string, files: ScaffoldFile[]): string[] {
  const written: string[] = []
  for (const file of files) {
    const fullPath = join(cwd, file.path)
    if (existsSync(fullPath)) continue
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, file.content, 'utf-8')
    written.push(file.path)
  }
  return written
}

function scaffoldFilesFor(cwd: string, framework: Framework): ScaffoldFile[] {
  const ext = hasTypescript(cwd) ? 'ts' : 'js'
  const baseUrl = detectBaseUrl(cwd)
  if (framework === 'playwright') return scaffoldPlaywright(baseUrl, ext, detectModuleType(cwd))
  if (framework === 'cypress') return scaffoldCypress(baseUrl, ext, detectModuleType(cwd))
  if (framework === 'selenium') return scaffoldSelenium(ext)
  return scaffoldWebdriverio(ext)
}

function wireExistingConfig(framework: 'playwright' | 'cypress', configPath: string): EditStatus {
  const content = readFileSync(configPath, 'utf-8')
  const result = framework === 'playwright' ? wirePlaywrightConfig(content) : wireCypressConfig(content)
  if (result.status === 'edited' && result.content) writeFileSync(configPath, result.content, 'utf-8')
  return result.status
}

function initFramework(cwd: string, framework: Framework, packageManager: ReturnType<typeof detectFramework>['packageManager']): FrameworkInitResult {
  const pkg = healifyPackageFor(framework)
  const installed = installPackage(cwd, packageManager, pkg)
  const shape = { ext: hasTypescript(cwd) ? ('ts' as const) : ('js' as const), moduleType: detectModuleType(cwd) }

  if (framework === 'selenium' || framework === 'webdriverio') {
    const scaffoldedFiles = writeScaffoldFiles(cwd, scaffoldFilesFor(cwd, framework))
    return { framework, package: pkg, installed, config: 'scaffolded', scaffoldedFiles, ...shape }
  }

  const configPath = findConfigForFramework(cwd, framework)
  if (!configPath) {
    // CASO B: el framework está instalado (o recién lo instalamos) pero no tiene archivo
    // de config — bug real encontrado en un proyecto Vite-only (paquetes instalados,
    // config nunca creado). Se scaffoldea completo en vez de solo avisar.
    const scaffoldedFiles = writeScaffoldFiles(cwd, scaffoldFilesFor(cwd, framework))
    return { framework, package: pkg, installed, config: 'scaffolded', scaffoldedFiles, ...shape }
  }

  // CASO C: hay config, se inyecta el marcador de Healify si todavía no está (idempotente).
  return { framework, package: pkg, installed, config: wireExistingConfig(framework, configPath), ...shape }
}

/**
 * Detecta el framework, instala el paquete de Healify que falte y deja el proyecto listo
 * para generar un healify-report.html en la primera corrida — sin editar nada a mano.
 * Tres caminos: CASO A (nada detectado) pregunta qué framework armar desde cero; CASO B
 * (framework instalado sin config) scaffoldea el config + demo; CASO C (config sin
 * Healify) solo inyecta el marcador, ya idempotente desde antes.
 */
export function init(cwd: string = process.cwd(), options: InitOptions = {}): InitReport {
  const { frameworks, evidence, packageManager } = detectFramework(cwd)

  if (options.dryRun) return buildDryRunReport(cwd, frameworks, evidence, packageManager)

  let report: InitReport

  if (frameworks.length === 0) {
    const chooseFramework = options.chooseFramework ?? promptFrameworkChoice
    const chosen = chooseFramework('playwright')
    report = { frameworks: [chosen], results: [initFramework(cwd, chosen, packageManager)], prompted: true }
  } else {
    const results = frameworks.map((framework) => initFramework(cwd, framework, packageManager))
    report = { frameworks, results, prompted: false }
  }

  report.detected = frameworks.map((framework) => ({
    framework,
    evidence: evidence[framework] ?? [],
  }))
  report.scriptsAdded = addNpmScripts(cwd)

  // Chequeo de puerto: solo informativo, no bloquea nada.
  const baseUrl = detectBaseUrl(cwd)
  const portMatch = baseUrl.match(/:(\d+)/)
  if (portMatch) {
    const port = parseInt(portMatch[1], 10)
    const portInUse: boolean | 'unknown' = options.checkPort ? options.checkPort(port) : defaultCheckPort(port)
    if (portInUse === true) {
      report.portWarning = `Algo ya responde en el puerto ${port} — puede ser tu app u otro proceso (ej. Obsidian en 3000). Si tu app no está levantada, acordate de correr npm run dev antes de escribir tests e2e.`
    } else if (portInUse === 'unknown') {
      // No es "puerto libre" — es "no pudimos chequear" (ej. sin PowerShell, entorno no-Windows).
      // Antes esto se reportaba en silencio como si el puerto estuviera libre.
      report.portWarning = `No pudimos verificar si el puerto ${port} está libre en este entorno — si tu app no está levantada, acordate de correr npm run dev antes de escribir tests e2e.`
    }
  }

  return report
}

/** `--dry-run`: planifica sin side effects. Detección real, cero escrituras, cero installs.
 * `results` va vacío a propósito: en seco no hay "resultado" que reportar, solo el plan —
 * el output de dry-run lo imprime desde `plan`, y un results inventado solo mentiría. */
function buildDryRunReport(
  cwd: string,
  frameworks: Framework[],
  evidence: DetectResult['evidence'],
  packageManager: ReturnType<typeof detectFramework>['packageManager'],
): InitReport {
  const plan: DryRunPlan = { install: [], configs: [], scripts: addNpmScripts(cwd, true) }

  for (const framework of frameworks) {
    const pkg = healifyPackageFor(framework)
    if (!isInstalled(cwd, pkg)) plan.install.push(`${pkg} (${installCommand(packageManager, pkg)})`)

    const configPath = framework === 'selenium' || framework === 'webdriverio' ? null : findConfigForFramework(cwd, framework)
    const files = scaffoldFilesFor(cwd, framework)
    const pending = files.filter((f) => !existsSync(join(cwd, f.path))).map((f) => f.path)
    if (configPath) {
      plan.configs.push(`${configPath} (inyectar marcador Healify)`)
    } else if (pending.length > 0) {
      plan.configs.push(...pending.map((p) => `${p} (scaffold nuevo)`))
    }
  }

  return {
    frameworks,
    results: [],
    prompted: false,
    detected: frameworks.map((framework) => ({ framework, evidence: evidence[framework] ?? [] })),
    scriptsAdded: [],
    dryRun: true,
    plan,
  }
}

/** 'unknown' cuando no se pudo determinar (ej. sin PowerShell disponible) — nunca se confunde
 * con "puerto libre" (false), que solo se devuelve cuando PowerShell respondió explícitamente. */
function defaultCheckPort(port: number): boolean | 'unknown' {
  try {
    const out = execSync(
      `powershell -Command "Test-NetConnection -ComputerName localhost -Port ${port} -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded"`,
      { timeout: 2000, stdio: 'pipe' },
    )
    const result = out.toString().trim()
    if (result === 'True') return true
    if (result === 'False') return false
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

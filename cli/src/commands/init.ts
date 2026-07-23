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
} from '../detect'
import { wirePlaywrightConfig, wireCypressConfig, type EditStatus } from '../config-edit'
import { scaffoldPlaywright, scaffoldCypress, scaffoldSelenium, type ScaffoldFile } from '../scaffold'
import { promptFrameworkChoice } from '../prompt'

export type ConfigOutcome = EditStatus | 'no-config-found' | 'scaffolded'

export interface FrameworkInitResult {
  framework: Framework
  package: string
  installed: 'already-installed' | 'installed' | 'install-failed'
  config: ConfigOutcome
  scaffoldedFiles?: string[]
}

export interface InitReport {
  frameworks: Framework[]
  results: FrameworkInitResult[]
  /** true si no se detectó ningún framework y se eligió uno interactivamente (CASO A). */
  prompted: boolean
}

export interface InitOptions {
  /** Inyectable para tests — evita el prompt real de stdin. */
  chooseFramework?: (defaultFramework: Framework) => Framework
}

function isInstalled(cwd: string, pkg: string): boolean {
  try {
    const raw = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return pkg in { ...raw.dependencies, ...raw.devDependencies }
  } catch {
    return false
  }
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
  return scaffoldSelenium(ext)
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

  if (framework === 'selenium') {
    const scaffoldedFiles = writeScaffoldFiles(cwd, scaffoldFilesFor(cwd, framework))
    return { framework, package: pkg, installed, config: 'scaffolded', scaffoldedFiles }
  }

  const configPath = findConfigForFramework(cwd, framework)
  if (!configPath) {
    // CASO B: el framework está instalado (o recién lo instalamos) pero no tiene archivo
    // de config — bug real encontrado en un proyecto Vite-only (paquetes instalados,
    // config nunca creado). Se scaffoldea completo en vez de solo avisar.
    const scaffoldedFiles = writeScaffoldFiles(cwd, scaffoldFilesFor(cwd, framework))
    return { framework, package: pkg, installed, config: 'scaffolded', scaffoldedFiles }
  }

  // CASO C: hay config, se inyecta el marcador de Healify si todavía no está (idempotente).
  return { framework, package: pkg, installed, config: wireExistingConfig(framework, configPath) }
}

/**
 * Detecta el framework, instala el paquete de Healify que falte y deja el proyecto listo
 * para generar un healify-report.html en la primera corrida — sin editar nada a mano.
 * Tres caminos: CASO A (nada detectado) pregunta qué framework armar desde cero; CASO B
 * (framework instalado sin config) scaffoldea el config + demo; CASO C (config sin
 * Healify) solo inyecta el marcador, ya idempotente desde antes.
 */
export function init(cwd: string = process.cwd(), options: InitOptions = {}): InitReport {
  const { frameworks, packageManager } = detectFramework(cwd)

  if (frameworks.length === 0) {
    const chooseFramework = options.chooseFramework ?? promptFrameworkChoice
    const chosen = chooseFramework('playwright')
    return { frameworks: [chosen], results: [initFramework(cwd, chosen, packageManager)], prompted: true }
  }

  const results = frameworks.map((framework) => initFramework(cwd, framework, packageManager))
  return { frameworks, results, prompted: false }
}

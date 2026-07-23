import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { detectFramework, findConfigForFramework, healifyPackageFor, installCommand, type Framework } from '../detect'
import { wirePlaywrightConfig, wireCypressConfig, type EditStatus } from '../config-edit'

export interface FrameworkInitResult {
  framework: Framework
  package: string
  installed: 'already-installed' | 'installed' | 'install-failed'
  config: EditStatus | 'no-config-found'
}

export interface InitReport {
  frameworks: Framework[]
  results: FrameworkInitResult[]
}

function isInstalled(cwd: string, pkg: string): boolean {
  try {
    const raw = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return pkg in { ...raw.dependencies, ...raw.devDependencies }
  } catch {
    return false
  }
}

function wireConfig(framework: Framework, configPath: string | null): EditStatus | 'no-config-found' {
  if (framework === 'selenium' || !configPath) return 'no-config-found'

  const content = readFileSync(configPath, 'utf-8')
  const result = framework === 'playwright' ? wirePlaywrightConfig(content) : wireCypressConfig(content)
  if (result.status === 'edited' && result.content) writeFileSync(configPath, result.content, 'utf-8')
  return result.status
}

/**
 * Detecta el framework, instala el paquete de Healify que falte y edita el config.
 * Idempotente: si ya está instalado o el config ya tiene el marcador, no repite el trabajo.
 * Selenium no tiene config que editar (no es un archivo, es código de test) — queda
 * 'no-config-found' a propósito, init.ts imprime el snippet manual para ese caso.
 */
export function init(cwd: string = process.cwd()): InitReport {
  const { frameworks, packageManager } = detectFramework(cwd)
  const results: FrameworkInitResult[] = []

  for (const framework of frameworks) {
    const pkg = healifyPackageFor(framework)
    let installed: FrameworkInitResult['installed']

    if (isInstalled(cwd, pkg)) {
      installed = 'already-installed'
    } else {
      try {
        // execSync (no execFileSync): en Windows npm/yarn/pnpm son .cmd, no .exe — llamarlos
        // directo sin shell tira ENOENT, y con .cmd explícito tira EINVAL (Node bloquea
        // ejecutar .cmd/.bat sin shell desde CVE-2024-27980). Confirmado corriendo el
        // binario real, ambos casos. execSync sí resuelve bien porque siempre usa shell.
        // Seguro acá porque packageManager y pkg salen de constantes propias del código
        // (detectPackageManager()/healifyPackageFor()), nunca de input del usuario.
        execSync(installCommand(packageManager, pkg), { cwd, stdio: 'ignore' })
        installed = 'installed'
      } catch {
        installed = 'install-failed'
      }
    }

    const configPath = findConfigForFramework(cwd, framework)
    results.push({ framework, package: pkg, installed, config: wireConfig(framework, configPath) })
  }

  return { frameworks, results }
}

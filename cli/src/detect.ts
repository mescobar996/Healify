import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Framework = 'playwright' | 'cypress' | 'selenium' | 'webdriverio'
export type PackageManager = 'npm' | 'yarn' | 'pnpm'
export type ModuleType = 'esm' | 'cjs'

export interface DetectResult {
  frameworks: Framework[]
  /** Config del primer framework detectado que tiene archivo de config (Playwright/Cypress). null si no hay ninguno, o si es solo Selenium (no tiene convención de config). */
  configPath: string | null
  packageManager: PackageManager
}

const CONFIG_CANDIDATES: Record<'playwright' | 'cypress' | 'webdriverio', string[]> = {
  playwright: ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs'],
  cypress: ['cypress.config.ts', 'cypress.config.js', 'cypress.config.mjs', 'cypress.config.cjs'],
  webdriverio: ['wdio.conf.ts', 'wdio.conf.js', 'wdio.conf.mjs', 'wdio.conf.cjs'],
}

function findConfig(cwd: string, framework: 'playwright' | 'cypress' | 'webdriverio'): string | null {
  for (const name of CONFIG_CANDIDATES[framework]) {
    const path = join(cwd, name)
    if (existsSync(path)) return path
  }
  return null
}

function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

function readDependencies(cwd: string): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return { ...pkg.dependencies, ...pkg.devDependencies }
  } catch {
    return {}
  }
}

/** Detecta qué framework(s) de test usa el proyecto: por dependencia en package.json o por archivo de config presente. */
export function detectFramework(cwd: string = process.cwd()): DetectResult {
  const deps = readDependencies(cwd)
  const frameworks: Framework[] = []

  if ('@playwright/test' in deps || findConfig(cwd, 'playwright')) frameworks.push('playwright')
  if ('cypress' in deps || findConfig(cwd, 'cypress')) frameworks.push('cypress')
  if ('selenium-webdriver' in deps) frameworks.push('selenium')
  if ('webdriverio' in deps || findConfig(cwd, 'webdriverio')) frameworks.push('webdriverio')

  const configPath =
    (frameworks.includes('playwright') ? findConfig(cwd, 'playwright') : null) ??
    (frameworks.includes('cypress') ? findConfig(cwd, 'cypress') : null)

  return { frameworks, configPath, packageManager: detectPackageManager(cwd) }
}

/** Config de un framework puntual — usado cuando hay más de un framework detectado y el configPath único de detectFramework() no alcanza. Selenium y WebdriverIO no tienen convención de config editada por Healify: Selenium wirea a mano, WebdriverIO tiene wdio.conf. */
export function findConfigForFramework(cwd: string, framework: Framework): string | null {
  if (framework === 'playwright') return findConfig(cwd, 'playwright')
  if (framework === 'cypress') return findConfig(cwd, 'cypress')
  if (framework === 'webdriverio') return findConfig(cwd, 'webdriverio')
  return null
}

const HEALIFY_PACKAGE: Record<Framework, string> = {
  playwright: '@healify/test-runner',
  cypress: '@healify/cypress-plugin',
  selenium: '@healify/selenium-plugin',
  webdriverio: '@healify/webdriverio-plugin',
}

/** Qué paquete de Healify corresponde a cada framework. */
export function healifyPackageFor(framework: Framework): string {
  return HEALIFY_PACKAGE[framework]
}

const INSTALL_ARGS: Record<PackageManager, string[]> = {
  npm: ['install', '--save-dev'],
  yarn: ['add', '--dev'],
  pnpm: ['add', '--save-dev'],
}

/** Comando de instalación (sin correrlo) para el package manager detectado — usado por init y por los mensajes de doctor. */
export function installCommand(packageManager: PackageManager, pkg: string): string {
  return `${packageManager} ${INSTALL_ARGS[packageManager].join(' ')} ${pkg}`
}

/** Hay tsconfig.json -> el proyecto es TypeScript, el scaffold usa .ts. Si no, .js. */
export function hasTypescript(cwd: string): boolean {
  return existsSync(join(cwd, 'tsconfig.json'))
}

/** package.json "type": "module" -> el scaffold .js usa import/export. Si no, require/module.exports. */
export function detectModuleType(cwd: string): ModuleType {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return pkg.type === 'module' ? 'esm' : 'cjs'
  } catch {
    return 'cjs'
  }
}

const VITE_CONFIG_CANDIDATES = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']
const NEXT_CONFIG_CANDIDATES = ['next.config.ts', 'next.config.js', 'next.config.mjs']

function findFirst(cwd: string, candidates: string[]): string | null {
  for (const name of candidates) {
    const path = join(cwd, name)
    if (existsSync(path)) return path
  }
  return null
}

/**
 * baseURL para el config de e2e que se scaffoldea. El puerto real casi siempre se define
 * en el script "dev" de package.json (ej. `vite --port=3000`), no dentro de vite.config —
 * confirmado auditando un proyecto Vite real donde vite.config.ts no menciona el puerto
 * para nada. Por eso se chequea el script antes que el archivo de config. Si no hay pista
 * de ningún lado: 5173 (default de Vite) si hay vite.config, si no 3000 (default de Next),
 * si no hay ninguno de los dos, 5173 como default genérico.
 */
export function detectBaseUrl(cwd: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    const devScript: string = pkg.scripts?.dev ?? ''
    const portMatch = devScript.match(/--port[= ](\d+)/)
    if (portMatch) return `http://localhost:${portMatch[1]}`
  } catch {
    // sin package.json legible -> seguir con los defaults por archivo de config
  }

  const viteConfig = findFirst(cwd, VITE_CONFIG_CANDIDATES)
  if (viteConfig) {
    const content = readFileSync(viteConfig, 'utf-8')
    const portMatch = content.match(/port:\s*(\d+)/)
    return `http://localhost:${portMatch ? portMatch[1] : '5173'}`
  }

  if (findFirst(cwd, NEXT_CONFIG_CANDIDATES)) return 'http://localhost:3000'

  return 'http://localhost:5173'
}

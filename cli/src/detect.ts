import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Framework = 'playwright' | 'cypress' | 'selenium'
export type PackageManager = 'npm' | 'yarn' | 'pnpm'

export interface DetectResult {
  frameworks: Framework[]
  /** Config del primer framework detectado que tiene archivo de config (Playwright/Cypress). null si no hay ninguno, o si es solo Selenium (no tiene convención de config). */
  configPath: string | null
  packageManager: PackageManager
}

const CONFIG_CANDIDATES: Record<'playwright' | 'cypress', string[]> = {
  playwright: ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs'],
  cypress: ['cypress.config.ts', 'cypress.config.js', 'cypress.config.mjs', 'cypress.config.cjs'],
}

function findConfig(cwd: string, framework: 'playwright' | 'cypress'): string | null {
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

  const configPath =
    (frameworks.includes('playwright') ? findConfig(cwd, 'playwright') : null) ??
    (frameworks.includes('cypress') ? findConfig(cwd, 'cypress') : null)

  return { frameworks, configPath, packageManager: detectPackageManager(cwd) }
}

/** Config de un framework puntual — usado cuando hay más de un framework detectado y el configPath único de detectFramework() no alcanza. Selenium no tiene convención de config: siempre null. */
export function findConfigForFramework(cwd: string, framework: Framework): string | null {
  if (framework === 'playwright') return findConfig(cwd, 'playwright')
  if (framework === 'cypress') return findConfig(cwd, 'cypress')
  return null
}

const HEALIFY_PACKAGE: Record<Framework, string> = {
  playwright: '@healify/test-runner',
  cypress: '@healify/cypress-plugin',
  selenium: '@healify/selenium-plugin',
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

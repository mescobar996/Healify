import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectFramework, findConfigForFramework, healifyPackageFor, installCommand, type Framework } from '../detect'
import { PLAYWRIGHT_MARKER, CYPRESS_MARKER } from '../config-edit'

const HEALIFY_PACKAGES = ['@healify/cli', '@healify/test-runner', '@healify/cypress-plugin', '@healify/selenium-plugin', '@healify/webdriverio-plugin']

export interface DoctorCheck {
  label: string
  ok: boolean
  fix?: string
  /** Informativo, no es ni éxito ni falla accionable — se imprime con ℹ️ en vez de ✅/❌. */
  info?: boolean
}

export interface DoctorReport {
  checks: DoctorCheck[]
}

function isPackageInstalled(cwd: string, pkg: string): boolean {
  try {
    const raw = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return pkg in { ...raw.dependencies, ...raw.devDependencies }
  } catch {
    return false
  }
}

function checkFrameworkConfig(cwd: string, framework: Framework): DoctorCheck {
  const configPath = findConfigForFramework(cwd, framework)
  if (!configPath) {
    return {
      label: `Config de ${framework} encontrado`,
      ok: false,
      fix: `No encontramos ${framework}.config.* — corré npx @healify/cli init, o agregá el config a mano.`,
    }
  }

  const content = readFileSync(configPath, 'utf-8')
  const marker = framework === 'playwright' ? PLAYWRIGHT_MARKER : CYPRESS_MARKER
  const wired = content.includes(marker)
  return {
    label: `${configPath} tiene Healify configurado`,
    ok: wired,
    fix: wired ? undefined : 'npx @healify/cli init',
  }
}

function checkSemverCaret(cwd: string, pkgManager: string): DoctorCheck[] {
  const checks: DoctorCheck[] = []
  let raw: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  try {
    raw = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
  } catch {
    return checks
  }
  const allDeps = { ...raw.dependencies, ...raw.devDependencies }

  for (const pkg of HEALIFY_PACKAGES) {
    const range = allDeps[pkg]
    if (!range) continue

    // Solo nos importa caret (^) en versiones 0.x — es el gotcha real.
    const caretMatch = range.match(/^\^0\.(\d+)\.\d+$/)
    if (!caretMatch) continue

    const declaredMinor = caretMatch[1]
    const installedPath = join(cwd, 'node_modules', pkg, 'package.json')
    if (!existsSync(installedPath)) continue

    let installedVersion: string
    try {
      installedVersion = JSON.parse(readFileSync(installedPath, 'utf-8')).version
    } catch {
      continue
    }

    // Si la versión instalada tiene el mismo minor que la declarada, el caret lo encerró.
    const installedMatch = installedVersion.match(/^0\.(\d+)\./)
    if (installedMatch && installedMatch[1] === declaredMinor) {
      checks.push({
        label: `Semver caret gotcha en ${pkg}`,
        ok: true,
        info: true,
        fix: `Tenés ${range} declarado — un npm install sin versión no te va a subir de minor. Usá ${pkg}@latest para tener la última.`,
      })
    }
  }

  return checks
}

/** Detecta el framework y verifica instalación, config y reporte generado. No modifica nada. */
export function doctor(cwd: string = process.cwd()): DoctorReport {
  const { frameworks, packageManager } = detectFramework(cwd)
  const checks: DoctorCheck[] = []

  if (frameworks.length === 0) {
    checks.push({
      label: 'Framework de test detectado',
      ok: false,
      fix: 'npx @healify/cli init — te pregunta qué framework armar (Playwright, Cypress o Selenium) y scaffoldea todo desde cero.',
    })
    return { checks }
  }

  checks.push({ label: `Framework detectado: ${frameworks.join(', ')}`, ok: true })

  for (const framework of frameworks) {
    const pkg = healifyPackageFor(framework)
    const installed = isPackageInstalled(cwd, pkg)
    checks.push({
      label: `${pkg} instalado`,
      ok: installed,
      fix: installed ? undefined : installCommand(packageManager, pkg),
    })

    // Selenium y WebdriverIO curan en vivo (wrap del driver/browser) — no tienen config que wirear como Playwright/Cypress.
    if (framework === 'selenium' || framework === 'webdriverio') continue

    checks.push(checkFrameworkConfig(cwd, framework))
  }

  // Selenium y WebdriverIO curan en vivo y no tienen hook de "fin de corrida" — nunca
  // generan healify-report.json. Si esos son los únicos frameworks, pedirlo sería un check que
  // jamás puede pasar. Si conviven con Playwright/Cypress, esos sí generan reporte y el
  // check sigue siendo válido.
  const generatesReport = frameworks.some((f) => f !== 'selenium' && f !== 'webdriverio')
  if (generatesReport) {
    const hasReport = existsSync(join(cwd, 'healify-report.json'))
    checks.push({
      label: 'healify-report.json existe',
      ok: hasReport,
      fix: hasReport ? undefined : 'Corré tus tests al menos una vez con algún selector roto para generar el reporte.',
    })
  } else {
    checks.push({ label: 'Selenium/WebdriverIO curan en vivo, no generan reporte', ok: true, info: true })
  }

  checks.push(...checkSemverCaret(cwd, packageManager))

  return { checks }
}

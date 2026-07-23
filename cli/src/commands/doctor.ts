import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectFramework, findConfigForFramework, healifyPackageFor, installCommand, type Framework } from '../detect'
import { PLAYWRIGHT_MARKER, CYPRESS_MARKER } from '../config-edit'

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

    // Selenium no tiene archivo de config — se wirea a mano en el código de test, no hay nada que revisar acá.
    if (framework === 'selenium') continue

    checks.push(checkFrameworkConfig(cwd, framework))
  }

  // Selenium cura en vivo (wrap del WebDriver) y no tiene hook de "fin de corrida" — nunca
  // genera healify-report.json. Si ese es el único framework, pedirlo sería un check que
  // jamás puede pasar. Si conviven con Playwright/Cypress, esos sí generan reporte y el
  // check sigue siendo válido.
  const generatesReport = frameworks.some((f) => f !== 'selenium')
  if (generatesReport) {
    const hasReport = existsSync(join(cwd, 'healify-report.json'))
    checks.push({
      label: 'healify-report.json existe',
      ok: hasReport,
      fix: hasReport ? undefined : 'Corré tus tests al menos una vez con algún selector roto para generar el reporte.',
    })
  } else {
    checks.push({ label: 'Selenium cura en vivo, no genera reporte', ok: true, info: true })
  }

  return { checks }
}

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectFramework, findConfigForFramework, healifyPackageFor, installCommand, type Framework } from '../detect'
import { PLAYWRIGHT_MARKER, CYPRESS_MARKER } from '../config-edit'

export interface DoctorCheck {
  label: string
  ok: boolean
  fix?: string
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
      fix: `No encontramos ${framework}.config.* — corré npx healify init, o agregá el config a mano.`,
    }
  }

  const content = readFileSync(configPath, 'utf-8')
  const marker = framework === 'playwright' ? PLAYWRIGHT_MARKER : CYPRESS_MARKER
  const wired = content.includes(marker)
  return {
    label: `${configPath} tiene Healify configurado`,
    ok: wired,
    fix: wired ? undefined : 'npx healify init',
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
      fix: 'Instalá Playwright, Cypress o Selenium primero — Healify no tiene qué revisar todavía.',
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

  const hasReport = existsSync(join(cwd, 'healify-report.json'))
  checks.push({
    label: 'healify-report.json existe',
    ok: hasReport,
    fix: hasReport ? undefined : 'Corré tus tests al menos una vez con algún selector roto para generar el reporte.',
  })

  return { checks }
}

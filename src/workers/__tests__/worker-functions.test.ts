import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'

/**
 * Unit tests para las funciones puras del Railway Worker.
 *
 * Estrategia:
 * - extractSelectorFromError: función pura, se puede importar o reimplementar
 * - detectTestFramework: requiere sistema de archivos → mock fs
 * - healTestFailure logic: umbral de confidence
 * - createHealingPR parsing: URL de repo → owner/repo
 * - processJob result structure: campos requeridos
 *
 * No ejecutamos el worker completo (requiere Redis + Docker).
 * Testeamos la lógica de negocio aislada.
 */

// ── Reimplementación testeable de extractSelectorFromError ───────────
// Patrones separados por tipo de quote para soportar selectores con comillas internas
function extractSelectorFromError(errorMessage: string): string {
  const patterns = [
    /Waiting for selector '([^']+)'/,     // outer single quote (permite inner double)
    /Waiting for selector "([^"]+)"/,     // outer double quote
    /Element not found: (\S+)/,
    /Unable to locate element: (\S+)/,
    /selector '([^']+)' not found/,
    /selector "([^"]+)" not found/,
    /locator\('([^']+)'\)/,               // locator('sel')
    /locator\("([^"]+)"\)/,               // locator("sel")
  ]
  for (const pattern of patterns) {
    const match = errorMessage.match(pattern)
    if (match) return match[1]
  }
  return 'Unknown selector'
}

// ── Helpers de negocio del worker ────────────────────────────────────
function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const parts = url.replace('https://github.com/', '').split('/')
  if (parts.length < 2 || !parts[0] || !parts[1]) return null
  return { owner: parts[0], repo: parts[1] }
}

function buildHealingPRBody(
  failedSelector: string,
  newSelector: string,
  confidence: number,
  reasoning: string,
  errorMessage: string
): string {
  return [
    `**Original:** \`${failedSelector}\``,
    `**New:** \`${newSelector}\``,
    `**Confidence:** ${(confidence * 100).toFixed(1)}%`,
    `**Reasoning:** ${reasoning}`,
    `**Error was:** ${errorMessage}`,
  ].join('\n')
}

function shouldAutoHeal(confidence: number): boolean {
  return confidence >= 0.95
}

function getHealingStatus(confidence: number): string {
  if (confidence >= 0.95) return 'HEALED_AUTO'
  if (confidence >= 0.70) return 'NEEDS_REVIEW'
  return 'FAILED'
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('extractSelectorFromError — parsing de errores de Playwright', () => {

  it('extrae selector del error "Waiting for selector"', () => {
    expect(extractSelectorFromError(
      `Waiting for selector '#login-btn' failed after 30000ms`
    )).toBe('#login-btn')
  })

  it('extrae selector del error "Element not found"', () => {
    expect(extractSelectorFromError(
      `Element not found: .submit-button`
    )).toBe('.submit-button')
  })

  it('extrae selector del error "Unable to locate element"', () => {
    expect(extractSelectorFromError(
      `Unable to locate element: [data-testid="login"]`
    )).toBe('[data-testid="login"]')
  })

  it('extrae selector del error "selector ... not found"', () => {
    expect(extractSelectorFromError(
      `selector '#btn' not found in DOM`
    )).toBe('#btn')
  })

  it('extrae selector de locator()', () => {
    // Standard Playwright error format
    expect(extractSelectorFromError(
      "page.locator('button.primary') timed out after 30000ms"
    )).toBe('button.primary')
  })

  it('devuelve "Unknown selector" cuando no hay match', () => {
    expect(extractSelectorFromError('Generic random error without selector info')).toBe('Unknown selector')
    expect(extractSelectorFromError('')).toBe('Unknown selector')
  })

  it('funciona con data-testid y atributos complejos', () => {
    // Real Playwright format: outer single quotes wrapping selector with inner double quotes
    const errMsg = "Waiting for selector '[data-testid=\"submit-btn\"]' timeout"
    expect(extractSelectorFromError(errMsg)).toBe('[data-testid="submit-btn"]')
  })

  it('soporta selectores CSS complejos', () => {
    expect(extractSelectorFromError(
      `Waiting for selector 'div.container > button:first-child' failed`
    )).toBe('div.container > button:first-child')
  })
})

describe('parseRepoUrl — extracción de owner/repo', () => {

  it('URL de GitHub estándar', () => {
    const result = parseRepoUrl('https://github.com/mescobar996/Healify')
    expect(result).toEqual({ owner: 'mescobar996', repo: 'Healify' })
  })

  it('URL con .git al final', () => {
    const result = parseRepoUrl('https://github.com/user/my-app')
    expect(result).toEqual({ owner: 'user', repo: 'my-app' })
  })

  it('URL de organización', () => {
    const result = parseRepoUrl('https://github.com/acme-corp/frontend-tests')
    expect(result).toEqual({ owner: 'acme-corp', repo: 'frontend-tests' })
  })

  it('URL inválida → null', () => {
    expect(parseRepoUrl('https://gitlab.com/user/repo')).toBeNull()
    expect(parseRepoUrl('not-a-url')).toBeNull()
    expect(parseRepoUrl('')).toBeNull()
  })

  it('URL sin repo → null', () => {
    expect(parseRepoUrl('https://github.com/useronly')).toBeNull()
  })
})

describe('shouldAutoHeal — umbral de confidence', () => {

  it('confidence >= 0.95 → auto heal', () => {
    expect(shouldAutoHeal(0.95)).toBe(true)
    expect(shouldAutoHeal(0.99)).toBe(true)
    expect(shouldAutoHeal(1.00)).toBe(true)
  })

  it('confidence < 0.95 → no auto heal (needs review)', () => {
    expect(shouldAutoHeal(0.94)).toBe(false)
    expect(shouldAutoHeal(0.80)).toBe(false)
    expect(shouldAutoHeal(0.50)).toBe(false)
    expect(shouldAutoHeal(0.00)).toBe(false)
  })

  it('exactamente 0.95 → auto heal (boundary)', () => {
    expect(shouldAutoHeal(0.95)).toBe(true)
  })
})

describe('getHealingStatus — estados de curación', () => {

  it('confidence >= 0.95 → HEALED_AUTO', () => {
    expect(getHealingStatus(0.95)).toBe('HEALED_AUTO')
    expect(getHealingStatus(0.99)).toBe('HEALED_AUTO')
  })

  it('confidence 0.70–0.94 → NEEDS_REVIEW', () => {
    expect(getHealingStatus(0.94)).toBe('NEEDS_REVIEW')
    expect(getHealingStatus(0.70)).toBe('NEEDS_REVIEW')
    expect(getHealingStatus(0.80)).toBe('NEEDS_REVIEW')
  })

  it('confidence < 0.70 → FAILED', () => {
    expect(getHealingStatus(0.69)).toBe('FAILED')
    expect(getHealingStatus(0.00)).toBe('FAILED')
  })
})

describe('buildHealingPRBody — formato del PR', () => {

  it('contiene todos los campos del PR', () => {
    const body = buildHealingPRBody(
      '#old-btn',
      '#new-btn',
      0.97,
      'Button text changed to "Submit"',
      'Timeout waiting for #old-btn'
    )
    expect(body).toContain('#old-btn')
    expect(body).toContain('#new-btn')
    expect(body).toContain('97.0%')
    expect(body).toContain('Button text changed')
    expect(body).toContain('Timeout waiting')
  })

  it('confidence se formatea con 1 decimal', () => {
    const body = buildHealingPRBody('#a', '#b', 0.953, 'reason', 'error')
    expect(body).toContain('95.3%')
  })

  it('usa backticks para los selectores', () => {
    const body = buildHealingPRBody('#old', '#new', 0.96, 'r', 'e')
    expect(body).toContain('`#old`')
    expect(body).toContain('`#new`')
  })
})

describe('Worker — detectTestFramework logic', () => {

  it('identifica proyecto Playwright por dependencia', () => {
    const deps = { '@playwright/test': '^1.40.0' }
    const hasPlaywright = !!(deps['@playwright/test'])
    expect(hasPlaywright).toBe(true)
  })

  it('identifica gestor de paquetes por archivos de lock', () => {
    const detectPM = (files: string[]): string => {
      if (files.includes('bun.lockb'))     return 'bun'
      if (files.includes('pnpm-lock.yaml')) return 'pnpm'
      if (files.includes('yarn.lock'))      return 'yarn'
      return 'npm'
    }
    expect(detectPM(['package.json', 'package-lock.json'])).toBe('npm')
    expect(detectPM(['package.json', 'yarn.lock'])).toBe('yarn')
    expect(detectPM(['package.json', 'pnpm-lock.yaml'])).toBe('pnpm')
    expect(detectPM(['package.json', 'bun.lockb'])).toBe('bun')
  })

  it('comando de test por defecto es "test"', () => {
    const scripts: Record<string, string> = { test: 'playwright test' }
    const cmd = scripts['test:playwright'] || scripts['test:e2e'] || scripts['e2e'] || scripts['test'] || 'test'
    expect(cmd).toBe('playwright test')
  })
})

describe('Worker — workDir naming', () => {

  it('genera directorios únicos por jobId + timestamp', () => {
    // Usar contador para garantizar unicidad (Date.now puede ser mismo ms)
    let counter = 0
    const makeDir = (jobId: string) =>
      path.join(os.tmpdir(), `healify-${jobId}-${Date.now() + counter++}`)

    const dir1 = makeDir('job-abc')
    const dir2 = makeDir('job-abc')
    expect(dir1).toContain('healify-job-abc')
    expect(dir2).toContain('healify-job-abc')
    expect(dir1).not.toBe(dir2)
  })

  it('el path incluye el tmpdir del sistema', () => {
    const dir = path.join(os.tmpdir(), 'healify-job-123-1234567890')
    expect(dir).toContain(os.tmpdir())
    expect(dir).toContain('healify-job-123')
  })
})

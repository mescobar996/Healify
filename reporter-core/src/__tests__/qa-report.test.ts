import { describe, it, expect } from 'vitest'
import { buildDefectId, severityFor, formatDuration, environmentRows, normalizeRun, renderLocalReportMarkdown } from '../qa-report'
import type { LocalCaseResult } from '../local-mode'
import type { LocalRun } from '../local-report'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'login > entra con credenciales válidas',
    testFile: 'e2e/login.spec.ts',
    selector: '#login-btn',
    errorMessage: "Waiting for selector '#login-btn' failed\n  at login.spec.ts:12",
    status: 'review',
    fixedSelector: "[data-testid='login-btn']",
    confidence: 0.85,
    explanation: 'El id parece estable pero conviene un testid.',
    selectorType: 'ID',
    defectId: buildDefectId('e2e/login.spec.ts', '#login-btn'),
    severity: 'major',
    expected: 'El selector #login-btn encuentra un elemento en la página.',
    actual: "Waiting for selector '#login-btn' failed",
    ...overrides,
  }
}

function makeRun(overrides: Partial<LocalRun> = {}): LocalRun {
  return {
    project: 'Proyecto de prueba',
    framework: 'Playwright',
    generatedAt: new Date('2026-03-15T10:30:00Z'),
    cases: [makeCase()],
    verdict: 'failed',
    stats: { total: 10, passed: 9, failed: 1, healed: 0, review: 1, unresolved: 0, durationMs: 12_500 },
    environment: { os: 'win32', osVersion: '10.0.26200', node: 'v22.0.0', framework: 'Playwright', frameworkVersion: '1.58.0', browser: 'chromium', baseURL: 'http://localhost:3000' },
    ...overrides,
  }
}

describe('buildDefectId', () => {
  it('devuelve el mismo ID para el mismo archivo y selector', () => {
    expect(buildDefectId('e2e/login.spec.ts', '#btn')).toBe(buildDefectId('e2e/login.spec.ts', '#btn'))
  })

  it('cambia si cambia el selector', () => {
    expect(buildDefectId('e2e/login.spec.ts', '#btn')).not.toBe(buildDefectId('e2e/login.spec.ts', '#otro'))
  })

  it('cambia si cambia el archivo — el mismo selector en dos specs son dos defectos distintos', () => {
    expect(buildDefectId('e2e/a.spec.ts', '#btn')).not.toBe(buildDefectId('e2e/b.spec.ts', '#btn'))
  })

  it('funciona sin archivo (Selenium/WebdriverIO no siempre lo tienen)', () => {
    expect(buildDefectId(undefined, '#btn')).toMatch(/^HLF-[0-9A-F]{6}$/)
  })

  it('tiene formato de ticket', () => {
    expect(buildDefectId('e2e/login.spec.ts', '#btn')).toMatch(/^HLF-[0-9A-F]{6}$/)
  })
})

describe('severityFor', () => {
  it('sin sugerencia es bloqueante', () => {
    expect(severityFor('unresolved')).toBe('blocker')
  })

  it('a revisar es mayor', () => {
    expect(severityFor('review')).toBe('major')
  })

  it('sanado es menor — hay un arreglo listo para aplicar', () => {
    expect(severityFor('healed')).toBe('minor')
  })
})

describe('formatDuration', () => {
  it('devuelve undefined si no hay dato, para que el campo se omita', () => {
    expect(formatDuration(undefined)).toBeUndefined()
  })

  it('milisegundos por debajo del segundo', () => {
    expect(formatDuration(340)).toBe('340 ms')
  })

  it('segundos con un decimal', () => {
    expect(formatDuration(12_500)).toBe('12.5 s')
  })

  it('minutos y segundos por encima del minuto', () => {
    expect(formatDuration(95_000)).toBe('1 min 35 s')
  })
})

describe('normalizeRun', () => {
  it('deriva veredicto, stats y entorno cuando el run no los trae (compatibilidad hacia atrás)', () => {
    const bare: LocalRun = {
      project: 'p',
      framework: 'Playwright',
      generatedAt: new Date(),
      cases: [makeCase({ status: 'healed' })],
    }

    const run = normalizeRun(bare)

    expect(run.verdict).toBe('passed')
    expect(run.stats.healed).toBe(1)
    expect(run.environment.framework).toBe('Playwright')
  })

  it('un caso sin sanar hace que el veredicto derivado sea failed', () => {
    const bare: LocalRun = { project: 'p', framework: 'Cypress', generatedAt: new Date(), cases: [makeCase({ status: 'unresolved' })] }

    expect(normalizeRun(bare).verdict).toBe('failed')
  })

  it('respeta el veredicto explícito del adapter por sobre el derivado', () => {
    // Playwright sabe si la suite falló por algo que no es un selector roto; ese dato manda.
    const run = normalizeRun(makeRun({ cases: [makeCase({ status: 'healed' })], verdict: 'failed' }))

    expect(run.verdict).toBe('failed')
  })
})

describe('environmentRows', () => {
  it('omite las filas que el adapter no pudo determinar', () => {
    const run = makeRun({
      environment: { os: 'linux', node: 'v22.0.0', framework: 'Selenium' },
      stats: { total: 1, passed: 0, failed: 1, healed: 0, review: 1, unresolved: 0 },
    })

    const labels = environmentRows(run).map((r) => r.label)

    expect(labels).toContain('Framework')
    expect(labels).toContain('Sistema')
    expect(labels).not.toContain('Navegador')
    expect(labels).not.toContain('URL base')
    expect(labels).not.toContain('Duración')
  })

  it('incluye navegador y URL base cuando están', () => {
    const rows = environmentRows(makeRun())

    expect(rows).toContainEqual({ label: 'Navegador', value: 'chromium' })
    expect(rows).toContainEqual({ label: 'URL base', value: 'http://localhost:3000' })
  })
})

describe('renderLocalReportMarkdown', () => {
  it('encabeza con el veredicto', () => {
    expect(renderLocalReportMarkdown(makeRun())).toContain('**Resultado: FAIL**')
    expect(renderLocalReportMarkdown(makeRun({ verdict: 'passed', cases: [] }))).toContain('**Resultado: PASS**')
  })

  it('dice explícitamente que no hubo defectos cuando la corrida salió limpia', () => {
    const md = renderLocalReportMarkdown(makeRun({ verdict: 'passed', cases: [] }))

    expect(md).toContain('No se detectaron selectores rotos')
  })

  it('ordena los defectos de más grave a menos grave', () => {
    const md = renderLocalReportMarkdown(
      makeRun({
        cases: [
          makeCase({ status: 'healed', severity: 'minor', selector: '#menor', defectId: 'HLF-MENOR0' }),
          makeCase({ status: 'unresolved', severity: 'blocker', selector: '#grave', defectId: 'HLF-GRAVE0' }),
        ],
      })
    )

    expect(md.indexOf('HLF-GRAVE0')).toBeLessThan(md.indexOf('HLF-MENOR0'))
  })

  it('omite los campos que el adapter no llenó, sin dejar encabezados vacíos', () => {
    const md = renderLocalReportMarkdown(
      makeRun({
        cases: [makeCase({ steps: undefined, attachments: undefined, durationMs: undefined, line: undefined })],
        stats: { total: 10, passed: 9, failed: 1, healed: 0, review: 1, unresolved: 0 },
      })
    )

    expect(md).not.toContain('Pasos para reproducir')
    expect(md).not.toContain('Evidencia')
    expect(md).not.toContain('**Duración:**')
    // El archivo sí aparece; lo que no debe aparecer es un `:línea` colgando sin número.
    expect(md).toContain('`e2e/login.spec.ts`')
  })

  it('lista los pasos y la evidencia cuando el adapter los aportó', () => {
    const md = renderLocalReportMarkdown(
      makeRun({
        cases: [
          makeCase({
            steps: ['page.goto("/login")', 'page.click("#login-btn")'],
            attachments: [{ name: 'screenshot', path: 'test-results/login/failed.png', contentType: 'image/png' }],
          }),
        ],
      })
    )

    expect(md).toContain('1. page.goto("/login")')
    expect(md).toContain('[screenshot](test-results/login/failed.png)')
  })

  it('no promete un arreglo cuando no hay candidato', () => {
    const md = renderLocalReportMarkdown(makeRun({ cases: [makeCase({ status: 'unresolved', severity: 'blocker' })] }))

    expect(md).toContain('sin candidato confiable')
  })

  it('aclara que la sugerencia sale del texto del selector, no de la página real', () => {
    expect(renderLocalReportMarkdown(makeRun())).toContain('no la página real')
  })

  it('mantiene el formato del entregable estable (snapshot)', () => {
    expect(renderLocalReportMarkdown(makeRun())).toMatchSnapshot()
  })
})

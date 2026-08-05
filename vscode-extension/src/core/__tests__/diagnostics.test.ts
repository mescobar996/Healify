import { describe, it, expect } from 'vitest'
import { analyzeDocument } from '../diagnostics'
import type { ReportCase } from '../report'

const SOURCE = `await page.click('#buy-btn-a1b2c3')`

function reportCase(overrides: Partial<ReportCase> = {}): ReportCase {
  return {
    selector: '#buy-btn-a1b2c3',
    status: 'healed',
    fixedSelector: "role('button', { name: 'Agregar al carrito' })",
    confidence: 0.97,
    verified: true,
    ...overrides,
  }
}

/**
 * La propiedad que define la extensión entera. Si estos tests se ponen en verde con un fix
 * adjunto donde no corresponde, la extensión pasa a ofrecer adivinanzas dentro del editor,
 * que es peor que no ofrecer nada: un Ctrl+. las aplica sin que nadie las lea.
 */
describe('un fix solo puede venir de algo verificado contra la página', () => {
  it('adjunta el fix cuando el reporte lo verificó', () => {
    const [finding] = analyzeDocument(SOURCE, { reportCases: [reportCase()] })

    expect(finding.level).toBe('error')
    expect(finding.fix).toBe("role('button', { name: 'Agregar al carrito' })")
  })

  it('NO adjunta fix cuando verified es false, aunque haya fixedSelector', () => {
    const [finding] = analyzeDocument(SOURCE, {
      reportCases: [reportCase({ verified: false })],
    })

    expect(finding.level).toBe('error')
    expect(finding.fix).toBeUndefined()
  })

  it('NO adjunta fix cuando verified viene ausente', () => {
    const [finding] = analyzeDocument(SOURCE, {
      reportCases: [reportCase({ verified: undefined })],
    })

    expect(finding.fix).toBeUndefined()
  })

  it('NO adjunta fix cuando el reporte no trae reemplazo', () => {
    const [finding] = analyzeDocument(SOURCE, {
      reportCases: [reportCase({ fixedSelector: '' })],
    })

    expect(finding.fix).toBeUndefined()
  })

  /**
   * El caso más importante de todos: sin reporte, el motor IGUAL propone algo
   * (`role('button', { name: 'Submit' })` para un id cualquiera), pero ese nombre no salió de
   * ninguna página. El lint nunca puede adjuntarlo.
   */
  it('el lint en vivo nunca adjunta un fix, por más que el motor proponga uno', () => {
    const findings = analyzeDocument(SOURCE, { reportCases: [], liveLint: true })

    expect(findings).toHaveLength(1)
    expect(findings[0].level).toBe('warning')
    expect(findings[0].fix).toBeUndefined()
  })
})

describe('analyzeDocument', () => {
  it('marca un id autogenerado con nivel warning y explica por qué', () => {
    const [finding] = analyzeDocument(SOURCE, { liveLint: true })

    expect(finding.level).toBe('warning')
    expect(finding.message.length).toBeGreaterThan(0)
    expect(finding.selector).toBe('#buy-btn-a1b2c3')
  })

  it('no marca un data-testid: es lo que Healify recomienda usar', () => {
    const stable = `await page.click('[data-testid="buy"]')`
    expect(analyzeDocument(stable, { liveLint: true })).toEqual([])
  })

  it('no marca cuando el motor no propone nada distinto', () => {
    const accesible = `await page.click('[aria-label="Cerrar"]')`
    expect(analyzeDocument(accesible, { liveLint: true })).toEqual([])
  })

  it('marca un XPath posicional', () => {
    const [finding] = analyzeDocument(`await page.click('//div[3]/button')`, { liveLint: true })
    expect(finding.level).toBe('warning')
    expect(finding.selector).toBe('//div[3]/button')
  })

  it('con liveLint apagado solo quedan los del reporte', () => {
    expect(analyzeDocument(SOURCE, { liveLint: false })).toEqual([])

    const conReporte = analyzeDocument(SOURCE, { liveLint: false, reportCases: [reportCase()] })
    expect(conReporte).toHaveLength(1)
    expect(conReporte[0].level).toBe('error')
  })

  it('el reporte gana sobre el lint para el mismo selector: un solo finding, no dos', () => {
    const findings = analyzeDocument(SOURCE, { reportCases: [reportCase()], liveLint: true })

    expect(findings).toHaveLength(1)
    expect(findings[0].level).toBe('error')
  })

  it('marca las dos ocurrencias de un selector que se rompió', () => {
    const source = `page.click('#buy-btn-a1b2c3'); page.click('#buy-btn-a1b2c3')`
    const findings = analyzeDocument(source, { reportCases: [reportCase()] })

    expect(findings).toHaveLength(2)
    expect(findings.every((f) => f.fix)).toBe(true)
    expect(findings[0].start).not.toBe(findings[1].start)
  })

  it('ignora los casos del reporte que quedaron sin resolver', () => {
    const findings = analyzeDocument(SOURCE, {
      reportCases: [reportCase({ status: 'unresolved', verified: false, fixedSelector: '' })],
      liveLint: false,
    })

    expect(findings).toEqual([])
  })

  it('las posiciones apuntan al selector dentro del archivo', () => {
    const [finding] = analyzeDocument(SOURCE, { reportCases: [reportCase()] })
    expect(SOURCE.slice(finding.start, finding.end)).toBe('#buy-btn-a1b2c3')
  })
})

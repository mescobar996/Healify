import { describe, it, expect } from 'vitest'
import { renderLocalReportHtml, renderLocalReportJson, type LocalRun } from '../local-report'
import type { LocalCaseResult } from '../local-mode'

const sampleCase: LocalCaseResult = {
  testName: 'agrega producto al carrito',
  testFile: 'e2e/checkout.spec.ts',
  selector: '#add-to-cart-btn',
  errorMessage: "Waiting for selector '#add-to-cart-btn' failed",
  status: 'healed',
  fixedSelector: "[data-testid='add-to-cart']",
  confidence: 0.97,
  explanation: 'Coincidencia por testid',
  selectorType: 'TESTID',
}

const run: LocalRun = {
  project: 'tienda-demo',
  framework: 'Playwright',
  generatedAt: new Date('2026-07-21T12:00:00Z'),
  cases: [sampleCase],
}

describe('renderLocalReportHtml', () => {
  it('produces a self-contained document with no external requests', () => {
    const html = renderLocalReportHtml(run)
    expect(html).toContain('<!doctype html>')
    expect(html).not.toContain('http://')
    expect(html).not.toContain('googleapis')
  })

  it('escapes case data so it never breaks the surrounding markup', () => {
    const malicious: LocalCaseResult = { ...sampleCase, testName: '<script>alert(1)</script>' }
    const html = renderLocalReportHtml({ ...run, cases: [malicious] })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('includes the project name and case counts', () => {
    const html = renderLocalReportHtml(run)
    expect(html).toContain('tienda-demo')
    expect(html).toContain('Sanado')
  })
})

describe('renderLocalReportJson', () => {
  it('produces valid JSON with a summary and the raw cases', () => {
    const parsed = JSON.parse(renderLocalReportJson(run))
    expect(parsed.summary.total).toBe(1)
    expect(parsed.summary.healed).toBe(1)
    expect(parsed.cases[0].selector).toBe('#add-to-cart-btn')
  })
})

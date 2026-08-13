import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { LocalRun, LocalCaseResult, HistoryEntry } from '@healify/reporter-core'
import { appendHistory } from '../history'
import { emptyHealStats, writeHealStats, type HealStats } from '../commands/heal'
import {
  buildSelectorSummaries,
  buildSelectorDetail,
  buildStatsOverview,
  computeEfficacyReport,
  resolveUiDir,
  createDashboardApp,
  selectorId,
} from '../commands/dashboard-serve'
import type { Server } from 'node:http'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: 'e2e/login.spec.ts',
    selector: '#old',
    errorMessage: 'error',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    confidence: 0.95,
    explanation: '',
    selectorType: 'TESTID',
    cause: 'selector',
    defectId: 'HLF-TEST01',
    severity: 'major',
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[]): LocalRun {
  return { project: 'test', framework: 'Playwright', generatedAt: new Date(), cases }
}

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-01-01T10:00:00.000Z',
    testFile: 'e2e/login.spec.ts',
    testName: 'un test',
    selector: '#old',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    selectorType: 'TESTID',
    confidence: 0.95,
    ...overrides,
  }
}

function sampleStats(): HealStats {
  return {
    totalAnalyzed: 10,
    healed: 7,
    failed: 3,
    byType: { role: 4, testid: 3, css: 3 },
    totalHealingMs: 2480,
    avgHealingMs: 248,
  }
}

describe('dashboard-serve: lógica pura', () => {
  it('selectorId es sha256 determinista de testFile+selector', () => {
    const a = selectorId({ testFile: 'a.spec.ts', selector: '#x' })
    const b = selectorId({ testFile: 'a.spec.ts', selector: '#x' })
    const c = selectorId({ testFile: 'a.spec.ts', selector: '#y' })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('buildSelectorSummaries agrupa por archivo+selector y ordena por roturas', () => {
    const entries: HistoryEntry[] = [
      makeEntry({ selector: '#a', status: 'healed', fixedSelector: '[data-testid="a1"]' }),
      makeEntry({ selector: '#a', status: 'healed', fixedSelector: '[data-testid="a2"]' }),
      makeEntry({ selector: '#b', status: 'unresolved', fixedSelector: '' }),
    ]
    const summaries = buildSelectorSummaries(entries)
    expect(summaries).toHaveLength(2)
    expect(summaries[0].selector).toBe('#a')
    expect(summaries[0].failCount).toBe(2)
    expect(summaries[0].lastSuggestion).toBe('[data-testid="a2"]')
    expect(summaries[0].chronic).toBe(false)
    expect(summaries[1].failCount).toBe(1)
  })

  it('buildSelectorDetail devuelve undefined para id inexistente y el detalle para uno válido', () => {
    const entries: HistoryEntry[] = [makeEntry({ selector: '#a' })]
    const id = selectorId({ testFile: 'e2e/login.spec.ts', selector: '#a' })
    expect(buildSelectorDetail(entries, 'no-existe')).toBeUndefined()
    const detail = buildSelectorDetail(entries, id)
    expect(detail).toBeDefined()
    expect(detail?.suggestions).toHaveLength(1)
    expect(detail?.timeline.length).toBeGreaterThanOrEqual(1)
  })

  it('buildStatsOverview combina stats.json con el resumen del histórico', () => {
    const entries: HistoryEntry[] = [
      makeEntry({ selector: '#a', status: 'healed' }),
      makeEntry({ selector: '#b', status: 'review', fixedSelector: '' }),
      makeEntry({ selector: '#c', status: 'unresolved', fixedSelector: '' }),
    ]
    const overview = buildStatsOverview(sampleStats(), entries)
    expect(overview.totalAnalyzed).toBe(10)
    expect(overview.healed).toBe(7)
    expect(overview.healRate).toBeCloseTo(0.7)
    expect(overview.history.total).toBe(3)
    expect(overview.history.healed).toBe(1)
    expect(overview.history.timeline.length).toBeGreaterThanOrEqual(1)
    // Sin confirmaciones, la eficacia no miente: rate null y todo sin confirmar.
    expect(overview.efficacy).toEqual({ accepted: 0, rejected: 0, unconfirmed: 3, rate: null })
  })

  it('buildStatsOverview calcula la eficacia solo sobre las entradas confirmadas', () => {
    const entries: HistoryEntry[] = [
      makeEntry({ selector: '#a', status: 'healed' }),
      { ...makeEntry({ selector: '#b', status: 'healed' }), accepted: true },
      { ...makeEntry({ selector: '#c', status: 'healed' }), accepted: true },
      { ...makeEntry({ selector: '#d', status: 'healed' }), accepted: false },
    ]
    const overview = buildStatsOverview(sampleStats(), entries)
    expect(overview.efficacy.accepted).toBe(2)
    expect(overview.efficacy.rejected).toBe(1)
    expect(overview.efficacy.unconfirmed).toBe(1)
    expect(overview.efficacy.rate).toBeCloseTo(2 / 3)
  })

  describe('computeEfficacyReport', () => {
    function day(daysAgo: number): string {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - daysAgo)
      d.setUTCHours(12, 0, 0, 0)
      return d.toISOString()
    }

    it('totals: aceptados vs rechazados con rate sobre los confirmados (US1)', () => {
      const entries: HistoryEntry[] = [
        { ...makeEntry({ selector: '#a' }), accepted: true },
        { ...makeEntry({ selector: '#b' }), accepted: true },
        { ...makeEntry({ selector: '#c' }), accepted: true },
        { ...makeEntry({ selector: '#d' }), accepted: false },
        makeEntry({ selector: '#e' }),
      ]
      const report = computeEfficacyReport(entries)
      expect(report.totals).toEqual({ accepted: 3, rejected: 1, pending: 1, rate: 0.75 })
    })

    it('rate es null sin confirmaciones (0/0 no es un número)', () => {
      const report = computeEfficacyReport([makeEntry({ selector: '#a' }), makeEntry({ selector: '#b' })])
      expect(report.totals.rate).toBeNull()
      expect(report.totals.pending).toBe(2)
    })

    it('byFramework: agrupa por framework y entradas viejas caen en unknown (US2)', () => {
      const entries: HistoryEntry[] = [
        { ...makeEntry({ selector: '#a' }), accepted: true, framework: 'Playwright' },
        { ...makeEntry({ selector: '#b' }), accepted: true, framework: 'Playwright' },
        { ...makeEntry({ selector: '#c' }), accepted: false, framework: 'Playwright' },
        { ...makeEntry({ selector: '#d' }), accepted: true, framework: 'Cypress' },
        { ...makeEntry({ selector: '#e' }), accepted: false, framework: 'Cypress' },
        { ...makeEntry({ selector: '#f' }), accepted: true },
      ]
      const report = computeEfficacyReport(entries)
      expect(report.byFramework['playwright']).toEqual({ accepted: 2, rejected: 1, pending: 0, rate: 2 / 3 })
      expect(report.byFramework['cypress']).toEqual({ accepted: 1, rejected: 1, pending: 0, rate: 0.5 })
      expect(report.byFramework['unknown']).toEqual({ accepted: 1, rejected: 0, pending: 0, rate: 1 })
      // El total global no cambia por el desglose: 4 aceptados + 2 rechazados.
      expect(report.totals).toEqual({ accepted: 4, rejected: 2, pending: 0, rate: 4 / 6 })
    })

    it('trend: cubre la ventana pedida con días vacíos en 0 y filtra futuros (US3)', () => {
      const entries: HistoryEntry[] = [
        { ...makeEntry({ selector: '#a', timestamp: day(1) }), accepted: true },
        { ...makeEntry({ selector: '#b', timestamp: day(2) }), accepted: false },
        { ...makeEntry({ selector: '#c', timestamp: day(20) }), accepted: true },
        { ...makeEntry({ selector: '#futuro', timestamp: new Date(Date.now() + 86400000).toISOString() }), accepted: true },
      ]
      const report7 = computeEfficacyReport(entries, 7)
      expect(report7.trend).toHaveLength(7)
      const acceptedTotal = report7.trend.reduce((sum, p) => sum + p.accepted, 0)
      const rejectedTotal = report7.trend.reduce((sum, p) => sum + p.rejected, 0)
      // El de hace 20 días y el futuro quedan fuera de la ventana de 7.
      expect(acceptedTotal).toBe(1)
      expect(rejectedTotal).toBe(1)

      const report30 = computeEfficacyReport(entries, 30)
      expect(report30.trend).toHaveLength(30)
      const accepted30 = report30.trend.reduce((sum, p) => sum + p.accepted, 0)
      expect(accepted30).toBe(2) // el de 20 días entra; el futuro no
      // Los totales globales nunca se ven afectados por la ventana.
      expect(report7.totals.accepted).toBe(3)
      expect(report30.totals.accepted).toBe(3)
    })

    it('trend ignora timestamps corruptos sin romper el resto', () => {
      const entries: HistoryEntry[] = [
        { ...makeEntry({ selector: '#a', timestamp: 'no-es-fecha' }), accepted: true },
        { ...makeEntry({ selector: '#b', timestamp: day(1) }), accepted: true },
      ]
      const report = computeEfficacyReport(entries, 7)
      const acceptedTotal = report.trend.reduce((sum, p) => sum + p.accepted, 0)
      expect(acceptedTotal).toBe(1)
      expect(report.totals.accepted).toBe(2)
    })

    it('byCause: desglosa con etiquetas de FAILURE_CAUSE_LABEL y unknown para ausentes (US3)', () => {
      const entries: HistoryEntry[] = [
        { ...makeEntry({ selector: '#a' }), accepted: true, cause: 'selector' },
        { ...makeEntry({ selector: '#b' }), accepted: false, cause: 'selector' },
        { ...makeEntry({ selector: '#c' }), accepted: true, cause: 'assertion' },
        { ...makeEntry({ selector: '#d' }), accepted: true },
      ]
      const report = computeEfficacyReport(entries)
      expect(report.byCause['Selector roto']).toEqual({ accepted: 1, rejected: 1, total: 2 })
      expect(report.byCause['Aserción']).toEqual({ accepted: 1, rejected: 0, total: 1 })
      expect(report.byCause['Indeterminada']).toEqual({ accepted: 1, rejected: 0, total: 1 })
      // El desglose suma exactamente el total general.
      const sum = Object.values(report.byCause).reduce((acc, c) => acc + c.total, 0)
      expect(sum).toBe(report.totals.accepted + report.totals.rejected + report.totals.pending)
    })
  })

  it('resolveUiDir devuelve null sin UI y detecta dashboard-web/dist', () => {
    expect(resolveUiDir(tmpdir())).toBeNull()

    const dir = mkdtempSync(join(tmpdir(), 'healify-ui-'))
    try {
      mkdirSync(join(dir, 'dashboard-web', 'dist'), { recursive: true })
      writeFileSync(join(dir, 'dashboard-web', 'dist', 'index.html'), '<html></html>')
      expect(resolveUiDir(dir)).toBe(join(dir, 'dashboard-web', 'dist'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('dashboard-serve: API HTTP', () => {
  let dir: string
  let server: Server
  let base: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'healify-dashboard-api-'))
    appendHistory(
      makeRun([
        makeCase({ selector: '#a', status: 'healed', fixedSelector: '[data-testid="a1"]', confidence: 0.9 }),
        makeCase({ selector: '#a', status: 'unresolved' }),
        makeCase({ selector: '#b', status: 'review' }),
      ]),
      dir
    )
    const statsPath = join(dir, 'stats.json')
    writeHealStats(sampleStats(), statsPath)

    const app = createDashboardApp({ cwd: dir, statsPath, uiDir: null })
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve())
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(dir, { recursive: true, force: true })
  })

  it('GET /api/stats devuelve el vistazo general', async () => {
    const res = await fetch(`${base}/api/stats`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalAnalyzed).toBe(10)
    expect(body.history.total).toBe(3)
    expect(body.history.timeline.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/stats incluye efficacyReport con totales del historial real (contrato)', async () => {
    const res = await fetch(`${base}/api/stats`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.efficacyReport.totals).toEqual({ accepted: 0, rejected: 0, pending: 3, rate: null })
    expect(body.efficacyReport.trend).toHaveLength(30)
    // Las 3 entradas del fixture tienen cause 'selector'.
    expect(body.efficacyReport.byCause['Selector roto'].total).toBe(3)
  })

  it('GET /api/stats respeta ?efficacy-window=7 y rechaza valores raros con default', async () => {
    const res7 = await fetch(`${base}/api/stats?efficacy-window=7`)
    const body7 = await res7.json()
    expect(body7.efficacyReport.trend).toHaveLength(7)

    const resRaro = await fetch(`${base}/api/stats?efficacy-window=99`)
    const bodyRaro = await resRaro.json()
    expect(bodyRaro.efficacyReport.trend).toHaveLength(30)
  })

  it('GET /api/selectors devuelve la lista agregada', async () => {
    const res = await fetch(`${base}/api/selectors`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].failCount).toBe(2)
  })

  it('GET /api/selectors/:id devuelve el detalle y 404 para el resto', async () => {
    const list = await (await fetch(`${base}/api/selectors`)).json()
    const id = list[0].id as string

    const ok = await fetch(`${base}/api/selectors/${id}`)
    expect(ok.status).toBe(200)
    const detail = await ok.json()
    expect(detail.selector).toBe('#a')
    expect(detail.suggestions).toHaveLength(2)

    const missing = await fetch(`${base}/api/selectors/${'0'.repeat(64)}`)
    expect(missing.status).toBe(404)
  })

  it('la UI se sirve desde uiDir y el fallback sin UI muestra links a la API', async () => {
    const fallback = await fetch(`${base}/`)
    expect(fallback.status).toBe(200)
    expect(await fallback.text()).toContain('/api/stats')

    const uiDir = mkdtempSync(join(tmpdir(), 'healify-ui-serve-'))
    try {
      writeFileSync(join(uiDir, 'index.html'), '<html><body>UI REAL</body></html>')
      const app2 = createDashboardApp({ cwd: dir, uiDir })
      const server2 = await new Promise<Server>((resolve) => {
        const s = app2.listen(0, '127.0.0.1', () => resolve(s))
      })
      const base2 = `http://127.0.0.1:${(server2.address() as AddressInfo).port}`
      try {
        const res = await fetch(`${base2}/`)
        expect(res.status).toBe(200)
        expect(await res.text()).toContain('UI REAL')
      } finally {
        await new Promise<void>((r) => server2.close(() => r()))
      }
    } finally {
      rmSync(uiDir, { recursive: true, force: true })
    }
  })

  it('emptyHealStats sirve un overview vacío (no rompe)', () => {
    const overview = buildStatsOverview(emptyHealStats(), [])
    expect(overview.totalAnalyzed).toBe(0)
    expect(overview.healRate).toBe(0)
    expect(overview.history.total).toBe(0)
  })
})
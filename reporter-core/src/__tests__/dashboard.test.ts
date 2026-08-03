import { describe, it, expect } from 'vitest'
import { buildDashboardStats, renderDashboardHtml, computeTopRecurrent, computeRebroken, type DashboardStats } from '../dashboard'
import type { HistoryEntry } from '../repertoire'

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-07-01T00:00:00.000Z',
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

describe('funciones movidas desde cli (ubicación canónica)', () => {
  it('computeTopRecurrent cuenta y ordena', () => {
    const entries = [
      makeEntry({ selector: '#a' }),
      makeEntry({ selector: '#b' }),
      makeEntry({ selector: '#a' }),
      makeEntry({ selector: '#a' }),
    ]
    expect(computeTopRecurrent(entries)).toEqual([
      { selector: '#a', count: 3 },
      { selector: '#b', count: 1 },
    ])
  })

  it('computeRebroken marca re-rotos (primera aparición healed y volvió roto)', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]
    expect(computeRebroken(entries)).toEqual([{ selector: '#a', count: 2, firstHealedAt: '2026-07-01T00:00:00.000Z' }])
  })
})

describe('buildDashboardStats', () => {
  it('cuenta por estado, calcula healedRate y first/last seen', () => {
    const stats = buildDashboardStats([
      makeEntry({ status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ status: 'healed', timestamp: '2026-07-02T00:00:00.000Z' }),
      makeEntry({ status: 'review', timestamp: '2026-07-03T00:00:00.000Z' }),
      makeEntry({ status: 'unresolved', timestamp: '2026-07-04T00:00:00.000Z' }),
    ])

    expect(stats.total).toBe(4)
    expect(stats.healed).toBe(2)
    expect(stats.review).toBe(1)
    expect(stats.unresolved).toBe(1)
    expect(stats.healedRate).toBeCloseTo(0.5, 5)
    expect(stats.firstSeen).toBe('2026-07-01T00:00:00.000Z')
    expect(stats.lastSeen).toBe('2026-07-04T00:00:00.000Z')
  })

  it('agrupa la timeline por día (UTC) con conteos por estado, en orden ascendente', () => {
    const stats = buildDashboardStats([
      makeEntry({ status: 'healed', timestamp: '2026-07-01T10:00:00.000Z' }),
      makeEntry({ status: 'review', timestamp: '2026-07-01T15:00:00.000Z' }),
      makeEntry({ status: 'unresolved', timestamp: '2026-07-02T09:00:00.000Z' }),
    ])

    expect(stats.timeline).toEqual([
      { date: '2026-07-01', healed: 1, review: 1, unresolved: 0 },
      { date: '2026-07-02', healed: 0, review: 0, unresolved: 1 },
    ])
  })

  it('entries vacíos: total 0, healedRate 0, timeline vacía, first/last null — no revienta', () => {
    const stats = buildDashboardStats([])
    expect(stats.total).toBe(0)
    expect(stats.healedRate).toBe(0)
    expect(stats.timeline).toEqual([])
    expect(stats.firstSeen).toBeNull()
    expect(stats.lastSeen).toBeNull()
    expect(stats.topRecurrent).toEqual([])
    expect(stats.rebroken).toEqual([])
  })

  it('timeline ignora timestamps que no parsean (línea corrupta) sin reventar', () => {
    const stats = buildDashboardStats([
      makeEntry({ status: 'healed', timestamp: 'no-es-una-fecha' }),
      makeEntry({ status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
    ])

    expect(stats.total).toBe(2)
    expect(stats.timeline).toEqual([{ date: '2026-07-01', healed: 1, review: 0, unresolved: 0 }])
  })
})

describe('renderDashboardHtml', () => {
  function sampleStats(): DashboardStats {
    return buildDashboardStats([
      makeEntry({ status: 'healed', timestamp: '2026-07-01T00:00:00.000Z', selector: '#a' }),
      makeEntry({ status: 'healed', timestamp: '2026-07-01T12:00:00.000Z', selector: '#a' }),
      makeEntry({ status: 'review', timestamp: '2026-07-02T00:00:00.000Z', selector: '#b' }),
    ])
  }

  it('incluye el título y las cifras de las tarjetas', () => {
    const html = renderDashboardHtml(sampleStats())
    expect(html).toContain('Healify')
    expect(html).toContain('Dashboard')
    expect(html).toContain('3') // total
    expect(html).toContain('2') // healed
  })

  it('incluye timeline, recurrentes y re-rotos', () => {
    const html = renderDashboardHtml(sampleStats())
    expect(html).toContain('2026-07-01')
    expect(html).toContain('#a')
    expect(html).toContain('#b')
  })

  it('escapa selectores del historial (nunca HTML crudo)', () => {
    const stats = buildDashboardStats([makeEntry({ selector: '<img src=x onerror=alert(1)>' })])
    const html = renderDashboardHtml(stats)
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('incluye el toggle dark/light y prefiere la variante del sistema', () => {
    const html = renderDashboardHtml(sampleStats())
    expect(html).toContain('prefers-color-scheme')
    expect(html).toContain('data-theme')
  })

  it('dashboard vacío se renderiza igual (sin crashear)', () => {
    const html = renderDashboardHtml(buildDashboardStats([]))
    expect(html).toContain('Dashboard')
  })
})

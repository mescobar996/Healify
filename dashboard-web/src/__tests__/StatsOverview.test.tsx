import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { StatsOverview } from '../dashboard/StatsOverview'
import { api } from '../api'
import type { StatsOverview as StatsOverviewType } from '../types'

vi.mock('../api', () => ({ api: { stats: vi.fn(), selectors: vi.fn(), selector: vi.fn() } }))

const fixture: StatsOverviewType = {
  totalAnalyzed: 12,
  healed: 9,
  failed: 3,
  byType: { role: 6, testid: 3, css: 3 },
  avgHealingMs: 248,
  totalHealingMs: 2976,
  healRate: 0.75,
  history: {
    total: 5,
    healed: 4,
    review: 1,
    unresolved: 0,
    healedRate: 0.8,
    firstSeen: '2026-01-02T10:00:00.000Z',
    lastSeen: '2026-01-04T10:00:00.000Z',
    timeline: [
      { date: '2026-01-02', healed: 2, review: 1, unresolved: 0 },
      { date: '2026-01-04', healed: 2, review: 0, unresolved: 0 },
    ],
  },
}

describe('StatsOverview', () => {
  it('muestra las tarjetas de stats.json', async () => {
    vi.mocked(api.stats).mockResolvedValue(fixture)
    render(
      <MemoryRouter>
        <StatsOverview />
      </MemoryRouter>
    )

    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText('Analizados')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('248ms')).toBeInTheDocument()
  })

  it('grafica la timeline del histórico', async () => {
    vi.mocked(api.stats).mockResolvedValue(fixture)
    render(
      <MemoryRouter>
        <StatsOverview />
      </MemoryRouter>
    )

    await screen.findByText('12')
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
  })

  it('muestra un estado vacío si no hay error ni datos aún', async () => {
    vi.mocked(api.stats).mockImplementation(
      () =>
        new Promise((_resolve) => {
          // nunca resuelve: el componente debe quedar en "Cargando…"
        })
    )
    render(
      <MemoryRouter>
        <StatsOverview />
      </MemoryRouter>
    )
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })
})
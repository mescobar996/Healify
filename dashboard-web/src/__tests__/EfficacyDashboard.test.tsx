import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EfficacyDashboard } from '../dashboard/EfficacyDashboard'
import { api } from '../api'
import type { StatsOverview } from '../types'

vi.mock('../api', () => ({ api: { stats: vi.fn() } }))

const fixture: StatsOverview = {
  totalAnalyzed: 12,
  healed: 9,
  failed: 3,
  byType: { role: 6 },
  avgHealingMs: 248,
  totalHealingMs: 2976,
  healRate: 0.75,
  efficacy: { accepted: 3, rejected: 2, unconfirmed: 1, rate: 0.6 },
  efficacyReport: {
    totals: { accepted: 3, rejected: 2, pending: 1, rate: 0.6 },
    byFramework: {
      playwright: { accepted: 3, rejected: 1, pending: 0, rate: 0.75 },
      unknown: { accepted: 0, rejected: 1, pending: 1, rate: 0 },
    },
    trend: [
      { date: '2026-01-01', accepted: 1, rejected: 0 },
      { date: '2026-01-02', accepted: 2, rejected: 2 },
    ],
    byCause: {
      'Selector roto': { accepted: 2, rejected: 1, total: 3 },
      Indeterminada: { accepted: 1, rejected: 1, total: 2 },
    },
  },
  history: {
    total: 5,
    healed: 4,
    review: 1,
    unresolved: 0,
    healedRate: 0.8,
    firstSeen: '2026-01-01T10:00:00.000Z',
    lastSeen: '2026-01-02T10:00:00.000Z',
    timeline: [],
  },
}

describe('EfficacyDashboard', () => {
  it('muestra la tasa global y los gráficos con datos reales', async () => {
    vi.mocked(api.stats).mockResolvedValue(fixture)
    render(<EfficacyDashboard />)

    expect(await screen.findByText('60%')).toBeInTheDocument()
    expect(screen.getByText('Aceptación vs rechazo')).toBeInTheDocument()
    expect(screen.getByTestId('efficacy-donut')).toBeInTheDocument()
    expect(screen.getByTestId('efficacy-frameworks')).toBeInTheDocument()
    expect(screen.getByTestId('efficacy-trend')).toBeInTheDocument()
    expect(screen.getByTestId('efficacy-causes')).toBeInTheDocument()
    // El stub de react-chartjs-2 serializa los datos como texto del nodo.
    expect(screen.getByText(/Playwright/)).toBeInTheDocument()
    expect(screen.getByText(/Selector roto/)).toBeInTheDocument()
  })

  it('el toggle de ventana re-consulta con 7 días', async () => {
    vi.mocked(api.stats).mockResolvedValue(fixture)
    render(<EfficacyDashboard />)
    await screen.findByText('60%')

    await userEvent.click(screen.getByRole('button', { name: '7 días' }))
    expect(vi.mocked(api.stats)).toHaveBeenLastCalledWith(7)
    expect(screen.getByRole('button', { name: '7 días' })).toHaveClass('active')
  })

  it('muestra estado vacío sin entradas (ceros, sin errores)', async () => {
    vi.mocked(api.stats).mockResolvedValue({
      ...fixture,
      efficacyReport: {
        totals: { accepted: 0, rejected: 0, pending: 0, rate: null },
        byFramework: {},
        trend: [],
        byCause: {},
      },
    })
    render(<EfficacyDashboard />)

    expect(await screen.findByText('—')).toBeInTheDocument()
    expect(screen.getByText(/Sin entradas todavía/)).toBeInTheDocument()
    expect(screen.getByText(/Sin datos por framework/)).toBeInTheDocument()
  })

  it('muestra estado de error si la API falla', async () => {
    vi.mocked(api.stats).mockRejectedValue(new Error('boom'))
    render(<EfficacyDashboard />)

    expect(await screen.findByText(/No se pudieron cargar los datos de eficacia/)).toBeInTheDocument()
  })
})

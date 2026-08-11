import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SelectorDetail } from '../dashboard/SelectorDetail'
import { api } from '../api'
import type { SelectorDetail as SelectorDetailType } from '../types'

vi.mock('../api', () => ({ api: { stats: vi.fn(), selectors: vi.fn(), selector: vi.fn() } }))

const fixture: SelectorDetailType = {
  id: 'a',
  selector: '#old-login-btn',
  testFile: 'e2e/login.spec.ts',
  type: 'css',
  failCount: 2,
  lastSuggestion: '[data-testid="login"]',
  lastHealed: '2026-01-03T10:00:00.000Z',
  firstSeen: '2026-01-01T10:00:00.000Z',
  lastSeen: '2026-01-03T10:00:00.000Z',
  chronic: false,
  suggestions: [
    {
      timestamp: '2026-01-03T10:00:00.000Z',
      testFile: 'e2e/login.spec.ts',
      testName: 'login ok',
      status: 'healed',
      fixedSelector: '[data-testid="login"]',
      confidence: 0.92,
      verified: true,
      cause: 'selector',
    },
    {
      timestamp: '2026-01-01T10:00:00.000Z',
      testFile: 'e2e/login.spec.ts',
      testName: 'login ok',
      status: 'unresolved',
      fixedSelector: null,
      confidence: null,
      verified: null,
      cause: 'timeout',
    },
  ],
  timeline: [
    { date: '2026-01-01', healed: 0, review: 0, unresolved: 1 },
    { date: '2026-01-03', healed: 1, review: 0, unresolved: 0 },
  ],
}

describe('SelectorDetail', () => {
  it('muestra el selector, su última sugerencia y el historial', async () => {
    vi.mocked(api.selector).mockResolvedValue(fixture)
    render(
      <MemoryRouter initialEntries={['/selectors/a']}>
        <Routes>
          <Route path="/selectors/:id" element={<SelectorDetail />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('#old-login-btn')).toBeInTheDocument()
    expect(screen.getAllByText('[data-testid="login"]').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('Curado')).toBeInTheDocument()
    expect(screen.getByText('Sin resolver')).toBeInTheDocument()
  })

  it('grafica la tendencia del selector', async () => {
    vi.mocked(api.selector).mockResolvedValue(fixture)
    render(
      <MemoryRouter initialEntries={['/selectors/a']}>
        <Routes>
          <Route path="/selectors/:id" element={<SelectorDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText('#old-login-btn')
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
  })

  it('avisa si el selector no existe', async () => {
    vi.mocked(api.selector).mockRejectedValue(new Error('GET /api/selectors/x → 404'))
    render(
      <MemoryRouter initialEntries={['/selectors/x']}>
        <Routes>
          <Route path="/selectors/:id" element={<SelectorDetail />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText(/No se pudo cargar el selector/)).toBeInTheDocument()
  })
})
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ChronicSelectors } from '../dashboard/ChronicSelectors'
import { api } from '../api'
import type { SelectorSummary } from '../types'

vi.mock('../api', () => ({ api: { stats: vi.fn(), selectors: vi.fn(), selector: vi.fn() } }))

const fixture: SelectorSummary[] = [
  {
    id: 'a',
    selector: '#old-login-btn',
    testFile: 'e2e/login.spec.ts',
    type: 'css',
    failCount: 5,
    lastSuggestion: '[data-testid="login"]',
    lastHealed: '2026-01-03T10:00:00.000Z',
    firstSeen: '2026-01-01T10:00:00.000Z',
    lastSeen: '2026-01-04T10:00:00.000Z',
    chronic: true,
  },
  {
    id: 'b',
    selector: '[data-testid="cart"]',
    testFile: 'e2e/cart.spec.ts',
    type: 'testid',
    failCount: 1,
    lastSuggestion: null,
    lastHealed: null,
    firstSeen: '2026-01-04T10:00:00.000Z',
    lastSeen: '2026-01-04T10:00:00.000Z',
    chronic: false,
  },
]

describe('ChronicSelectors', () => {
  it('solo muestra los selectores con 3+ roturas', async () => {
    vi.mocked(api.selectors).mockResolvedValue(fixture)
    render(
      <MemoryRouter>
        <ChronicSelectors />
      </MemoryRouter>
    )

    expect(await screen.findByText('#old-login-btn')).toBeInTheDocument()
    expect(screen.queryByText('[data-testid="cart"]')).not.toBeInTheDocument()
    expect(screen.getByText('5 roturas')).toBeInTheDocument()
  })

  it('muestra un estado vacío cuando no hay crónicos', async () => {
    vi.mocked(api.selectors).mockResolvedValue([fixture[1]])
    render(
      <MemoryRouter>
        <ChronicSelectors />
      </MemoryRouter>
    )

    expect(await screen.findByText('😌 No hay selectores crónicos todavía. Que siga así.')).toBeInTheDocument()
  })
})
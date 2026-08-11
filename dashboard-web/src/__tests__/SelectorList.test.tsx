import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SelectorList } from '../dashboard/SelectorList'
import { api } from '../api'
import type { SelectorSummary } from '../types'

vi.mock('../api', () => ({ api: { stats: vi.fn(), selectors: vi.fn(), selector: vi.fn() } }))

const fixture: SelectorSummary[] = [
  {
    id: 'a',
    selector: '#old-login-btn',
    testFile: 'e2e/login.spec.ts',
    type: 'css',
    failCount: 4,
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

describe('SelectorList', () => {
  it('lista los selectores con su conteo de roturas', async () => {
    vi.mocked(api.selectors).mockResolvedValue(fixture)
    render(
      <MemoryRouter>
        <SelectorList />
      </MemoryRouter>
    )

    expect(await screen.findByText('#old-login-btn')).toBeInTheDocument()
    expect(screen.getByText('[data-testid="cart"]')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('marca los selectores crónicos', async () => {
    vi.mocked(api.selectors).mockResolvedValue(fixture)
    render(
      <MemoryRouter>
        <SelectorList />
      </MemoryRouter>
    )

    await screen.findByText('#old-login-btn')
    const pill = screen.getByText('css')
    expect(pill).toHaveClass('pill-chronic')
  })

  it('filtra por texto del selector', async () => {
    vi.mocked(api.selectors).mockResolvedValue(fixture)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SelectorList />
      </MemoryRouter>
    )

    await user.type(await screen.findByPlaceholderText('Filtrar por selector o archivo…'), 'cart')
    expect(screen.queryByText('#old-login-btn')).not.toBeInTheDocument()
    expect(screen.getByText('[data-testid="cart"]')).toBeInTheDocument()
  })
})
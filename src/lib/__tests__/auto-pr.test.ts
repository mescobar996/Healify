import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindUnique = vi.fn()
const mockDb = {
  healingEvent: { findUnique: mockFindUnique, update: vi.fn() },
  account: { findFirst: vi.fn() },
  notification: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ db: mockDb }))

const mockCreateSmartPR = vi.fn()
const mockCreateHealifyCheckRun = vi.fn()
vi.mock('@/lib/github/checks', () => ({
  createSmartPR: mockCreateSmartPR,
  createHealifyCheckRun: mockCreateHealifyCheckRun,
}))

global.fetch = vi.fn()

const { tryOpenAutoPR } = await import('@/lib/github/auto-pr')

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_1',
    confidence: 0.97,
    newSelector: '[data-testid="submit-btn"]',
    newSelectorType: 'TESTID',
    selectorType: 'CSS',
    failedSelector: '#old-btn',
    testName: 'Login test',
    testFile: 'tests/login.spec.ts',
    reasoning: 'because',
    oldDomSnapshot: null,
    newDomSnapshot: null,
    testRun: {
      project: {
        repository: 'https://github.com/acme/app',
        userId: 'user_1',
        autoHealThreshold: 0.85,
      },
    },
    ...overrides,
  }
}

describe('tryOpenAutoPR — gate integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bloquea (no llama createSmartPR) cuando el selector propuesto es frágil, aunque la confidence sea alta', async () => {
    mockFindUnique.mockResolvedValue(makeEvent({
      confidence: 0.99,
      newSelector: 'div:nth-child(3)',
      newSelectorType: 'CSS',
    }))

    const result = await tryOpenAutoPR('evt_1')

    expect(result.opened).toBe(false)
    expect(result.reason).toContain('gate:fragile_selector')
    expect(mockCreateSmartPR).not.toHaveBeenCalled()
  })

  it('bloquea cuando la confidence no alcanza el autoHealThreshold configurado del proyecto', async () => {
    mockFindUnique.mockResolvedValue(makeEvent({
      confidence: 0.90,
      testRun: {
        project: { repository: 'https://github.com/acme/app', userId: 'user_1', autoHealThreshold: 0.95 },
      },
    }))

    const result = await tryOpenAutoPR('evt_1')

    expect(result.opened).toBe(false)
    expect(result.reason).toContain('gate:low_confidence')
    expect(mockCreateSmartPR).not.toHaveBeenCalled()
  })

  it('permite auto-PR cuando confidence, fragilidad y unicidad pasan el gate', async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ confidence: 0.87 }))
    mockDb.account.findFirst.mockResolvedValue({ access_token: 'gh_token' })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ default_branch: 'main' }),
    })
    mockCreateSmartPR.mockResolvedValue({
      prUrl: 'https://github.com/acme/app/pull/1',
      headSha: 'sha123',
      branch: 'healify-fix-1',
    })
    mockCreateHealifyCheckRun.mockResolvedValue('check_1')
    mockDb.healingEvent.update.mockResolvedValue({})
    mockDb.notification.create.mockResolvedValue({})

    const result = await tryOpenAutoPR('evt_1')

    expect(result.opened).toBe(true)
    expect(result.prUrl).toBe('https://github.com/acme/app/pull/1')
    expect(mockCreateSmartPR).toHaveBeenCalledOnce()
  })
})

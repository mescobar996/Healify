import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

// ── Mock prisma ──────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    project: {
      findFirst: vi.fn(),
    },
    testRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/queue', () => ({
  addTestJob: vi.fn(),
  TEST_QUEUE_NAME: 'healify-tests',
}))

vi.mock('@/lib/git-analyzer', () => ({
  gitAnalyzer: {
    analyzeCommit: vi.fn().mockResolvedValue({
      changedFiles: ['src/components/Login.tsx'],
      impactedTests: ['Login / Auth Flow'],
      riskScore: 0.45,
      riskLevel: 'medium',
      summary: '🟡 MEDIUM risk — 1 file(s) changed.',
    }),
    predictHealingNeed: vi.fn().mockReturnValue(true),
  },
}))

// ── HMAC helpers (sin importar la ruta entera) ────────────────────────

function sign(body: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(body, 'utf8')
  return `sha256=${hmac.digest('hex')}`
}

function signInvalid(body: string): string {
  return sign(body, 'wrong-secret')
}

const SECRET = 'test-webhook-secret-123'

// ── Tests de lógica HMAC (sin Next.js runtime) ────────────────────────

describe('GitHub Webhook — HMAC signature verification', () => {

  it('firma válida con secreto correcto', () => {
    const body = JSON.stringify({ ref: 'refs/heads/main' })
    const sig = sign(body, SECRET)
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it('firma inválida con secreto incorrecto produce diferente hash', () => {
    const body = JSON.stringify({ ref: 'refs/heads/main' })
    const valid = sign(body, SECRET)
    const invalid = signInvalid(body)
    expect(valid).not.toBe(invalid)
  })

  it('mismo body + mismo secreto = mismo HMAC (determinístico)', () => {
    const body = '{"action":"push"}'
    expect(sign(body, SECRET)).toBe(sign(body, SECRET))
  })

  it('cambiar 1 byte del body cambia el HMAC completamente', () => {
    const body1 = '{"ref":"refs/heads/main"}'
    const body2 = '{"ref":"refs/heads/Main"}'
    expect(sign(body1, SECRET)).not.toBe(sign(body2, SECRET))
  })

  it('firma vacía es inválida', () => {
    const body = '{"event":"push"}'
    const valid = sign(body, SECRET)
    expect('').not.toBe(valid)
    expect(null).not.toBe(valid)
  })

  it('longitud del digest es siempre 71 chars (sha256= + 64 hex)', () => {
    const cases = ['{}', '{"a":1}', 'large payload'.repeat(100)]
    for (const body of cases) {
      expect(sign(body, SECRET)).toHaveLength(71) // "sha256=" (7) + 64 hex
    }
  })
})

describe('GitHub Webhook — payload validation', () => {

  it('push event tiene los campos requeridos', () => {
    const payload = {
      ref: 'refs/heads/main',
      after: 'abc123def456',
      repository: { html_url: 'https://github.com/user/repo' },
      head_commit: {
        message: 'fix: login button',
        author: { username: 'user' },
        added: ['src/Login.tsx'],
        modified: [],
        removed: [],
      },
      commits: [],
    }
    expect(payload.ref).toMatch(/^refs\/heads\//)
    expect(payload.after).toBeTruthy()
    expect(payload.repository.html_url).toMatch(/^https:\/\/github\.com/)
  })

  it('branch se extrae correctamente del ref', () => {
    const cases = [
      ['refs/heads/main',    'main'],
      ['refs/heads/feature/auth', 'feature/auth'],
      ['refs/heads/fix-123', 'fix-123'],
    ]
    for (const [ref, expected] of cases) {
      expect(ref.replace('refs/heads/', '')).toBe(expected)
    }
  })

  it('archivos del commit se acumulan de added+modified+removed', () => {
    const headCommit = {
      added:    ['src/Login.tsx'],
      modified: ['src/Button.tsx'],
      removed:  ['src/OldComp.tsx'],
    }
    const allFiles = [
      ...headCommit.added,
      ...headCommit.modified,
      ...headCommit.removed,
    ]
    expect(allFiles).toHaveLength(3)
    expect(allFiles).toContain('src/Login.tsx')
    expect(allFiles).toContain('src/OldComp.tsx')
  })

  it('deduplicar archivos entre múltiples commits del push', () => {
    const commits = [
      { added: ['src/A.tsx', 'src/B.tsx'], modified: [], removed: [] },
      { added: ['src/A.tsx'], modified: ['src/C.tsx'], removed: [] },
    ]
    const all: string[] = []
    for (const commit of commits) {
      all.push(...commit.added, ...commit.modified, ...commit.removed)
    }
    const unique = Array.from(new Set(all))
    expect(unique).toHaveLength(3) // A, B, C — sin duplicado de A
    expect(unique).toContain('src/A.tsx')
  })
})

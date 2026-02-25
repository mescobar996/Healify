import { describe, it, expect } from 'vitest'
import { GitAnalyzer, gitAnalyzer } from '@/lib/git-analyzer'

const analyzer = new GitAnalyzer()

// ══════════════════════════════════════════════════════════════════════
describe('GitAnalyzer — análisis real (sin Math.random)', () => {

  it('sin archivos → riskScore bajo, summary menciona "No file changes"', async () => {
    const r = await analyzer.analyzeCommit('', [])
    expect(r.riskScore).toBeLessThanOrEqual(0.15)
    expect(r.summary).toContain('No file changes')
    expect(r.changedFiles).toHaveLength(0)
    expect(r.riskLevel).toBe('low')
  })

  it('archivo .tsx → riskScore alto (componente React)', async () => {
    const r = await analyzer.analyzeCommit('', ['src/components/LoginForm.tsx'])
    expect(r.riskScore).toBeGreaterThan(0.2)
    expect(r.changedFiles).toContain('src/components/LoginForm.tsx')
  })

  it('archivo README.md → riskScore bajo', async () => {
    const r = await analyzer.analyzeCommit('', ['README.md'])
    expect(r.riskScore).toBeLessThan(0.2)
    expect(r.riskLevel).toBe('low')
  })

  it('múltiples .tsx → riskScore crítico', async () => {
    const files = [
      'src/app/login/page.tsx',
      'src/components/Button.tsx',
      'src/components/Form.tsx',
      'src/app/dashboard/page.tsx',
    ]
    const r = await analyzer.analyzeCommit('', files)
    expect(r.riskScore).toBeGreaterThan(0.5)
    expect(['high', 'critical']).toContain(r.riskLevel)
  })

  it('archivo login → impactedTests incluye "Login / Auth Flow"', async () => {
    const r = await analyzer.analyzeCommit('', ['src/pages/login.tsx'])
    expect(r.impactedTests).toContain('Login / Auth Flow')
  })

  it('archivo checkout → impactedTests incluye "Checkout & Payment"', async () => {
    const r = await analyzer.analyzeCommit('', ['components/CheckoutForm.tsx'])
    expect(r.impactedTests).toContain('Checkout & Payment')
  })

  it('archivo dashboard → impactedTests incluye "Dashboard Metrics"', async () => {
    const r = await analyzer.analyzeCommit('', ['pages/dashboard.tsx'])
    expect(r.impactedTests).toContain('Dashboard Metrics')
  })

  it('archivo desconocido → impactedTests incluye "General Sanity"', async () => {
    const r = await analyzer.analyzeCommit('', ['some/unknown/file.xyz'])
    expect(r.impactedTests).toContain('General Sanity')
  })

  it('resultados son DETERMINÍSTICOS — mismos archivos = mismo resultado', async () => {
    const files = ['src/components/Header.tsx', 'src/styles/main.css']
    const r1 = await analyzer.analyzeCommit('', files)
    const r2 = await analyzer.analyzeCommit('', files)
    expect(r1.riskScore).toBe(r2.riskScore)
    expect(r1.riskLevel).toBe(r2.riskLevel)
    expect(r1.changedFiles).toEqual(r2.changedFiles)
  })

  it('riskScore siempre está entre 0 y 1', async () => {
    const cases = [
      [],
      ['README.md'],
      ['src/components/BigPage.tsx'],
      Array(20).fill('src/components/X.tsx'),
    ]
    for (const files of cases) {
      const r = await analyzer.analyzeCommit('', files)
      expect(r.riskScore).toBeGreaterThanOrEqual(0)
      expect(r.riskScore).toBeLessThanOrEqual(1)
    }
  })

  it('summary siempre es string no vacío', async () => {
    const r = await analyzer.analyzeCommit('', ['any/file.ts'])
    expect(typeof r.summary).toBe('string')
    expect(r.summary.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('GitAnalyzer.predictHealingNeed', () => {
  it('riskScore > 0.4 → true', () => {
    expect(gitAnalyzer.predictHealingNeed({ riskScore: 0.5, changedFiles: [], impactedTests: [], summary: '', riskLevel: 'high' })).toBe(true)
  })

  it('riskScore < 0.4 → false', () => {
    expect(gitAnalyzer.predictHealingNeed({ riskScore: 0.2, changedFiles: [], impactedTests: [], summary: '', riskLevel: 'low' })).toBe(false)
  })

  it('riskScore exacto 0.4 → false (no supera)', () => {
    expect(gitAnalyzer.predictHealingNeed({ riskScore: 0.4, changedFiles: [], impactedTests: [], summary: '', riskLevel: 'medium' })).toBe(false)
  })
})

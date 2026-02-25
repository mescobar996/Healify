// ═══════════════════════════════════════════════════════════════════════
// GIT ANALYZER — Análisis real de commits de GitHub
// Usa los archivos cambiados del payload del webhook para determinar
// riesgo e impacto en tests. Sin Math.random(), sin datos hardcodeados.
// ═══════════════════════════════════════════════════════════════════════

export interface GitImpact {
    changedFiles: string[]
    impactedTests: string[]
    riskScore: number   // 0.0 - 1.0
    summary: string
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

// Patrones de archivos que históricamente rompen selectores de UI
const HIGH_RISK_PATTERNS = [
    /\.(tsx|jsx)$/,           // Componentes React — cambian el DOM
    /components?\//i,          // Carpetas de componentes
    /pages?\//i,               // Páginas
    /app\//i,                  // Next.js app dir
    /styles?\//i,              // CSS puede afectar selectores de clase
    /layout\./i,               // Layouts afectan estructura del DOM
]

const MEDIUM_RISK_PATTERNS = [
    /\.(ts|js)$/,              // Lógica — puede cambiar comportamiento
    /api\//i,                  // Rutas de API
    /hooks?\//i,               // Custom hooks
    /lib\//i,                  // Utilidades
    /utils?\//i,
]

const LOW_RISK_PATTERNS = [
    /\.(md|txt|json|yml|yaml)$/, // Documentación y config
    /\.env/,
    /README/i,
    /CHANGELOG/i,
    /\.gitignore/,
    /package-lock\.json/,
]

// Inferir nombres de tests afectados a partir de los archivos cambiados
function inferImpactedTests(files: string[]): string[] {
    const tests = new Set<string>()

    for (const file of files) {
        const lower = file.toLowerCase()

        if (lower.includes('login') || lower.includes('auth') || lower.includes('signin'))
            tests.add('Login / Auth Flow')

        if (lower.includes('checkout') || lower.includes('payment') || lower.includes('stripe'))
            tests.add('Checkout & Payment')

        if (lower.includes('product') || lower.includes('catalog') || lower.includes('search'))
            tests.add('Product Catalog')

        if (lower.includes('dashboard') || lower.includes('metrics') || lower.includes('analytics'))
            tests.add('Dashboard Metrics')

        if (lower.includes('settings') || lower.includes('profile') || lower.includes('account'))
            tests.add('User Settings')

        if (lower.includes('nav') || lower.includes('header') || lower.includes('layout') || lower.includes('footer'))
            tests.add('Navigation & Layout')

        if (lower.includes('form') || lower.includes('input') || lower.includes('button'))
            tests.add('Form Interactions')

        if (lower.includes('api') || lower.includes('route') || lower.includes('endpoint'))
            tests.add('API Integration')

        if (lower.includes('modal') || lower.includes('dialog') || lower.includes('drawer'))
            tests.add('Modal & Overlays')

        if (lower.includes('table') || lower.includes('list') || lower.includes('grid'))
            tests.add('Data Tables & Lists')
    }

    // Si no se mapeó nada específico, agregar sanity general
    if (tests.size === 0) tests.add('General Sanity')

    return Array.from(tests)
}

// Calcular riesgo a partir de los archivos reales
function calculateRiskScore(files: string[]): number {
    if (files.length === 0) return 0.1

    let score = 0

    for (const file of files) {
        if (HIGH_RISK_PATTERNS.some(p => p.test(file))) {
            score += 0.25
        } else if (MEDIUM_RISK_PATTERNS.some(p => p.test(file))) {
            score += 0.12
        } else if (LOW_RISK_PATTERNS.some(p => p.test(file))) {
            score += 0.02
        } else {
            score += 0.08
        }
    }

    // Normalizar: más archivos = más riesgo, pero con techo
    return Math.min(0.98, score)
}

function getRiskLevel(score: number): GitImpact['riskLevel'] {
    if (score >= 0.75) return 'critical'
    if (score >= 0.5)  return 'high'
    if (score >= 0.25) return 'medium'
    return 'low'
}

export class GitAnalyzer {
    /**
     * Analiza los archivos cambiados de un commit real de GitHub.
     * @param _diff  — ignorado (se mantiene por compatibilidad de interfaz)
     * @param files  — lista real de archivos del payload del webhook
     */
    async analyzeCommit(_diff: string, files: string[] = []): Promise<GitImpact> {
        const changedFiles = files.length > 0 ? files : []
        const riskScore    = calculateRiskScore(changedFiles)
        const riskLevel    = getRiskLevel(riskScore)
        const impactedTests = inferImpactedTests(changedFiles)

        const riskEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[riskLevel]

        const summary = changedFiles.length > 0
            ? `${riskEmoji} ${riskLevel.toUpperCase()} risk — ${changedFiles.length} file(s) changed. ` +
              `${impactedTests.length} test area(s) may be affected: ${impactedTests.join(', ')}.`
            : '⚪ No file changes detected in this push.'

        return { changedFiles, impactedTests, riskScore, riskLevel, summary }
    }

    predictHealingNeed(impact: GitImpact): boolean {
        return impact.riskScore > 0.4
    }
}

export const gitAnalyzer = new GitAnalyzer()

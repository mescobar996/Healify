'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Copy, Check, Play, Terminal, FileCode, Webhook } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HealifyLogo } from '@/components/HealifyLogo'

// ============================================
// SNIPPETS TEMPLATES
// ============================================

const snippets = {
  playwright: {
    name: 'Playwright',
    icon: Play,
    install: 'npm install --save-dev @healify/test-runner',
    code: `// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [
    ['list'],
    ['@healify/test-runner/reporter'],
  ],
})

// ─── test file (e.g. auth.spec.ts) ───
import { test, expect } from '@healify/test-runner'

test('should log in', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', 'user@example.com')
  await page.click('#login-btn')
  await expect(page.locator('h1')).toHaveText('Dashboard')
})`,
  },
  cypress: {
    name: 'Cypress',
    icon: Terminal,
    install: 'npm install --save-dev @healify/cypress-plugin',
    code: `// cypress.config.ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return HealifyCypressPlugin(on, config)
    },
  },
})`,
  },
  selenium: {
    name: 'Selenium',
    icon: FileCode,
    install: 'pip install requests',
    code: `import requests

def report_to_healify(test_name, selector, error, html):
    response = requests.post(
        "https://healify-sigma.vercel.app/api/v1/report",
        headers={
            "x-api-key": "YOUR_API_KEY",
            "Content-Type": "application/json",
        },
        json={
            "testName": test_name,
            "selector": selector,
            "error": error,
            "context": html,
            "selectorType": "CSS",
            "branch": "main",
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()`,
  },
}

// ============================================
// CODE HIGHLIGHTER COMPONENT
// ============================================

function CodeBlock({ 
  code, 
  language,
  onCopy 
}: { 
  code: string
  language: string
  onCopy: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      onCopy()
      setTimeout(() => setCopied(false), 2000)
    } catch {
    }
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  // Simple syntax highlighting
  const highlightCode = (code: string) => {
    return escapeHtml(code)
      .replace(/(\/\/.*)/g, '<span class="text-gray-500">$1</span>')
      .replace(/\b(import|from|const|let|var|function|async|await|return|if|else|test|describe|it|def|class|yield)\b/g, '<span class="text-purple-400">$1</span>')
      .replace(/\b(true|false|null|undefined|None)\b/g, '<span class="text-amber-400">$1</span>')
      .replace(/\b(process\.env\.\w+)/g, '<span class="text-cyan-400">$1</span>')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'absolute top-3 right-3 p-2 rounded-lg transition-all duration-300',
          copied 
            ? 'bg-emerald-500/20 text-emerald-400 neon-cyan' 
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
        )}
        aria-label={copied ? 'Código copiado' : `Copiar bloque de código ${language}`}
        title={copied ? 'Código copiado' : 'Copiar código'}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
      
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
        {/* Language Badge */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.02]">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-2 text-xs text-gray-500 font-mono">{language}</span>
        </div>
        
        {/* Code */}
        <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
          <code 
            className="text-gray-300"
            dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
          />
        </pre>
      </div>
    </div>
  )
}

// ============================================
// TAB COMPONENT
// ============================================

function FrameworkTab({ 
  framework, 
  isActive, 
  onClick 
}: { 
  framework: keyof typeof snippets
  isActive: boolean
  onClick: () => void
}) {
  const config = snippets[framework]
  const Icon = config.icon

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={`Seleccionar framework ${config.name}`}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300',
        'glass-elite-hover',
        isActive 
          ? 'bg-cyan-500/10 border-cyan-500/30 neon-cyan' 
          : 'bg-white/[0.02] border-white/5'
      )}
    >
      <Icon className={cn('w-5 h-5', isActive ? 'text-cyan-400' : 'text-gray-400')} />
      <span className={cn('font-medium', isActive ? 'text-white' : 'text-gray-400')}>
        {config.name}
      </span>
    </button>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function ConnectPage() {
  const params = useParams()
  const projectId = params.id as string
  const [activeFramework, setActiveFramework] = useState<keyof typeof snippets>('playwright')
  const [detectedFramework, setDetectedFramework] = useState<keyof typeof snippets | null>(null)
  const [projectRepository, setProjectRepository] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [projectRepositoryStatus, setProjectRepositoryStatus] = useState<'idle' | 'loaded' | 'error'>('idle')
  const [trackedSdkStep, setTrackedSdkStep] = useState(false)

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://healify.dev')
  const webhookUrl = `${appUrl}/api/webhook/github`
  const githubBadgeMarkdown = `[![Healed by Healify](https://img.shields.io/badge/Healed%20by-Healify-7B5EF8?style=for-the-badge)](${appUrl}/dashboard/tests?project=${projectId})`
  const githubBadgeHtml = `<a href=\"${appUrl}/dashboard/tests?project=${projectId}\"><img src=\"https://img.shields.io/badge/Healed%20by-Healify-7B5EF8?style=for-the-badge\" alt=\"Healed by Healify\" /></a>`

  const parseGithubRepo = (repositoryUrl: string) => {
    const normalized = repositoryUrl.trim().replace(/\.git$/, '')
    const match = normalized.match(/github\.com[:/]([^/]+)\/([^/]+)$/i)
    if (!match) return null
    return { owner: match[1], repo: match[2] }
  }

  const detectFrameworkFromPackageJson = (pkg: Record<string, unknown>): keyof typeof snippets => {
    const dependencies = (pkg.dependencies as Record<string, string> | undefined) || {}
    const devDependencies = (pkg.devDependencies as Record<string, string> | undefined) || {}
    const scripts = (pkg.scripts as Record<string, string> | undefined) || {}

    const allDeps = { ...dependencies, ...devDependencies }

    if (allDeps['@playwright/test'] || allDeps['playwright']) return 'playwright'
    if (allDeps['cypress']) return 'cypress'
    if (allDeps['jest'] || allDeps['@jest/core']) return 'selenium'

    const scriptValues = Object.values(scripts).join(' ').toLowerCase()
    if (scriptValues.includes('playwright')) return 'playwright'
    if (scriptValues.includes('cypress')) return 'cypress'
    if (scriptValues.includes('jest')) return 'selenium'

    return 'playwright'
  }

  React.useEffect(() => {
    let mounted = true

    const loadProjectAndDetectFramework = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) {
          if (mounted) setProjectRepositoryStatus('error')
          return
        }

        const project = await res.json()
        const repositoryUrl = project?.repository as string | null

        if (mounted) {
          setProjectRepository(repositoryUrl || null)
          setProjectRepositoryStatus('loaded')
        }

        // Fetch API key
        try {
          const keyRes = await fetch(`/api/projects/${projectId}?includeApiKey=true`)
          if (keyRes.ok) {
            const keyData = await keyRes.json()
            if (mounted && keyData?.apiKey) {
              setApiKey(keyData.apiKey)
            }
          }
        } catch {}

        if (!repositoryUrl) return

        const parsed = parseGithubRepo(repositoryUrl)
        if (!parsed) return

        const packageRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/package.json`)
        if (!packageRes.ok) return

        const packageData = await packageRes.json()
        if (!packageData?.content) return

        const decoded = atob(packageData.content.replace(/\n/g, ''))
        const pkg = JSON.parse(decoded)
        const framework = detectFrameworkFromPackageJson(pkg)

        if (mounted) {
          setDetectedFramework(framework)
          setActiveFramework(framework)
        }
      } catch {
        if (mounted) setProjectRepositoryStatus('error')
      }
    }

    void loadProjectAndDetectFramework()

    return () => {
      mounted = false
    }
  }, [projectId])

  const currentSnippet = snippets[activeFramework]
  const codeWithProjectId = currentSnippet.code.replace('{{PROJECT_ID}}', projectId)

  const trackOnboardingStep2 = async () => {
    if (trackedSdkStep) return
    setTrackedSdkStep(true)
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'onboarding_step_2_sdk_installed',
          metadata: {
            projectId,
            framework: activeFramework,
            source: 'connect_page_copy',
          },
        }),
      })
    } catch {
    }
  }

  return (
    <main className="space-y-6" aria-labelledby="connect-page-title">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 id="connect-page-title" className="text-2xl font-bold text-white">Connect Your Tests</h1>
          <p className="text-gray-400 mt-1">Integrate Healify with your test framework</p>
        </div>
        <HealifyLogo size="sm" />
      </div>

      {/* Project ID Badge */}
      <div className="glass-elite p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Project ID</span>
            <p className="font-mono text-cyan-400">{projectId}</p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(projectId)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Copiar Project ID"
            title="Copiar Project ID"
          >
            <Copy className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Step 1: Webhook setup */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Paso 1 (opcional). Conectar webhook de GitHub</h2>
        <p className="text-xs text-gray-500 mb-3">
          Configurá este endpoint en tu repo de GitHub para auto-ejecución en cada push.
          Si ya usás GitHub Actions, podés saltear este paso.
        </p>
        <CodeBlock
          code={webhookUrl}
          language="url"
          onCopy={() => {}}
        />
        {projectRepository && (
          <p className="text-[11px] text-[#E8F0FF]/40 mt-3 break-all">
            Repo conectado: {projectRepository}
          </p>
        )}
        {projectRepositoryStatus === 'error' && (
          <p className="text-[11px] text-amber-300/80 mt-3">
            No pudimos validar el repositorio automáticamente. Podés continuar la configuración manualmente.
          </p>
        )}
      </div>

      {/* Step 2: SDK setup */}
      <div className="flex gap-2 flex-wrap sm:flex-nowrap overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Framework selector">
        {(Object.keys(snippets) as Array<keyof typeof snippets>).map((framework) => (
          <FrameworkTab
            key={framework}
            framework={framework}
            isActive={activeFramework === framework}
            onClick={() => setActiveFramework(framework)}
          />
        ))}
      </div>

      {detectedFramework && (
        <div className="-mt-1 text-[11px] text-[#00F5C8]/80">
          Framework detectado automáticamente: {snippets[detectedFramework].name}
        </div>
      )}

      {/* Installation */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Paso 2. Instalar SDK</h2>
        <CodeBlock 
          code={currentSnippet.install} 
          language="bash"
          onCopy={trackOnboardingStep2}
        />
      </div>

      {/* Integration Code */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Paso 2.2 Agregar al test runner</h2>
        <CodeBlock 
          code={codeWithProjectId} 
          language={currentSnippet.name.toLowerCase()}
          onCopy={trackOnboardingStep2}
        />
      </div>

      {/* Environment Variables */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Paso 2.3 Configurar API key</h2>
        <CodeBlock 
          code={`HEALIFY_API_KEY=${apiKey || 'hf_live_your_api_key_here'}`}
          language="env"
          onCopy={trackOnboardingStep2}
        />
        <p className="text-xs text-gray-500 mt-2">
          Agregá esta variable de entorno en tu CI/CD o archivo <code className="text-gray-300">.env.local</code>.
          Variables opcionales: <code className="text-gray-300">HEALIFY_BRANCH</code> (git branch) y{' '}
          <code className="text-gray-300">HEALIFY_COMMIT_SHA</code> (commit SHA).
        </p>
      </div>

      {/* Step 3 */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-elite p-6"
      >
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-full bg-emerald-500/10">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Paso 3. Tu primer healing</h3>
            <p className="text-gray-400 text-sm">Hacé un push con tests fallando y Healify intentará curarlos automáticamente.</p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[#E8F0FF]/70">
              <Webhook className="w-3 h-3 text-[#00F5C8]" />
              Estado onboarding: listo para primer healing
            </div>
          </div>
        </div>
      </motion.div>

      {/* GitHub Actions */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-1">GitHub Actions</h2>
        <p className="text-xs text-gray-500 mb-3">
          Descargá el workflow de GitHub Actions y colocalo en <span className="font-mono text-gray-300">.github/workflows/healify.yml</span>.
          Healify ejecutará los tests automáticamente en cada push a <span className="font-mono text-gray-300">main</span> o <span className="font-mono text-gray-300">staging</span>.
        </p>
        <a
          href={`/api/projects/${projectId}/github-actions-workflow`}
          download="healify.yml"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 hover:bg-white/10 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar healify.yml
        </a>
      </div>

      {/* GitHub Badge */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Badge “Healed by Healify”</h2>
        <p className="text-xs text-gray-500 mb-3">
          Agregá este badge en el README de tu repo para mostrar que los tests se autocuran con Healify.
        </p>
        <div className="space-y-3">
          <CodeBlock
            code={githubBadgeMarkdown}
            language="markdown"
            onCopy={() => {}}
          />
          <CodeBlock
            code={githubBadgeHtml}
            language="html"
            onCopy={() => {}}
          />
        </div>
      </div>
    </main>
  )
}
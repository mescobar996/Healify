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
    install: 'npm install @healify/test-runner',
    code: `import { test, expect } from '@playwright/test';
import { HealifyReporter } from '@healify/test-runner';

// Configure Healify
const healify = new HealifyReporter({
  apiKey: process.env.HEALIFY_API_KEY, // Your API key
  projectId: '{{PROJECT_ID}}',
  apiUrl: 'https://healify-sigma.vercel.app/api/v1/report'
});

test.beforeEach(async ({ page }, testInfo) => {
  // Track test execution
  healify.trackTest(testInfo);
});

test('login flow', async ({ page }) => {
  await page.goto('https://your-app.com');
  
  // If this selector fails, Healify will auto-heal it
  await page.click('#login-btn'); // Healify tracks this
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password123');
  
  // Auto-report failures with context
  await healify.wrap(async () => {
    await page.click('button[type="submit"]');
  });
});

// Auto-report on failure
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === 'failed') {
    await healify.reportFailure(testInfo);
  }
});`,
  },
  cypress: {
    name: 'Cypress',
    icon: Terminal,
    install: 'npm install @healify/cypress-plugin',
    code: `// cypress.config.js
const { defineConfig } = require('cypress');
const HealifyPlugin = require('@healify/cypress-plugin');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://your-app.com',
    setupNodeEvents(on, config) {
      // Initialize Healify
      HealifyPlugin(on, config, {
        apiKey: process.env.HEALIFY_API_KEY,
        projectId: '{{PROJECT_ID}}',
        apiUrl: 'https://healify-sigma.vercel.app/api/v1/report'
      });
    }
  }
});

// cypress/e2e/login.cy.js
describe('Login Flow', () => {
  beforeEach(() => {
    cy.healifyStart(); // Start tracking
  });

  it('should login successfully', () => {
    cy.visit('/login');
    
    // Healify auto-tracks selectors
    cy.get('#email').type('test@example.com');
    cy.get('#password').type('password123');
    
    // If this fails, Healify will report and suggest fix
    cy.get('#login-btn').click();
    
    // Auto-healed assertions
    cy.healifyAssert('h1', 'Dashboard');
  });

  afterEach(function() {
    if (this.currentTest.state === 'failed') {
      cy.healifyReport(this.currentTest);
    }
  });
});`,
  },
  selenium: {
    name: 'Selenium',
    icon: FileCode,
    install: 'pip install healify-selenium',
    code: `# healify_config.py
from healify_selenium import HealifyReporter

# Initialize Healify
healify = HealifyReporter(
    api_key="YOUR_API_KEY",  # Get from dashboard
    project_id="{{PROJECT_ID}}",
    api_url="https://healify-sigma.vercel.app/api/v1/report"
)

# test_login.py
import pytest
from selenium import webdriver
from healify_config import healify

@pytest.fixture
def driver():
    driver = webdriver.Chrome()
    healify.set_driver(driver)
    yield driver
    healify.report_test_status()
    driver.quit()

@healify.track_test
def test_login_flow(driver):
    driver.get("https://your-app.com/login")
    
    # Healify tracks selectors automatically
    email_input = healify.find_element("#email")
    email_input.send_keys("test@example.com")
    
    password_input = healify.find_element("#password")
    password_input.send_keys("password123")
    
    # If selector fails, Healify will:
    # 1. Report the failure
    # 2. Analyze the DOM
    # 3. Return the fixed selector
    login_btn = healify.find_element("#login-btn")
    login_btn.click()
    
    # Verify with auto-healing
    healify.assert_element_exists("h1", text="Dashboard")`,
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

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 2000)
  }

  // Simple syntax highlighting
  const highlightCode = (code: string) => {
    return code
      .replace(/(\/\/.*)/g, '<span class="text-gray-500">$1</span>')
      .replace(/('.*?')/g, '<span class="text-emerald-400">$1</span>')
      .replace(/(".*?")/g, '<span class="text-emerald-400">$1</span>')
      .replace(/\b(import|from|const|let|var|function|async|await|return|if|else|test|describe|it|def|class|yield)\b/g, '<span class="text-purple-400">$1</span>')
      .replace(/\b(true|false|null|undefined|None)\b/g, '<span class="text-amber-400">$1</span>')
      .replace(/\b(process\.env\.\w+)/g, '<span class="text-cyan-400">$1</span>')
  }

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className={cn(
          'absolute top-3 right-3 p-2 rounded-lg transition-all duration-300',
          copied 
            ? 'bg-emerald-500/20 text-emerald-400 neon-cyan' 
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
        )}
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
        if (!res.ok) return

        const project = await res.json()
        const repositoryUrl = project?.repository as string | null

        if (mounted) setProjectRepository(repositoryUrl || null)

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Connect Your Tests</h1>
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
            onClick={() => navigator.clipboard.writeText(projectId)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Copy className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Step 1: Webhook setup */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Paso 1. Conectar webhook de GitHub</h2>
        <p className="text-xs text-gray-500 mb-3">
          Configurá este endpoint en tu repo de GitHub para que cada push dispare tests automáticamente.
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
      </div>

      {/* Step 2: SDK setup */}
      <div className="flex gap-2 flex-wrap sm:flex-nowrap overflow-x-auto pb-1 scrollbar-hide">
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
          code={`HEALIFY_API_KEY=hf_live_your_api_key_here`}
          language="env"
          onCopy={trackOnboardingStep2}
        />
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
    </div>
  )
}
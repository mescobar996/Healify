'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Copy,
  Check,
  BookOpen,
  Code2,
  Terminal,
  FileCode,
  Play,
  Zap,
  Shield,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Github,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HealifyLogo } from '@/components/HealifyLogo'
import { Button } from '@/components/ui/button'

// ============================================
// COPY BUTTON
// ============================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'absolute top-3 right-3 p-2 rounded-lg transition-all duration-300 z-10',
        copied
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-white/5 text-[#E8F0FF]/40 hover:bg-white/10 hover:text-[#E8F0FF]'
      )}
      aria-label="Copy code"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

// ============================================
// CODE BLOCK
// ============================================

function CodeBlock({
  code,
  language,
  title,
}: {
  code: string
  language: string
  title?: string
}) {
  const highlightCode = (raw: string) => {
    return raw
      .replace(/(\/\/.*)/g, '<span class="text-[#E8F0FF]/30">$1</span>')
      .replace(/(#.*)/g, '<span class="text-[#E8F0FF]/30">$1</span>')
      .replace(/('.*?')/g, '<span class="text-[#00F5C8]">$1</span>')
      .replace(/(".*?")/g, '<span class="text-[#00F5C8]">$1</span>')
      .replace(
        /\b(import|from|const|let|var|function|async|await|return|if|else|export|default|new|throw|try|catch|class|extends|interface|type|enum)\b/g,
        '<span class="text-[#7B5EF8]">$1</span>'
      )
      .replace(
        /\b(true|false|null|undefined|None)\b/g,
        '<span class="text-[#FF6B9D]">$1</span>'
      )
      .replace(
        /\b(process\.env\.\w+|HEALIFY_API_KEY)\b/g,
        '<span class="text-[#00F5C8]">$1</span>'
      )
  }

  return (
    <div className="relative group">
      <CopyButton text={code} />
      <div className="bg-[rgba(0,0,0,0.4)] backdrop-blur-xl border border-white/8 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          <span className="ml-2 text-xs text-[#E8F0FF]/30 font-mono">
            {title || language}
          </span>
        </div>
        <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
          <code
            className="text-[#E8F0FF]/80"
            dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
          />
        </pre>
      </div>
    </div>
  )
}

// ============================================
// COLLAPSIBLE SECTION
// ============================================

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-elite overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[#E8F0FF] font-semibold text-lg font-heading">
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-5 h-5 text-[#00F5C8]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[#E8F0FF]/40" />
        )}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="px-6 pb-6"
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}

// ============================================
// SIDEBAR NAV
// ============================================

const sections = [
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'api-reference', label: 'API Reference', icon: Code2 },
  { id: 'playwright', label: 'Playwright', icon: Play },
  { id: 'cypress', label: 'Cypress', icon: Terminal },
  { id: 'selenium', label: 'Selenium', icon: FileCode },
  { id: 'webhooks', label: 'GitHub Webhooks', icon: Github },
  { id: 'rate-limits', label: 'Rate Limits', icon: Shield },
]

function SideNav({ active }: { active: string }) {
  return (
    <nav className="hidden lg:block sticky top-20 w-56 flex-shrink-0">
      <div className="space-y-1">
        <p className="text-[10px] font-medium tracking-widest text-[#E8F0FF]/30 uppercase px-3 mb-3">
          Sections
        </p>
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150',
              active === s.id
                ? 'bg-[rgba(0,245,200,0.08)] text-[#00F5C8] border border-[#00F5C8]/20'
                : 'text-[#E8F0FF]/50 hover:text-[#E8F0FF] hover:bg-white/5'
            )}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function DocsPage() {
  const [activeSection] = useState('quickstart')

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF] relative">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-elite border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <HealifyLogo size="md" showText={true} />
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#00F5C8] bg-[#00F5C8]/10 px-2.5 py-1 rounded-full border border-[#00F5C8]/20">
              <BookOpen className="w-3 h-3" />
              Documentation
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="text-sm text-[#E8F0FF]/60 hover:text-[#00F5C8] transition-colors"
            >
              Pricing
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="glass-elite border-[#00F5C8]/30 text-[#E8F0FF] hover:border-[#00F5C8]/50 hover:bg-white/5"
              asChild
            >
              <Link href="/dashboard">
                Dashboard
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-10">
          {/* Sidebar */}
          <SideNav active={activeSection} />

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-12">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <h1 className="text-4xl sm:text-5xl font-bold font-heading text-balance">
                Healify{' '}
                <span className="text-gradient">Documentation</span>
              </h1>
              <p className="text-lg text-[#E8F0FF]/60 max-w-2xl leading-relaxed">
                Integrate Healify into your test suite in minutes. When a
                selector breaks, Healify analyzes the DOM, suggests a fix with
                a confidence score, and optionally opens a Pull Request
                automatically.
              </p>
            </motion.div>

            {/* ────────────────────── QUICK START ─────────────────── */}
            <section id="quickstart" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-3">
                <Zap className="w-6 h-6 text-[#00F5C8]" />
                Quick Start
              </h2>

              <div className="space-y-4">
                <div className="glass-elite p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-[#E8F0FF]">
                    1. Create a Project
                  </h3>
                  <p className="text-sm text-[#E8F0FF]/60 leading-relaxed">
                    Go to{' '}
                    <Link
                      href="/dashboard/projects"
                      className="text-[#00F5C8] hover:underline"
                    >
                      Dashboard &rarr; Projects
                    </Link>{' '}
                    and create a new project. You will receive an{' '}
                    <strong className="text-[#E8F0FF]">API Key</strong> that
                    authenticates all requests from your CI runner.
                  </p>
                </div>

                <div className="glass-elite p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-[#E8F0FF]">
                    2. Report a failure via the REST API
                  </h3>
                  <p className="text-sm text-[#E8F0FF]/60 leading-relaxed">
                    When a test fails, send a POST to{' '}
                    <code className="text-[#00F5C8] bg-white/5 px-1.5 py-0.5 rounded text-xs">
                      /api/v1/report
                    </code>{' '}
                    with the broken selector and error message. Healify will
                    return a suggested fix instantly.
                  </p>
                  <CodeBlock
                    language="bash"
                    title="cURL"
                    code={`curl -X POST https://healify-sigma.vercel.app/api/v1/report \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "testName": "login flow",
    "selector": "#login-btn",
    "error": "Element not found",
    "selectorType": "CSS",
    "context": "<html><body><button data-testid=\\"auth-button\\">Login</button></body></html>"
  }'`}
                  />
                </div>

                <div className="glass-elite p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-[#E8F0FF]">
                    3. Get back a healed selector
                  </h3>
                  <p className="text-sm text-[#E8F0FF]/60 leading-relaxed">
                    The response includes the suggested fix, confidence score,
                    reasoning, and alternative selectors:
                  </p>
                  <CodeBlock
                    language="json"
                    title="Response"
                    code={`{
  "success": true,
  "testRunId": "cltx...",
  "healingEventId": "cltx...",
  "result": {
    "fixedSelector": "role('button', { name: 'Login' })",
    "confidence": 0.92,
    "selectorType": "ROLE",
    "explanation": "Replaced fragile CSS ID with ARIA role selector...",
    "needsReview": false,
    "alternatives": [
      { "selector": "button:has-text('Login')", "confidence": 0.85 },
      { "selector": "[data-testid='auth-button']", "confidence": 0.95 }
    ]
  },
  "processingTimeMs": 342
}`}
                  />
                </div>
              </div>
            </section>

            {/* ────────────────────── API REFERENCE ─────────────────── */}
            <section id="api-reference" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-3">
                <Code2 className="w-6 h-6 text-[#7B5EF8]" />
                API Reference
              </h2>

              <div className="glass-elite p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#E8F0FF] mb-2">
                    POST /api/v1/report
                  </h3>
                  <p className="text-sm text-[#E8F0FF]/60 mb-4 leading-relaxed">
                    Reports a test failure and triggers the healing engine.
                    Requires a valid API key via{' '}
                    <code className="text-[#00F5C8] bg-white/5 px-1.5 py-0.5 rounded text-xs">
                      x-api-key
                    </code>{' '}
                    header or{' '}
                    <code className="text-[#00F5C8] bg-white/5 px-1.5 py-0.5 rounded text-xs">
                      Authorization: Bearer &lt;key&gt;
                    </code>
                    .
                  </p>

                  {/* Request Body Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/8">
                          <th className="text-left py-2 pr-4 text-[#E8F0FF]/40 font-medium">
                            Field
                          </th>
                          <th className="text-left py-2 pr-4 text-[#E8F0FF]/40 font-medium">
                            Type
                          </th>
                          <th className="text-left py-2 pr-4 text-[#E8F0FF]/40 font-medium">
                            Required
                          </th>
                          <th className="text-left py-2 text-[#E8F0FF]/40 font-medium">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-[#E8F0FF]/70">
                        <tr className="border-b border-white/5">
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            testName
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">string</td>
                          <td className="py-2.5 pr-4 text-[#00F5C8]">Yes</td>
                          <td className="py-2.5">Name of the failing test</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            selector
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">string</td>
                          <td className="py-2.5 pr-4 text-[#00F5C8]">Yes</td>
                          <td className="py-2.5">The broken selector</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            error
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">string</td>
                          <td className="py-2.5 pr-4 text-[#00F5C8]">Yes</td>
                          <td className="py-2.5">Error message from the runner</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            testFile
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">string</td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/40">No</td>
                          <td className="py-2.5">Path of the test file</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            context
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">string</td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/40">No</td>
                          <td className="py-2.5">
                            HTML snippet of the DOM around the element
                          </td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            selectorType
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">enum</td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/40">No</td>
                          <td className="py-2.5">
                            CSS | XPATH | TESTID | ROLE | TEXT | UNKNOWN
                          </td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            branch
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">string</td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/40">No</td>
                          <td className="py-2.5">Git branch name</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 font-mono text-[#00F5C8] text-xs">
                            commitSha
                          </td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/50">string</td>
                          <td className="py-2.5 pr-4 text-[#E8F0FF]/40">No</td>
                          <td className="py-2.5">Git commit SHA</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Authentication */}
                <div className="border-t border-white/8 pt-6">
                  <h4 className="text-sm font-semibold text-[#E8F0FF] mb-3">
                    Authentication
                  </h4>
                  <p className="text-sm text-[#E8F0FF]/60 mb-3 leading-relaxed">
                    Pass your project API key in one of two ways:
                  </p>
                  <CodeBlock
                    language="http"
                    title="Headers"
                    code={`# Option 1: x-api-key header
x-api-key: YOUR_API_KEY

# Option 2: Bearer token
Authorization: Bearer YOUR_API_KEY`}
                  />
                </div>

                {/* Error codes */}
                <div className="border-t border-white/8 pt-6">
                  <h4 className="text-sm font-semibold text-[#E8F0FF] mb-3">
                    Error Codes
                  </h4>
                  <div className="space-y-2">
                    {[
                      { code: '400', desc: 'Invalid request body (Zod validation error)' },
                      { code: '401', desc: 'Missing or invalid API key' },
                      { code: '404', desc: 'Project not found' },
                      { code: '429', desc: 'Rate limit exceeded (60 req/min per project)' },
                      { code: '500', desc: 'Internal server error' },
                    ].map((e) => (
                      <div
                        key={e.code}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span
                          className={cn(
                            'font-mono text-xs px-2 py-0.5 rounded',
                            e.code === '400'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : e.code === '401'
                                ? 'bg-red-500/10 text-red-400'
                                : e.code === '404'
                                  ? 'bg-orange-500/10 text-orange-400'
                                  : e.code === '429'
                                    ? 'bg-[#7B5EF8]/10 text-[#7B5EF8]'
                                    : 'bg-red-500/10 text-red-400'
                          )}
                        >
                          {e.code}
                        </span>
                        <span className="text-[#E8F0FF]/60">{e.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ────────────────────── PLAYWRIGHT ─────────────────── */}
            <section id="playwright" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-3">
                <Play className="w-6 h-6 text-[#00F5C8]" />
                Playwright Integration
              </h2>

              <CollapsibleSection title="Install" defaultOpen>
                <CodeBlock
                  language="bash"
                  code="npm install @playwright/test"
                />
              </CollapsibleSection>

              <CollapsibleSection
                title="Reporter helper (healify-reporter.ts)"
                defaultOpen
              >
                <CodeBlock
                  language="typescript"
                  title="healify-reporter.ts"
                  code={`import type { TestInfo } from '@playwright/test';

const HEALIFY_API = process.env.HEALIFY_API_URL || 'https://healify-sigma.vercel.app';
const API_KEY     = process.env.HEALIFY_API_KEY;

export async function reportFailure(opts: {
  testName: string;
  selector: string;
  error: string;
  context?: string;        // HTML around the element
  selectorType?: string;   // CSS | XPATH | TESTID | ROLE | TEXT
  branch?: string;
  commitSha?: string;
}) {
  if (!API_KEY) {
    console.warn('[Healify] HEALIFY_API_KEY not set - skipping report');
    return null;
  }

  const res = await fetch(\`\${HEALIFY_API}/api/v1/report\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    console.error('[Healify] Report failed:', res.status);
    return null;
  }

  const data = await res.json();
  console.log('[Healify] Selector healed ->',
    data.result?.fixedSelector,
    '(confidence:', data.result?.confidence, ')');
  return data;
}`}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Usage in a test file">
                <CodeBlock
                  language="typescript"
                  title="tests/login.spec.ts"
                  code={`import { test, expect } from '@playwright/test';
import { reportFailure } from './healify-reporter';

test('login flow', async ({ page }) => {
  await page.goto('/login');

  try {
    await page.click('#login-btn');
  } catch (err: any) {
    // Report to Healify when a selector breaks
    const heal = await reportFailure({
      testName: 'login flow',
      selector: '#login-btn',
      error: err.message,
      context: await page.content(),  // pass current DOM
      selectorType: 'CSS',
    });

    // Optionally retry with healed selector
    if (heal?.result?.fixedSelector) {
      await page.locator(heal.result.fixedSelector).click();
    } else {
      throw err;
    }
  }

  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'secret');
  await page.click('button[type="submit"]');
  await expect(page.locator('h1')).toHaveText('Dashboard');
});`}
                />
              </CollapsibleSection>
            </section>

            {/* ────────────────────── CYPRESS ─────────────────── */}
            <section id="cypress" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-3">
                <Terminal className="w-6 h-6 text-[#7B5EF8]" />
                Cypress Integration
              </h2>

              <CollapsibleSection title="Custom command" defaultOpen>
                <CodeBlock
                  language="javascript"
                  title="cypress/support/healify.js"
                  code={`// cypress/support/healify.js
const HEALIFY_API = Cypress.env('HEALIFY_API_URL') || 'https://healify-sigma.vercel.app';
const API_KEY     = Cypress.env('HEALIFY_API_KEY');

Cypress.Commands.add('healifyReport', (selector, error) => {
  if (!API_KEY) return cy.log('[Healify] API key not set');

  cy.request({
    method: 'POST',
    url: \`\${HEALIFY_API}/api/v1/report\`,
    headers: { 'x-api-key': API_KEY },
    body: {
      testName: Cypress.currentTest.title,
      selector,
      error: error || 'Element not found',
      selectorType: 'CSS',
    },
    failOnStatusCode: false,
  }).then((res) => {
    if (res.status === 200 && res.body?.result?.fixedSelector) {
      cy.log('[Healify] Healed ->', res.body.result.fixedSelector);
    }
  });
});`}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Usage in a spec">
                <CodeBlock
                  language="javascript"
                  title="cypress/e2e/login.cy.js"
                  code={`describe('Login', () => {
  it('should login with healed selector', () => {
    cy.visit('/login');

    // If this fails, report to Healify
    cy.get('#login-btn').should('exist').then(($el) => {
      if (!$el.length) {
        cy.healifyReport('#login-btn', 'Element not found');
      }
    });

    cy.get('#email').type('test@example.com');
    cy.get('#password').type('secret');
    cy.get('button[type="submit"]').click();
    cy.contains('h1', 'Dashboard');
  });
});`}
                />
              </CollapsibleSection>
            </section>

            {/* ────────────────────── SELENIUM ─────────────────── */}
            <section id="selenium" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-3">
                <FileCode className="w-6 h-6 text-[#FF6B9D]" />
                Selenium (Python)
              </h2>

              <CollapsibleSection title="healify_client.py" defaultOpen>
                <CodeBlock
                  language="python"
                  title="healify_client.py"
                  code={`import os, requests

HEALIFY_API = os.getenv('HEALIFY_API_URL', 'https://healify-sigma.vercel.app')
API_KEY     = os.getenv('HEALIFY_API_KEY')

def report_failure(test_name: str, selector: str, error: str, **kwargs):
    if not API_KEY:
        print('[Healify] API key not set')
        return None

    res = requests.post(
        f'{HEALIFY_API}/api/v1/report',
        headers={'x-api-key': API_KEY, 'Content-Type': 'application/json'},
        json={
            'testName': test_name,
            'selector': selector,
            'error': error,
            'selectorType': kwargs.get('selector_type', 'CSS'),
            'context': kwargs.get('context'),
            'branch': kwargs.get('branch'),
            'commitSha': kwargs.get('commit_sha'),
        },
    )

    if res.ok:
        data = res.json()
        fix = data.get('result', {}).get('fixedSelector')
        conf = data.get('result', {}).get('confidence')
        print(f'[Healify] Healed -> {fix} (confidence: {conf})')
        return data
    else:
        print(f'[Healify] Error {res.status_code}')
        return None`}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Usage in a test">
                <CodeBlock
                  language="python"
                  title="test_login.py"
                  code={`from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException
from healify_client import report_failure

def test_login():
    driver = webdriver.Chrome()
    driver.get('https://your-app.com/login')

    try:
        btn = driver.find_element('css selector', '#login-btn')
        btn.click()
    except NoSuchElementException as e:
        heal = report_failure(
            test_name='test_login',
            selector='#login-btn',
            error=str(e),
            context=driver.page_source[:5000],
        )
        if heal and heal.get('result', {}).get('fixedSelector'):
            btn = driver.find_element('css selector', heal['result']['fixedSelector'])
            btn.click()
        else:
            raise

    driver.quit()`}
                />
              </CollapsibleSection>
            </section>

            {/* ────────────────────── GITHUB WEBHOOKS ─────────────────── */}
            <section id="webhooks" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-3">
                <Github className="w-6 h-6 text-[#E8F0FF]" />
                GitHub Webhooks
              </h2>

              <div className="glass-elite p-6 space-y-4">
                <p className="text-sm text-[#E8F0FF]/60 leading-relaxed">
                  Connect your repository to automatically trigger Healify test
                  runs on every push. When a push event is received, Healify:
                </p>
                <ol className="space-y-2 text-sm text-[#E8F0FF]/70 list-decimal list-inside">
                  <li>Verifies the HMAC signature (SHA-256)</li>
                  <li>
                    Finds the project linked to the repository URL
                  </li>
                  <li>
                    Analyzes which files changed to estimate test impact
                  </li>
                  <li>
                    Creates a TestRun and enqueues it in the BullMQ worker queue
                  </li>
                  <li>
                    The worker runs Playwright, auto-heals failures, and opens
                    PRs for high-confidence fixes
                  </li>
                </ol>

                <h4 className="text-sm font-semibold text-[#E8F0FF] pt-4">
                  Setup
                </h4>
                <div className="space-y-3 text-sm text-[#E8F0FF]/60">
                  <p>
                    1. Go to your repo &rarr; Settings &rarr; Webhooks &rarr;
                    Add webhook
                  </p>
                  <CodeBlock
                    language="text"
                    title="Webhook URL"
                    code="https://healify-sigma.vercel.app/api/webhook/github"
                  />
                  <p>
                    2. Set <strong className="text-[#E8F0FF]">Content type</strong> to{' '}
                    <code className="text-[#00F5C8] bg-white/5 px-1 py-0.5 rounded text-xs">
                      application/json
                    </code>
                  </p>
                  <p>
                    3. Set a <strong className="text-[#E8F0FF]">Secret</strong> and
                    add it as{' '}
                    <code className="text-[#00F5C8] bg-white/5 px-1 py-0.5 rounded text-xs">
                      GITHUB_WEBHOOK_SECRET
                    </code>{' '}
                    in your environment variables.
                  </p>
                  <p>
                    4. Select event:{' '}
                    <strong className="text-[#E8F0FF]">Push</strong>
                  </p>
                </div>
              </div>
            </section>

            {/* ────────────────────── RATE LIMITS ─────────────────── */}
            <section id="rate-limits" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-3">
                <Shield className="w-6 h-6 text-[#7B5EF8]" />
                Rate Limits
              </h2>

              <div className="glass-elite p-6 space-y-4">
                <p className="text-sm text-[#E8F0FF]/60 leading-relaxed">
                  To protect against runaway CI loops, the Report API enforces
                  per-project rate limits:
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left py-2 pr-6 text-[#E8F0FF]/40 font-medium">
                          Endpoint
                        </th>
                        <th className="text-left py-2 pr-6 text-[#E8F0FF]/40 font-medium">
                          Limit
                        </th>
                        <th className="text-left py-2 text-[#E8F0FF]/40 font-medium">
                          Window
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[#E8F0FF]/70">
                      <tr>
                        <td className="py-2.5 pr-6 font-mono text-xs text-[#00F5C8]">
                          POST /api/v1/report
                        </td>
                        <td className="py-2.5 pr-6">60 requests</td>
                        <td className="py-2.5">1 minute per project</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-sm text-[#E8F0FF]/60 leading-relaxed">
                  When the limit is hit you receive a{' '}
                  <code className="text-[#7B5EF8] bg-white/5 px-1.5 py-0.5 rounded text-xs">
                    429
                  </code>{' '}
                  response with the following headers:
                </p>

                <CodeBlock
                  language="http"
                  title="Rate limit headers"
                  code={`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 45
Retry-After: 45`}
                />
              </div>
            </section>

            {/* ────────────────────── CTA ─────────────────── */}
            <section className="pt-8 pb-16">
              <div className="glass-elite glass-elite-large p-8 sm:p-10 text-center space-y-4">
                <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#E8F0FF]">
                  Ready to integrate?
                </h2>
                <p className="text-[#E8F0FF]/60 max-w-md mx-auto">
                  Create a project, grab your API key, and start reporting
                  failures in minutes.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
                  <Button
                    size="lg"
                    className="btn-neon text-base font-semibold"
                    asChild
                  >
                    <Link href="/dashboard/projects">
                      Go to Dashboard
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="glass-elite border-[#00F5C8]/30 text-[#E8F0FF] hover:border-[#00F5C8]/50 hover:bg-white/5"
                    asChild
                  >
                    <a
                      href="https://github.com/mescobar996/Healify"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="w-5 h-5 mr-2" />
                      View on GitHub
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#E8F0FF]/60">
            <HealifyLogo size="sm" showText={true} />
            <div className="flex items-center gap-6">
              <Link
                href="/docs"
                className="text-[#00F5C8] transition-colors"
              >
                Documentation
              </Link>
              <a
                href="https://github.com/mescobar996/Healify"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#00F5C8] transition-colors"
              >
                GitHub
              </a>
              <a
                href="mailto:support@healify.dev"
                className="hover:text-[#00F5C8] transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

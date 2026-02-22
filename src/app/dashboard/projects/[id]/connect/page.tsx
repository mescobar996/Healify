'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Copy, Check, Play, Code2, Terminal, FileCode } from 'lucide-react'
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

  const currentSnippet = snippets[activeFramework]
  const codeWithProjectId = currentSnippet.code.replace('{{PROJECT_ID}}', projectId)

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

      {/* Framework Tabs */}
      <div className="flex gap-3">
        {(Object.keys(snippets) as Array<keyof typeof snippets>).map((framework) => (
          <FrameworkTab
            key={framework}
            framework={framework}
            isActive={activeFramework === framework}
            onClick={() => setActiveFramework(framework)}
          />
        ))}
      </div>

      {/* Installation */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">1. Install the SDK</h2>
        <CodeBlock 
          code={currentSnippet.install} 
          language="bash"
          onCopy={() => {}}
        />
      </div>

      {/* Integration Code */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">2. Add to your test file</h2>
        <CodeBlock 
          code={codeWithProjectId} 
          language={currentSnippet.name.toLowerCase()}
          onCopy={() => {}}
        />
      </div>

      {/* Environment Variables */}
      <div className="glass-elite p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">3. Set environment variable</h2>
        <CodeBlock 
          code={`HEALIFY_API_KEY=hf_live_your_api_key_here`}
          language="env"
          onCopy={() => {}}
        />
      </div>

      {/* Status */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-elite p-6"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-emerald-500/10">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Ready to Connect</h3>
            <p className="text-gray-400 text-sm">Run your tests and Healify will start tracking</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
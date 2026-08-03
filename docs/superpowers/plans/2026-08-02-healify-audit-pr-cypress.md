# Healify: Audit Logs + PR Workflow + Cypress Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete audit logging, PR workflow, and Cypress positioning to Healify

**Architecture:** Separate audit module in reporter-core, PR command in CLI, Cypress documentation and plugin list submission

**Tech Stack:** TypeScript, Node.js, Vitest, Git, GitHub CLI (optional)

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `reporter-core/src/audit.ts` | Audit module: types, buildAuditEntry, writeAuditReport, appendAuditEntry |
| `reporter-core/src/__tests__/audit.test.ts` | Unit tests for audit module |
| `cli/src/pr.ts` | PR workflow: detect gh, create branch, commit, open PR |
| `cli/src/__tests__/fix-pr.test.ts` | Unit tests for PR workflow |
| `docs/superpowers/specs/2026-08-02-healify-audit-pr-cypress-design.md` | Design spec (already exists) |
| `docs/superpowers/plans/2026-08-02-healify-audit-pr-cypress.md` | This plan |

### Modified Files

| File | Changes |
|------|---------|
| `reporter-core/src/index.ts` | Export audit types and functions |
| `reporter-core/src/local-mode.ts` | Add AuditEntry to pipeline |
| `cli/src/fix.ts` | Add `--pr` option |
| `cli/src/index.ts` | Register `--pr` flag |
| `test-runner/src/index.ts` | Integrate audit for Playwright |
| `cypress-plugin/src/support.ts` | Integrate audit for Cypress |
| `selenium-plugin/src/plugin.ts` | Integrate audit for Selenium |
| `webdriverio-plugin/src/plugin.ts` | Integrate audit for WebdriverIO |

---

## Task 1: Audit Module Types and Core Functions

**Files:**
- Create: `reporter-core/src/audit.ts`
- Test: `reporter-core/src/__tests__/audit.test.ts`

- [ ] **Step 1: Write failing tests for AuditEntry type and buildAuditEntry**

```typescript
// reporter-core/src/__tests__/audit.test.ts
import { describe, it, expect } from 'vitest'
import { buildAuditEntry, writeAuditReport, appendAuditEntry } from '../audit'
import type { HealResponse, HealRequest } from '../healing-engine'
import type { FailureContext } from '../audit'

describe('audit module', () => {
  const mockResponse: HealResponse = {
    verified: true,
    fromRepertoire: false,
    fixedSelector: "role('button', { name: 'Iniciar sesión' })",
    confidence: 0.97,
    explanation: 'Verificado contra la página',
    selectorType: 'ROLE',
    alternatives: [{ selector: "button:has-text('Iniciar sesión')", confidence: 0.85 }],
    needsReview: false,
    robustnessImprovement: 50,
    technicalDetails: {
      detectedIssue: 'ID selectors are brittle',
      proposedSolution: 'ARIA roles are stable',
      accessibilityCompliant: true,
      stableAgainstDOMChanges: true,
    },
  }

  const mockRequest: HealRequest = {
    selector: '#login-btn',
    testName: 'should login successfully',
    testFile: 'e2e/login.spec.ts',
    htmlContext: '<button id="login-btn">Iniciar sesión</button>',
  }

  const mockContext: FailureContext = {
    errorMessage: 'Element not found: #login-btn',
    domSnippet: '<button id="login-btn">Iniciar sesión</button>',
    screenshotPath: 'screenshots/login-fail.png',
    line: 15,
  }

  it('buildAuditEntry creates valid entry', () => {
    const entry = buildAuditEntry(mockResponse, mockRequest, mockContext)
    
    expect(entry.timestamp).toBeDefined()
    expect(entry.testName).toBe('should login successfully')
    expect(entry.testFile).toBe('e2e/login.spec.ts')
    expect(entry.line).toBe(15)
    expect(entry.originalSelector).toBe('#login-btn')
    expect(entry.fixedSelector).toBe("role('button', { name: 'Iniciar sesión' })")
    expect(entry.confidence).toBe(0.97)
    expect(entry.verified).toBe(true)
    expect(entry.domSnippet).toBe('<button id="login-btn">Iniciar sesión</button>')
    expect(entry.domHash).toBeDefined()
    expect(entry.screenshotPath).toBe('screenshots/login-fail.png')
    expect(entry.alternatives).toHaveLength(1)
    expect(entry.technicalDetails.accessibilityCompliant).toBe(true)
  })

  it('domHash is deterministic', () => {
    const entry1 = buildAuditEntry(mockResponse, mockRequest, mockContext)
    const entry2 = buildAuditEntry(mockResponse, mockRequest, mockContext)
    
    expect(entry1.domHash).toBe(entry2.domHash)
  })

  it('domHash changes when DOM changes', () => {
    const context1 = { ...mockContext, domSnippet: '<button id="login-btn">Login</button>' }
    const context2 = { ...mockContext, domSnippet: '<button id="login-btn">Iniciar sesión</button>' }
    
    const entry1 = buildAuditEntry(mockResponse, mockRequest, context1)
    const entry2 = buildAuditEntry(mockResponse, mockRequest, context2)
    
    expect(entry1.domHash).not.toBe(entry2.domHash)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose reporter-core/src/__tests__/audit.test.ts`
Expected: FAIL with "Cannot find module '../audit'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// reporter-core/src/audit.ts
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { HealResponse, SelectorType } from './healing-engine'

export interface AuditEntry {
  timestamp: string
  testName: string
  testFile?: string
  line?: number
  originalSelector: string
  fixedSelector: string
  selectorType: SelectorType
  confidence: number
  verified: boolean
  fromRepertoire: boolean
  errorMessage: string
  domSnippet?: string
  domHash?: string
  screenshotPath?: string
  alternatives: { selector: string; confidence: number }[]
  technicalDetails: {
    detectedIssue: string
    proposedSolution: string
    accessibilityCompliant: boolean
    stableAgainstDOMChanges: boolean
  }
}

export interface FailureContext {
  errorMessage: string
  domSnippet?: string
  screenshotPath?: string
  line?: number
}

export interface AuditReport {
  project: string
  framework: string
  generatedAt: string
  totalCases: number
  entries: AuditEntry[]
}

function hashDom(domSnippet: string | undefined): string | undefined {
  if (!domSnippet) return undefined
  return createHash('sha256').update(domSnippet).digest('hex')
}

export function buildAuditEntry(
  response: HealResponse,
  request: { selector: string; testName?: string; testFile?: string },
  context: FailureContext
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    testName: request.testName ?? 'unknown',
    testFile: request.testFile,
    line: context.line,
    originalSelector: request.selector,
    fixedSelector: response.fixedSelector,
    selectorType: response.selectorType,
    confidence: response.confidence,
    verified: response.verified,
    fromRepertoire: response.fromRepertoire,
    errorMessage: context.errorMessage,
    domSnippet: context.domSnippet,
    domHash: hashDom(context.domSnippet),
    screenshotPath: context.screenshotPath,
    alternatives: response.alternatives ?? [],
    technicalDetails: response.technicalDetails,
  }
}

export function writeAuditReport(
  entries: AuditEntry[],
  outputDir: string,
  project: string,
  framework: string
): string {
  const report: AuditReport = {
    project,
    framework,
    generatedAt: new Date().toISOString(),
    totalCases: entries.length,
    entries,
  }

  const fullPath = join(outputDir, 'healify-audit.json')
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf-8')
  return fullPath
}

export function appendAuditEntry(entry: AuditEntry, outputDir: string): void {
  const fullPath = join(outputDir, 'healify-audit.jsonl')
  mkdirSync(dirname(fullPath), { recursive: true })
  appendFileSync(fullPath, JSON.stringify(entry) + '\n', 'utf-8')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose reporter-core/src/__tests__/audit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add reporter-core/src/audit.ts reporter-core/src/__tests__/audit.test.ts
git commit -m "feat(audit): add audit module with types and core functions"
```

---

## Task 2: Export Audit from reporter-core

**Files:**
- Modify: `reporter-core/src/index.ts`

- [ ] **Step 1: Add exports to index.ts**

```typescript
// Add to reporter-core/src/index.ts
export { buildAuditEntry, writeAuditReport, appendAuditEntry } from './audit'
export type { AuditEntry, AuditReport, FailureContext } from './audit'
```

- [ ] **Step 2: Run all reporter-core tests**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add reporter-core/src/index.ts
git commit -m "feat(audit): export audit types and functions from reporter-core"
```

---

## Task 3: PR Workflow Module

**Files:**
- Create: `cli/src/pr.ts`
- Test: `cli/src/__tests__/fix-pr.test.ts`

- [ ] **Step 1: Write failing tests for PR workflow**

```typescript
// cli/src/__tests__/fix-pr.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectGitHubCLI, createBranch, createCommit, createPRInstructions } from '../pr'

describe('PR workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detectGitHubCLI returns true when gh is available', async () => {
    vi.mock('node:child_process', () => ({
      execSync: vi.fn((cmd: string) => {
        if (cmd === 'gh --version') return 'gh version 2.50.0'
        throw new Error('Command not found')
      }),
    }))

    const result = await detectGitHubCLI()
    expect(result).toBe(true)
  })

  it('detectGitHubCLI returns false when gh is not available', async () => {
    vi.mock('node:child_process', () => ({
      execSync: vi.fn(() => {
        throw new Error('Command not found')
      }),
    }))

    const result = await detectGitHubCLI()
    expect(result).toBe(false)
  })

  it('createBranch creates branch with timestamp', async () => {
    const mockExecSync = vi.fn()
    vi.mock('node:child_process', () => ({
      execSync: mockExecSync,
    }))

    await createBranch()
    
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/^git checkout -b healify\/fix-\d{8}-\d{6}$/)
    )
  })

  it('createCommit creates commit with correct message', async () => {
    const mockExecSync = vi.fn()
    vi.mock('node:child_process', () => ({
      execSync: mockExecSync,
    }))

    await createCommit(3)
    
    expect(mockExecSync).toHaveBeenCalledWith('git add -A')
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/^git commit -m "healify: auto-fix 3 broken selectors"$/)
    )
  })

  it('createPRInstructions returns instructions for manual PR', async () => {
    const instructions = await createPRInstructions('healify/fix-20260802-143022')
    
    expect(instructions).toContain('git push origin healify/fix-20260802-143022')
    expect(instructions).toContain('gh pr create')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose cli/src/__tests__/fix-pr.test.ts`
Expected: FAIL with "Cannot find module '../pr'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// cli/src/pr.ts
import { execSync } from 'node:child_process'

export async function detectGitHubCLI(): Promise<boolean> {
  try {
    execSync('gh --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function getTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export async function createBranch(): Promise<string> {
  const branchName = `healify/fix-${getTimestamp()}`
  execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' })
  return branchName
}

export async function createCommit(selectorCount: number): Promise<void> {
  execSync('git add -A', { stdio: 'ignore' })
  execSync(`git commit -m "healify: auto-fix ${selectorCount} broken selectors"`, { stdio: 'ignore' })
}

export async function createPRInstructions(branchName: string): Promise<string> {
  return `Branch '${branchName}' created and committed.

To create a PR, run:

  git push origin ${branchName}
  gh pr create --title "healify: fix broken selectors" --body "See healify-audit.json for details"

Or open https://github.com in your browser and create a PR manually from branch '${branchName}'.`
}

export async function createPRWithGH(title: string, body: string): Promise<string> {
  const result = execSync(`gh pr create --title "${title}" --body "${body}"`, { encoding: 'utf-8' })
  return result.trim()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose cli/src/__tests__/fix-pr.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/pr.ts cli/src/__tests__/fix-pr.test.ts
git commit -m "feat(pr): add PR workflow module with gh detection"
```

---

## Task 4: Integrate --pr Flag into CLI

**Files:**
- Modify: `cli/src/fix.ts`
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Add --pr option to fix.ts**

```typescript
// Add to cli/src/fix.ts FixOptions interface
export interface FixOptions {
  dryRun?: boolean
  force?: boolean
  pr?: boolean  // NEW
}
```

- [ ] **Step 2: Add PR logic to fix function**

```typescript
// Add at the end of the fix function in cli/src/fix.ts
import { detectGitHubCLI, createBranch, createCommit, createPRInstructions, createPRWithGH } from './pr'

// After the fix loop, before return outcomes
if (options.pr && outcomes.some(o => o.status === 'applied')) {
  const appliedCount = outcomes.filter(o => o.status === 'applied').length
  
  try {
    const branchName = await createBranch()
    await createCommit(appliedCount)
    
    const hasGH = await detectGitHubCLI()
    if (hasGH) {
      const prBody = `## Healify Auto-Fix\n\nResumen: ${appliedCount} selectores arreglados\n\nAudit completo: healify-audit.json`
      const prURL = await createPRWithGH('healify: fix broken selectors', prBody)
      console.log(`✅ PR created: ${prURL}`)
    } else {
      const instructions = await createPRInstructions(branchName)
      console.log(instructions)
    }
  } catch (error) {
    console.error(`❌ Error creating PR: ${error instanceof Error ? error.message : String(error)}`)
  }
}
```

- [ ] **Step 3: Register --pr flag in index.ts**

```typescript
// Add to cli/src/index.ts in the fix command registration
.command('fix')
.description('Aplica los selectores curados')
.option('--dry-run', 'Muestra los cambios sin aplicarlos')
.option('--force', 'Fuerza la aplicación sin verificar git')
.option('--pr', 'Crea branch, commit y PR con los cambios')  // NEW
.action(async (options) => {
  // ... existing code
})
```

- [ ] **Step 4: Run CLI tests**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add cli/src/fix.ts cli/src/index.ts
git commit -m "feat(cli): integrate --pr flag into fix command"
```

---

## Task 5: Integrate Audit into Playwright Adapter

**Files:**
- Modify: `test-runner/src/index.ts`

- [ ] **Step 1: Add audit import and integration**

```typescript
// Add to test-runner/src/index.ts
import { buildAuditEntry, writeAuditReport, appendAuditEntry } from '@healify/reporter-core'
import type { AuditEntry } from '@healify/reporter-core'

// Add audit entries collector
const auditEntries: AuditEntry[] = []

// In the test failure handler, after analyzeAndHeal()
const auditEntry = buildAuditEntry(
  healResponse,
  { selector: failedSelector, testName: testInfo.title, testFile: testInfo.file },
  {
    errorMessage: error.message,
    domSnippet: await page.content(),  // or more targeted snippet
    screenshotPath: await captureScreenshot(page, testInfo),
    line: testInfo.line,
  }
)
auditEntries.push(auditEntry)
appendAuditEntry(auditEntry, outputDir)

// In the afterAll hook, write the full report
afterAll(() => {
  if (auditEntries.length > 0) {
    writeAuditReport(auditEntries, outputDir, project, 'playwright')
  }
})
```

- [ ] **Step 2: Add screenshot capture helper**

```typescript
// Add to test-runner/src/index.ts
async function captureScreenshot(page: Page, testInfo: TestInfo): Promise<string | undefined> {
  try {
    const screenshotDir = join(outputDir, 'screenshots')
    mkdirSync(screenshotDir, { recursive: true })
    const screenshotPath = join(screenshotDir, `${testInfo.title}-fail.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    return `screenshots/${testInfo.title}-fail.png`
  } catch {
    return undefined
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add test-runner/src/index.ts
git commit -m "feat(playwright): integrate audit logging with screenshots"
```

---

## Task 6: Integrate Audit into Cypress Adapter

**Files:**
- Modify: `cypress-plugin/src/support.ts`

- [ ] **Step 1: Add audit integration to Cypress support**

```typescript
// Add to cypress-plugin/src/support.ts
import { buildAuditEntry, appendAuditEntry } from '@healify/reporter-core'
import type { AuditEntry } from '@healify/reporter-core'

// Add to cy.healifyGet command
Cypress.Commands.add('healifyGet', (selector: string, options?: any) => {
  return cy.get('body').then(($body) => {
    if ($body.find(selector).length > 0) {
      return cy.get(selector, options)
    }
    
    // Capture DOM at failure time
    const domSnippet = $body.html().substring(0, 2000)
    
    // Build audit entry
    const auditEntry = buildAuditEntry(
      { /* heal response */ },
      { selector, testName: Cypress.currentTest?.title ?? 'unknown' },
      { errorMessage: `Selector not found: ${selector}`, domSnippet }
    )
    appendAuditEntry(auditEntry, 'cypress/healify-audit')
    
    // Continue with healing logic
    // ...
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add cypress-plugin/src/support.ts
git commit -m "feat(cypress): integrate audit logging"
```

---

## Task 7: Integrate Audit into Selenium Adapter

**Files:**
- Modify: `selenium-plugin/src/plugin.ts`

- [ ] **Step 1: Add audit integration to Selenium plugin**

```typescript
// Add to selenium-plugin/src/plugin.ts
import { buildAuditEntry, appendAuditEntry } from '@healify/reporter-core'
import type { AuditEntry } from '@healify/reporter-core'

// In the healing function, after analyzeAndHeal()
const domSource = await driver.getPageSource()
const domSnippet = domSource.substring(0, 2000)

const auditEntry = buildAuditEntry(
  healResponse,
  { selector: failedSelector, testName: currentTest },
  { errorMessage, domSnippet }
)
appendAuditEntry(auditEntry, outputDir)
```

- [ ] **Step 2: Run tests**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add selenium-plugin/src/plugin.ts
git commit -m "feat(selenium): integrate audit logging"
```

---

## Task 8: Integrate Audit into WebdriverIO Adapter

**Files:**
- Modify: `webdriverio-plugin/src/plugin.ts`

- [ ] **Step 1: Add audit integration to WebdriverIO plugin**

```typescript
// Add to webdriverio-plugin/src/plugin.ts
import { buildAuditEntry, appendAuditEntry } from '@healify/reporter-core'
import type { AuditEntry } from '@healify/reporter-core'

// In the healing function, after analyzeAndHeal()
const domSource = await browser.getPageSource()
const domSnippet = domSource.substring(0, 2000)

const auditEntry = buildAuditEntry(
  healResponse,
  { selector: failedSelector, testName: currentTest },
  { errorMessage, domSnippet }
)
appendAuditEntry(auditEntry, outputDir)
```

- [ ] **Step 2: Run tests**

Run: `cd C:\Proyectos\QA\Healify && npm run test -- --reporter=verbose`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add webdriverio-plugin/src/plugin.ts
git commit -m "feat(webdriverio): integrate audit logging"
```

---

## Task 9: Cypress Documentation

**Files:**
- Create: `cypress-plugin/README-HEALIFY.md`

- [ ] **Step 1: Create comprehensive README**

```markdown
# @healify/cypress-plugin

Self-healing selectors for Cypress — 100% local, no API key required.

## Installation

```bash
npm install --save-dev @healify/cypress-plugin
```

## Quick Start

### 1. Add to cypress.config.ts

```typescript
import { defineConfig } from 'cypress'
import { registerHealingPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      registerHealingPlugin(on, config)
    },
  },
})
```

### 2. Import support command

```typescript
// cypress/support/e2e.ts
import '@healify/cypress-plugin/support'
```

### 3. Use cy.healifyGet() for fragile selectors

```typescript
// Instead of cy.get('#login-btn')
cy.healifyGet('#login-btn').click()

// Or use it conditionally
cy.healifyGet('[data-testid="submit"]').should('be.visible')
```

### 4. Run tests and fix

```bash
npx playwright test
# 1 failed — selector roto

npx @healify/cli fix
# ✓ e2e/checkout.spec.ts — #add-to-cart-btn → role('button', { name: 'Add' })
```

## How It Works

1. **Test runs** — Cypress uses `cy.healifyGet()` instead of `cy.get()`
2. **Selector fails** — Plugin captures DOM snapshot at failure time
3. **Healify analyzes** — Heuristic engine proposes alternative selectors
4. **Fix applies** — `healify fix` updates your test files
5. **Audit logged** — Every healing event saved to `healify-audit.json`

## Features

- ✅ 100% local — no internet, no API key, no account
- ✅ Heuristic + verification — not AI, deterministic
- ✅ DOM snapshot — captures context at failure time
- ✅ Audit logging — full trail for every healing event
- ✅ Screenshot capture — visual evidence of failure state
- ✅ Confidence scores — know how reliable each fix is

## Commands

| Command | Description |
|---------|-------------|
| `healify doctor` | Check your project and suggest fixes |
| `healify init` | Detect and configure your framework |
| `healify fix` | Apply healed selectors |
| `healify fix --pr` | Apply fixes and create PR |
| `healify explain` | Explain why a selector is fragile |
| `healify history` | View healing history |

## Why Not Cypress AI?

Cypress has `cy.prompt()` which requires AI and an API key. @healify/cypress-plugin:

- **No API key** — works offline, forever free
- **No AI** — deterministic heuristics, predictable results
- **Full audit** — every healing event logged with DOM, screenshot, confidence
- **Multi-framework** — same engine for Playwright, Cypress, Selenium, WebdriverIO

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add cypress-plugin/README-HEALIFY.md
git commit -m "docs(cypress): add comprehensive README for plugin list submission"
```

---

## Task 10: Final Integration Test

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd C:\Proyectos\QA\Healify && npm run test`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `cd C:\Proyectos\QA\Healify && npm run typecheck`
Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `cd C:\Proyectos\QA\Healify && npm run lint`
Expected: No lint errors

- [ ] **Step 4: Verify audit output**

Create a test file that triggers a healing event and verify:
- `healify-audit.json` is created
- Contains all required fields
- DOM hash is present
- Screenshot is captured (if supported)

- [ ] **Step 5: Verify PR workflow**

Run: `cd C:\Proyectos\QA\Healify && npx @healify/cli fix --pr`
Expected:
- Branch created with timestamp
- Commit made with correct message
- Instructions displayed (or PR created if gh is available)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete audit logging, PR workflow, and Cypress positioning"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Audit Module Types and Core Functions | 2 hours |
| 2 | Export Audit from reporter-core | 30 min |
| 3 | PR Workflow Module | 2 hours |
| 4 | Integrate --pr Flag into CLI | 1 hour |
| 5 | Integrate Audit into Playwright Adapter | 2 hours |
| 6 | Integrate Audit into Cypress Adapter | 1.5 hours |
| 7 | Integrate Audit into Selenium Adapter | 1 hour |
| 8 | Integrate Audit into WebdriverIO Adapter | 1 hour |
| 9 | Cypress Documentation | 1 hour |
| 10 | Final Integration Test | 1.5 hours |
| **Total** | | **~14 hours** |

---

## Next Steps After Implementation

1. **Submit to Cypress plugin list** — Open PR in `cypress-io/cypress`
2. **Create demo video** — 2 min showing the workflow
3. **Post to communities** — Cypress Discord, r/Playwright, Hacker News
4. **Monitor feedback** — Adjust based on community response

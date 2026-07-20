# Test Reporter Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@healify/reporter-core` (private), `@healify/test-runner` (Playwright), and `@healify/cypress-plugin` (Cypress) so a broken selector can be reported to Healify's existing `POST /api/v1/report` endpoint from any local machine or CI (GitHub Actions, GitLab CI, Jenkins) — no GitHub OAuth or Railway worker required.

**Architecture:** Three npm-workspace packages at the repo root. `reporter-core` holds the shared HTTP client, selector-extraction regex (migrated from `src/workers/lib/playwright-runner.ts`), and config resolution. `test-runner` wraps it in a Playwright `Reporter` plus a `test` fixture that auto-captures DOM on failure. `cypress-plugin` wraps it in a Cypress `setupNodeEvents` plugin. Neither adapter can ever fail or slow down the user's real test run — all network calls are fire-and-forget with a 3s timeout.

**Tech Stack:** TypeScript (CommonJS output), npm workspaces, `@playwright/test` (peer dep), `cypress` (peer dep), `vitest` for unit tests, Node's built-in `http` module for fake-server integration tests.

**Reference spec:** `docs/superpowers/specs/2026-07-20-test-reporter-packages-design.md`

---

## File Structure

```
package.json                          (MODIFY — add "workspaces")
tsconfig.json                         (MODIFY — exclude new package folders)
.gitignore                            (MODIFY — ignore dist/ and node_modules/ under new packages)

reporter-core/
  package.json                        (CREATE)
  tsconfig.json                       (CREATE)
  src/
    config.ts                         (CREATE)
    selector-extractor.ts             (CREATE)
    http-client.ts                    (CREATE)
    index.ts                          (CREATE)
  src/__tests__/
    config.test.ts                    (CREATE)
    selector-extractor.test.ts        (CREATE)
    http-client.test.ts               (CREATE)
  vitest.config.ts                    (CREATE)

test-runner/
  package.json                        (CREATE)
  tsconfig.json                       (CREATE)
  src/
    fixture.ts                        (CREATE)
    reporter.ts                       (CREATE)
    index.ts                          (CREATE)
  tests/
    playwright.config.ts              (CREATE)
    fixtures/sample.spec.ts           (CREATE)
    fake-server.mjs                   (CREATE)
    verify-fixture-capture.mjs        (CREATE)
    verify-reporter-post.mjs          (CREATE)

cypress-plugin/
  package.json                        (CREATE)
  tsconfig.json                       (CREATE)
  src/
    plugin.ts                         (CREATE)
    index.ts                          (CREATE)
  tests/
    cypress.config.ts                 (CREATE)
    cypress/e2e/sample.cy.ts          (CREATE)
    fake-server.mjs                   (CREATE)
    verify-plugin-post.mjs            (CREATE)
```

---

### Task 1: Workspace scaffolding

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Create: `reporter-core/package.json`, `reporter-core/tsconfig.json`
- Create: `test-runner/package.json`, `test-runner/tsconfig.json`
- Create: `cypress-plugin/package.json`, `cypress-plugin/tsconfig.json`

- [ ] **Step 1: Add the workspaces field to the root `package.json`**

Open `package.json` and add this key at the top level (alongside `"name"`, `"version"`, etc.):

```json
"workspaces": [
  "reporter-core",
  "test-runner",
  "cypress-plugin"
]
```

- [ ] **Step 2: Exclude the new packages from the root TypeScript project**

In `tsconfig.json`, the root project uses `"include": ["**/*.ts", ...]`, which would otherwise try to compile the new packages under the Next.js app's settings. Add the three folders to `"exclude"`:

```json
"exclude": [
  "node_modules",
  "mini-services",
  "examples",
  "scripts",
  "vitest.config.ts",
  "playwright.config.ts",
  "reporter-core",
  "test-runner",
  "cypress-plugin"
]
```

- [ ] **Step 3: Ignore build output and nested node_modules for the new packages**

Append to `.gitignore`:

```
reporter-core/dist
reporter-core/node_modules
test-runner/dist
test-runner/node_modules
test-runner/tests/test-results
cypress-plugin/dist
cypress-plugin/node_modules
cypress-plugin/tests/cypress/screenshots
cypress-plugin/tests/cypress/videos
```

- [ ] **Step 4: Create `reporter-core/package.json`**

```json
{
  "name": "@healify/reporter-core",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 5: Create `reporter-core/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["src/__tests__"]
}
```

- [ ] **Step 6: Create `test-runner/package.json`**

```json
{
  "name": "@healify/test-runner",
  "version": "0.1.0",
  "description": "Healify reporter for Playwright — reports broken selectors without requiring GitHub repo access.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "@playwright/test": ">=1.40.0"
  },
  "dependencies": {
    "@healify/reporter-core": "*"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 7: Create `test-runner/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 8: Create `cypress-plugin/package.json`**

```json
{
  "name": "@healify/cypress-plugin",
  "version": "0.1.0",
  "description": "Healify reporter for Cypress — reports broken selectors without requiring GitHub repo access.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "cypress": ">=13.0.0"
  },
  "dependencies": {
    "@healify/reporter-core": "*"
  },
  "devDependencies": {
    "cypress": "^15.4.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 9: Create `cypress-plugin/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 10: Install workspace dependencies from the repo root**

Run: `npm install`
Expected: npm creates symlinks for `reporter-core`, `test-runner`, `cypress-plugin` under the root `node_modules/@healify/*`, and installs Playwright/Cypress/Vitest/TypeScript as devDependencies for each package. No errors.

- [ ] **Step 11: Verify the main app still typechecks**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0 (same as before this task — the new folders are now excluded).

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json .gitignore reporter-core/package.json reporter-core/tsconfig.json test-runner/package.json test-runner/tsconfig.json cypress-plugin/package.json cypress-plugin/tsconfig.json package-lock.json
git commit -m "chore: scaffold reporter-core, test-runner, cypress-plugin workspaces"
```

---

### Task 2: `reporter-core` — config resolution

**Files:**
- Create: `reporter-core/src/config.ts`
- Test: `reporter-core/src/__tests__/config.test.ts`
- Create: `reporter-core/vitest.config.ts`

- [ ] **Step 1: Create `reporter-core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Write the failing test**

Create `reporter-core/src/__tests__/config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveConfig } from '../config'

const ENV_KEYS = ['HEALIFY_API_KEY', 'HEALIFY_API_URL', 'HEALIFY_BRANCH', 'HEALIFY_COMMIT_SHA'] as const

describe('resolveConfig', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  })

  it('returns null when HEALIFY_API_KEY is not set', () => {
    expect(resolveConfig()).toBeNull()
  })

  it('resolves apiKey and defaults apiUrl when only the key is set', () => {
    process.env.HEALIFY_API_KEY = 'hf_live_test123'
    const config = resolveConfig()
    expect(config).not.toBeNull()
    expect(config?.apiKey).toBe('hf_live_test123')
    expect(config?.apiUrl).toBe('https://healify-sigma.vercel.app')
    expect(config?.branch).toBeUndefined()
    expect(config?.commitSha).toBeUndefined()
  })

  it('resolves all fields when all env vars are set', () => {
    process.env.HEALIFY_API_KEY = 'hf_live_test123'
    process.env.HEALIFY_API_URL = 'http://localhost:3000'
    process.env.HEALIFY_BRANCH = 'feature/x'
    process.env.HEALIFY_COMMIT_SHA = 'abc123'
    const config = resolveConfig()
    expect(config).toEqual({
      apiKey: 'hf_live_test123',
      apiUrl: 'http://localhost:3000',
      branch: 'feature/x',
      commitSha: 'abc123',
    })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `reporter-core/`): `npx vitest run`
Expected: FAIL — `Cannot find module '../config'`

- [ ] **Step 4: Write the implementation**

Create `reporter-core/src/config.ts`:

```ts
export interface HealifyConfig {
  apiKey: string
  apiUrl: string
  branch?: string
  commitSha?: string
}

/**
 * Resolves Healify config from environment variables. Returns null when
 * HEALIFY_API_KEY is not set — callers must treat this as "reporter disabled,
 * do nothing" rather than an error.
 */
export function resolveConfig(): HealifyConfig | null {
  const apiKey = process.env.HEALIFY_API_KEY
  if (!apiKey) return null

  return {
    apiKey,
    apiUrl: process.env.HEALIFY_API_URL || 'https://healify-sigma.vercel.app',
    branch: process.env.HEALIFY_BRANCH,
    commitSha: process.env.HEALIFY_COMMIT_SHA,
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add reporter-core/src/config.ts reporter-core/src/__tests__/config.test.ts reporter-core/vitest.config.ts
git commit -m "feat(reporter-core): add env-based config resolution"
```

---

### Task 3: `reporter-core` — selector extraction

**Files:**
- Create: `reporter-core/src/selector-extractor.ts`
- Test: `reporter-core/src/__tests__/selector-extractor.test.ts`

This migrates the exact regex logic already used in production at `src/workers/lib/playwright-runner.ts:38-55`, so both the Railway worker and the new reporter packages parse Playwright error messages identically.

- [ ] **Step 1: Write the failing test**

Create `reporter-core/src/__tests__/selector-extractor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractSelectorFromError } from '../selector-extractor'

describe('extractSelectorFromError', () => {
  it('extrae selector del error "Waiting for selector"', () => {
    expect(extractSelectorFromError(`Waiting for selector '#login-btn' failed after 30000ms`)).toBe('#login-btn')
  })

  it('extrae selector del error "Element not found"', () => {
    expect(extractSelectorFromError(`Element not found: .submit-button`)).toBe('.submit-button')
  })

  it('extrae selector del error "Unable to locate element"', () => {
    expect(extractSelectorFromError(`Unable to locate element: [data-testid="login"]`)).toBe('[data-testid="login"]')
  })

  it('extrae selector del error "selector ... not found"', () => {
    expect(extractSelectorFromError(`selector '#btn' not found in DOM`)).toBe('#btn')
  })

  it('extrae selector de locator()', () => {
    expect(extractSelectorFromError("page.locator('button.primary') timed out after 30000ms")).toBe('button.primary')
  })

  it('devuelve "Unknown selector" cuando no hay match', () => {
    expect(extractSelectorFromError('Generic random error without selector info')).toBe('Unknown selector')
    expect(extractSelectorFromError('')).toBe('Unknown selector')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run`
Expected: FAIL — `Cannot find module '../selector-extractor'`

- [ ] **Step 3: Write the implementation**

Create `reporter-core/src/selector-extractor.ts`:

```ts
const SELECTOR_PATTERNS = [
  /Waiting for selector ["']([^"']+)["']/,
  /Element not found: (\S+)/,
  /Unable to locate element: (\S+)/,
  /selector ["']([^"']+)["'] not found/,
  / locator\(["']([^"']+)["']\)/,
]

/**
 * Extracts the failing CSS/XPath selector from a Playwright/Cypress error
 * message. Kept in sync with src/workers/lib/playwright-runner.ts so the
 * Railway worker and the reporter packages parse errors identically.
 */
export function extractSelectorFromError(errorMessage: string): string {
  for (const pattern of SELECTOR_PATTERNS) {
    const match = errorMessage.match(pattern)
    if (match) return match[1]
  }
  return 'Unknown selector'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run`
Expected: 9 passed (3 from Task 2 + 6 from this task)

- [ ] **Step 5: Commit**

```bash
git add reporter-core/src/selector-extractor.ts reporter-core/src/__tests__/selector-extractor.test.ts
git commit -m "feat(reporter-core): add extractSelectorFromError, migrated from playwright-runner.ts"
```

---

### Task 4: `reporter-core` — HTTP client

**Files:**
- Create: `reporter-core/src/http-client.ts`
- Test: `reporter-core/src/__tests__/http-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `reporter-core/src/__tests__/http-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportFailure, type ReportPayload } from '../http-client'
import type { HealifyConfig } from '../config'

const config: HealifyConfig = {
  apiKey: 'hf_live_test123',
  apiUrl: 'http://localhost:3000',
}

const basePayload: ReportPayload = {
  testName: 'should log in',
  selector: '#login-btn',
  error: "Waiting for selector '#login-btn' failed",
}

describe('reportFailure', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    warnSpy.mockRestore()
  })

  it('POSTs to {apiUrl}/api/v1/report with the x-api-key header', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    await reportFailure(config, basePayload)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/v1/report')
    expect(init.method).toBe('POST')
    expect(init.headers['x-api-key']).toBe('hf_live_test123')
    expect(init.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(init.body)
    expect(body.testName).toBe('should log in')
    expect(body.selector).toBe('#login-btn')
  })

  it('fills branch/commitSha from config when the payload does not set them', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    const configWithBranch: HealifyConfig = { ...config, branch: 'main', commitSha: 'abc123' }

    await reportFailure(configWithBranch, basePayload)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.branch).toBe('main')
    expect(body.commitSha).toBe('abc123')
  })

  it('truncates context to 8000 characters', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    const longContext = 'x'.repeat(10000)

    await reportFailure(config, { ...basePayload, context: longContext })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.context.length).toBe(8000)
  })

  it('never throws when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    await expect(reportFailure(config, basePayload)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('never throws when the response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(reportFailure(config, basePayload)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('only warns once across multiple failed calls in the same run', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    await reportFailure(config, basePayload)
    await reportFailure(config, basePayload)
    await reportFailure(config, basePayload)

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run`
Expected: FAIL — `Cannot find module '../http-client'`

- [ ] **Step 3: Write the implementation**

Create `reporter-core/src/http-client.ts`:

```ts
import type { HealifyConfig } from './config'

export interface ReportPayload {
  testName: string
  testFile?: string
  selector: string
  error: string
  context?: string
  selectorType?: 'CSS' | 'XPATH' | 'TESTID' | 'ROLE' | 'TEXT' | 'UNKNOWN'
  branch?: string
  commitSha?: string
}

const TIMEOUT_MS = 3000
const MAX_CONTEXT_CHARS = 8000

// Module-level flag: warn at most once per process (one process = one test run).
let hasWarned = false

/**
 * Reports a test failure to Healify. Never throws — a failure here must
 * never break or slow down the caller's real test run. Any error is logged
 * once via console.warn and then swallowed.
 */
export async function reportFailure(config: HealifyConfig, payload: ReportPayload): Promise<void> {
  const body: ReportPayload = {
    ...payload,
    context: payload.context?.slice(0, MAX_CONTEXT_CHARS),
    branch: payload.branch ?? config.branch,
    commitSha: payload.commitSha ?? config.commitSha,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${config.apiUrl}/api/v1/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) warnOnce(`Healify report failed (HTTP ${res.status})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnOnce(`could not reach Healify (${message})`)
  } finally {
    clearTimeout(timeout)
  }
}

function warnOnce(message: string): void {
  if (hasWarned) return
  hasWarned = true
  console.warn(`[healify] ${message} — your tests are unaffected`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run`
Expected: 15 passed (9 from Tasks 2-3 + 6 from this task)

- [ ] **Step 5: Commit**

```bash
git add reporter-core/src/http-client.ts reporter-core/src/__tests__/http-client.test.ts
git commit -m "feat(reporter-core): add reportFailure HTTP client with timeout and warn-once"
```

---

### Task 5: `reporter-core` — barrel export and build verification

**Files:**
- Create: `reporter-core/src/index.ts`

- [ ] **Step 1: Create the barrel export**

Create `reporter-core/src/index.ts`:

```ts
export { resolveConfig, type HealifyConfig } from './config'
export { extractSelectorFromError } from './selector-extractor'
export { reportFailure, type ReportPayload } from './http-client'
```

- [ ] **Step 2: Build the package**

Run (from `reporter-core/`): `npm run build`
Expected: `dist/index.js`, `dist/index.d.ts`, `dist/config.js`, `dist/selector-extractor.js`, `dist/http-client.js` are created, no TypeScript errors.

- [ ] **Step 3: Verify all reporter-core tests still pass**

Run: `npx vitest run`
Expected: 15 passed

- [ ] **Step 4: Commit**

```bash
git add reporter-core/src/index.ts
git commit -m "feat(reporter-core): add barrel export"
```

---

### Task 6: `test-runner` — DOM-capturing fixture

**Files:**
- Create: `test-runner/src/fixture.ts`
- Create: `test-runner/tests/playwright.config.ts`
- Create: `test-runner/tests/fixtures/sample.spec.ts`
- Create: `test-runner/tests/verify-fixture-capture.mjs`

This is the piece that captures `page.content()` automatically when a test fails, per the approved design (Playwright's `Reporter` interface has no access to `page`, so capture must happen in a fixture, not the reporter).

- [ ] **Step 1: Write the fixture**

Create `test-runner/src/fixture.ts`:

```ts
import { test as base } from '@playwright/test'

const MAX_DOM_CHARS = 8000
const ATTACHMENT_NAME = 'healify-dom'

/**
 * Drop-in replacement for `test` from '@playwright/test'. Captures the
 * page's HTML on failure and attaches it as `healify-dom`, which
 * HealifyReporter reads to send as `context` in the failure report.
 *
 * If capturing fails (page already closed/crashed), the error is swallowed —
 * the test already failed on its own; we must never add a second failure.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page)

    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const html = await page.content()
        await testInfo.attach(ATTACHMENT_NAME, {
          body: html.slice(0, MAX_DOM_CHARS),
          contentType: 'text/html',
        })
      } catch {
        // Intentionally ignored — see doc comment above.
      }
    }
  },
})

export { expect } from '@playwright/test'
```

- [ ] **Step 2: Create a Playwright test project that exercises the fixture**

Create `test-runner/tests/fixtures/sample.spec.ts`:

```ts
import { test } from '../../src/fixture'

test('fails on purpose so the fixture captures the DOM', async ({ page }) => {
  await page.setContent('<html><body><button id="real-button">Click me</button></body></html>')
  await page.click('#does-not-exist', { timeout: 1000 })
})
```

- [ ] **Step 3: Create the Playwright config for this test project**

Create `test-runner/tests/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './fixtures',
  reporter: [['json', { outputFile: 'test-results/report.json' }]],
  use: { headless: true },
})
```

- [ ] **Step 4: Install Playwright's browser binary (one-time, needed to actually run a test)**

Run (from `test-runner/`): `npx playwright install chromium`
Expected: Chromium downloads successfully.

- [ ] **Step 5: Run the sample test and confirm it fails as expected**

Run (from `test-runner/`): `npx playwright test -c tests/playwright.config.ts`
Expected: 1 failed (this is the correct, intentional failure — the test clicks a selector that doesn't exist).

- [ ] **Step 6: Write the verification script**

Create `test-runner/tests/verify-fixture-capture.mjs`:

```js
import { readFileSync } from 'node:fs'

const report = JSON.parse(readFileSync('test-results/report.json', 'utf-8'))
const spec = report.suites[0].specs[0]
const result = spec.tests[0].results[0]
const attachment = result.attachments.find((a) => a.name === 'healify-dom')

if (!attachment) {
  console.error('FAIL: no healify-dom attachment found on the failed test')
  process.exit(1)
}
if (!attachment.body) {
  console.error('FAIL: healify-dom attachment has no body')
  process.exit(1)
}
const html = Buffer.from(attachment.body, 'base64').toString('utf-8')
if (!html.includes('real-button')) {
  console.error(`FAIL: captured DOM does not contain expected content. Got: ${html}`)
  process.exit(1)
}

console.log('PASS: healify-dom attachment captured with expected content')
```

- [ ] **Step 7: Run the verification script**

Run (from `test-runner/tests/`): `node verify-fixture-capture.mjs`
Expected: `PASS: healify-dom attachment captured with expected content`

- [ ] **Step 8: Commit**

```bash
git add test-runner/src/fixture.ts test-runner/tests/playwright.config.ts test-runner/tests/fixtures/sample.spec.ts test-runner/tests/verify-fixture-capture.mjs
git commit -m "feat(test-runner): add DOM-capturing fixture, verified against a real Playwright run"
```

---

### Task 7: `test-runner` — HealifyReporter

**Files:**
- Create: `test-runner/src/reporter.ts`
- Create: `test-runner/tests/fake-server.mjs`
- Create: `test-runner/tests/verify-reporter-post.mjs`

- [ ] **Step 1: Write the reporter**

Create `test-runner/src/reporter.ts`:

```ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { resolveConfig, reportFailure, extractSelectorFromError, type HealifyConfig } from '@healify/reporter-core'

const ATTACHMENT_NAME = 'healify-dom'

export default class HealifyReporter implements Reporter {
  private config: HealifyConfig | null

  constructor() {
    this.config = resolveConfig()
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.config) return
    if (result.status !== 'failed' && result.status !== 'timedOut') return

    const errorMessage = result.error?.message ?? result.errors[0]?.message ?? 'Unknown error'
    const domAttachment = result.attachments.find((a) => a.name === ATTACHMENT_NAME)
    const context = domAttachment?.body?.toString('utf-8')

    void reportFailure(this.config, {
      testName: test.titlePath().slice(1).join(' > '),
      testFile: test.location.file,
      selector: extractSelectorFromError(errorMessage),
      error: errorMessage,
      context,
    })
  }
}
```

- [ ] **Step 2: Write a fake server that captures the POST body to a file**

Create `test-runner/tests/fake-server.mjs`:

```js
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'

const server = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    writeFileSync('test-results/captured-request.json', JSON.stringify({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.parse(body),
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  })
})

server.listen(4567, () => {
  console.log('fake healify server listening on :4567')
})
```

- [ ] **Step 3: Add the reporter to the test Playwright config, pointed at the fake server**

Modify `test-runner/tests/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './fixtures',
  reporter: [
    ['json', { outputFile: 'test-results/report.json' }],
    ['../src/reporter.ts'],
  ],
  use: { headless: true },
})
```

- [ ] **Step 4: Write the verification script**

Create `test-runner/tests/verify-reporter-post.mjs`:

```js
import { readFileSync } from 'node:fs'

const captured = JSON.parse(readFileSync('test-results/captured-request.json', 'utf-8'))

if (captured.method !== 'POST') {
  console.error(`FAIL: expected POST, got ${captured.method}`)
  process.exit(1)
}
if (captured.url !== '/api/v1/report') {
  console.error(`FAIL: expected /api/v1/report, got ${captured.url}`)
  process.exit(1)
}
if (captured.headers['x-api-key'] !== 'hf_live_faketest') {
  console.error(`FAIL: expected x-api-key hf_live_faketest, got ${captured.headers['x-api-key']}`)
  process.exit(1)
}
if (captured.body.selector !== 'does-not-exist') {
  console.error(`FAIL: expected selector 'does-not-exist', got ${captured.body.selector}`)
  process.exit(1)
}
if (!captured.body.context || !captured.body.context.includes('real-button')) {
  console.error(`FAIL: expected context to include captured DOM. Got: ${captured.body.context}`)
  process.exit(1)
}

console.log('PASS: HealifyReporter posted the expected payload to the fake server')
```

- [ ] **Step 5: Run the fake server, the test, and the verification — in sequence**

Run (from `test-runner/`):
```bash
node tests/fake-server.mjs &
SERVER_PID=$!
sleep 1
HEALIFY_API_KEY=hf_live_faketest HEALIFY_API_URL=http://localhost:4567 npx playwright test -c tests/playwright.config.ts
node tests/verify-reporter-post.mjs
kill $SERVER_PID
```
Expected: playwright test shows 1 failed (intentional), then `PASS: HealifyReporter posted the expected payload to the fake server`.

- [ ] **Step 6: Commit**

```bash
git add test-runner/src/reporter.ts test-runner/tests/fake-server.mjs test-runner/tests/verify-reporter-post.mjs test-runner/tests/playwright.config.ts
git commit -m "feat(test-runner): add HealifyReporter, verified end-to-end against a fake server"
```

---

### Task 8: `test-runner` — barrel export and package build

**Files:**
- Create: `test-runner/src/index.ts`

- [ ] **Step 1: Create the barrel export**

Create `test-runner/src/index.ts`:

```ts
export { test, expect } from './fixture'
export { default as HealifyReporter } from './reporter'
```

- [ ] **Step 2: Build the package**

Run (from `test-runner/`): `npm run build`
Expected: `dist/index.js`, `dist/index.d.ts`, `dist/fixture.js`, `dist/reporter.js` created, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add test-runner/src/index.ts
git commit -m "feat(test-runner): add barrel export"
```

---

### Task 9: `cypress-plugin` — HealifyCypressPlugin

**Files:**
- Create: `cypress-plugin/src/plugin.ts`
- Create: `cypress-plugin/tests/cypress.config.ts`
- Create: `cypress-plugin/tests/cypress/e2e/sample.cy.ts`
- Create: `cypress-plugin/tests/fake-server.mjs`
- Create: `cypress-plugin/tests/verify-plugin-post.mjs`

Cypress has no per-test hook with browser access from the plugin process (unlike Playwright's fixture), so `context` stays empty in v1 unless the spec attaches HTML itself — this matches the documented limitation in the design spec, §4.

- [ ] **Step 1: Write the plugin**

Create `cypress-plugin/src/plugin.ts`:

```ts
import type { PluginEvents, PluginConfigOptions } from 'cypress'
import { resolveConfig, reportFailure, extractSelectorFromError } from '@healify/reporter-core'

export function HealifyCypressPlugin(
  on: PluginEvents,
  config: PluginConfigOptions
): PluginConfigOptions {
  const healifyConfig = resolveConfig()
  if (!healifyConfig) return config

  on('after:spec', (spec, results) => {
    for (const test of results.tests ?? []) {
      if (test.state !== 'failed') continue

      const errorMessage = test.displayError ?? 'Unknown error'
      void reportFailure(healifyConfig, {
        testName: test.title.join(' > '),
        testFile: spec.relative,
        selector: extractSelectorFromError(errorMessage),
        error: errorMessage,
      })
    }
  })

  return config
}
```

- [ ] **Step 2: Write a fake server that captures the POST body (same shape as Task 7)**

Create `cypress-plugin/tests/fake-server.mjs`:

```js
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'

const server = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    writeFileSync('captured-request.json', JSON.stringify({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.parse(body),
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  })
})

server.listen(4568, () => {
  console.log('fake healify server listening on :4568')
})
```

- [ ] **Step 3: Write a Cypress spec that fails on purpose**

Create `cypress-plugin/tests/cypress/e2e/sample.cy.ts`:

```ts
describe('sample failing spec', () => {
  it('fails on purpose so the plugin reports it', () => {
    cy.document().then((doc) => {
      doc.body.innerHTML = '<button id="real-button">Click me</button>'
    })
    cy.get('#does-not-exist', { timeout: 1000 }).click()
  })
})
```

- [ ] **Step 4: Write the Cypress config wiring the plugin**

Create `cypress-plugin/tests/cypress.config.ts`:

```ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '../src/plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return HealifyCypressPlugin(on, config)
    },
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
})
```

- [ ] **Step 5: Write the verification script**

Create `cypress-plugin/tests/verify-plugin-post.mjs`:

```js
import { readFileSync } from 'node:fs'

const captured = JSON.parse(readFileSync('captured-request.json', 'utf-8'))

if (captured.method !== 'POST') {
  console.error(`FAIL: expected POST, got ${captured.method}`)
  process.exit(1)
}
if (captured.url !== '/api/v1/report') {
  console.error(`FAIL: expected /api/v1/report, got ${captured.url}`)
  process.exit(1)
}
if (captured.headers['x-api-key'] !== 'hf_live_faketest') {
  console.error(`FAIL: expected x-api-key hf_live_faketest, got ${captured.headers['x-api-key']}`)
  process.exit(1)
}
if (captured.body.selector !== 'does-not-exist') {
  console.error(`FAIL: expected selector 'does-not-exist', got ${captured.body.selector}`)
  process.exit(1)
}

console.log('PASS: HealifyCypressPlugin posted the expected payload to the fake server')
```

- [ ] **Step 6: Run the fake server, the Cypress spec, and the verification — in sequence**

Run (from `cypress-plugin/`):
```bash
node tests/fake-server.mjs &
SERVER_PID=$!
sleep 1
cd tests
HEALIFY_API_KEY=hf_live_faketest HEALIFY_API_URL=http://localhost:4568 npx cypress run --config-file cypress.config.ts
cd ..
node tests/verify-plugin-post.mjs
kill $SERVER_PID
```
Expected: Cypress reports 1 failing test (intentional), then `PASS: HealifyCypressPlugin posted the expected payload to the fake server`.

- [ ] **Step 7: Commit**

```bash
git add cypress-plugin/src/plugin.ts cypress-plugin/tests/cypress.config.ts cypress-plugin/tests/cypress/e2e/sample.cy.ts cypress-plugin/tests/fake-server.mjs cypress-plugin/tests/verify-plugin-post.mjs
git commit -m "feat(cypress-plugin): add HealifyCypressPlugin, verified end-to-end against a fake server"
```

---

### Task 10: `cypress-plugin` — barrel export and package build

**Files:**
- Create: `cypress-plugin/src/index.ts`

- [ ] **Step 1: Create the barrel export**

Create `cypress-plugin/src/index.ts`:

```ts
export { HealifyCypressPlugin } from './plugin'
```

- [ ] **Step 2: Build the package**

Run (from `cypress-plugin/`): `npm run build`
Expected: `dist/index.js`, `dist/index.d.ts`, `dist/plugin.js` created, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add cypress-plugin/src/index.ts
git commit -m "feat(cypress-plugin): add barrel export"
```

---

### Task 11: Manual end-to-end verification against the real Healify project

**Files:** none (verification only — no repo changes expected unless a bug is found)

This confirms the built `test-runner` package works against the **real** `/api/v1/report` endpoint and the real AI engine, using the `Healify` project already connected in the dashboard (`mescobar996/Healify`, created during this session's manual testing) and its real project API key.

- [ ] **Step 1: Get the project's real API key**

In the running dashboard (`http://localhost:3000/dashboard/projects`), open the `Healify` project's settings and copy its API key (starts with `hf_`). If the project doesn't have one yet, the settings page has a "generate API key" action.

- [ ] **Step 2: Create a scratch Playwright project outside the repo**

```bash
mkdir /tmp/healify-reporter-smoketest
cd /tmp/healify-reporter-smoketest
npm init -y
npm install --save-dev @playwright/test
npm install "C:/Proyectos/QA/Healify/test-runner"
npx playwright install chromium
```

- [ ] **Step 3: Write a failing test using the real package**

Create `/tmp/healify-reporter-smoketest/sample.spec.ts`:

```ts
import { test } from '@healify/test-runner'

test('fails on purpose to trigger a real Healify report', async ({ page }) => {
  await page.setContent('<html><body><button data-testid="real-submit-btn">Submit</button></body></html>')
  await page.click('#old-submit-id', { timeout: 1000 })
})
```

- [ ] **Step 4: Write the Playwright config using `HealifyReporter`**

Create `/tmp/healify-reporter-smoketest/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
import { HealifyReporter } from '@healify/test-runner'

export default defineConfig({
  reporter: [['list'], [HealifyReporter, {}]],
})
```

- [ ] **Step 5: Run it against the real local dashboard**

Run (with the Healify dev server already running on `localhost:3000`, from `/tmp/healify-reporter-smoketest/`):

```bash
HEALIFY_API_KEY=<the real key from Step 1> HEALIFY_API_URL=http://localhost:3000 npx playwright test
```

Expected: 1 failed (intentional). No crash, no hang.

- [ ] **Step 6: Confirm the healing event landed in the dashboard**

Open `http://localhost:3000/dashboard/tests` and confirm a new test run for the `Healify` project appeared, with a `HealingEvent` referencing selector `#old-submit-id` and a suggested new selector. This proves the whole chain works: reporter package → real `/api/v1/report` → real AI engine → dashboard.

- [ ] **Step 7: Record the result**

If it worked end-to-end, note it in `qa-reports/Informe-Dev-Healify.md` under a new dated entry. If something failed, that's a real bug in the package (not a plan step) — fix it in the relevant task's file before moving on, then re-run this task.

---

## Notes for whoever picks this up

- Do **not** implement Vitest or Selenium adapters as part of this plan — out of scope per the spec (§2, non-goals).
- Do **not** touch the GitHub OAuth scope bug (documented separately in `qa-reports/Informe-Dev-Healify.md`, section 0) — this plan's whole point is to let detection work *without* needing that fixed.
- Publishing the packages to npm (versioning, CI publish workflow) is intentionally not part of this plan — see spec §7.

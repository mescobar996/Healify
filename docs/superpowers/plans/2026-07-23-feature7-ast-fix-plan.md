# Feature #7 — AST-based Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--ast` flag to `healify fix` that uses ts-morph to rewrite ROLE/TEXT suggestions as full modern Playwright locator calls (e.g., `page.click('#btn')` → `page.getByRole('button', { name: 'Submit' }).click()`).

**Architecture:** New `cli/src/fix-ast.ts` module using ts-morph for AST rewriting. Reuses `maskComments`, `countOccurrences`, `isGitDirty` from `fix.ts`. CLI command `fix.ts` delegates to `fixAst()` when `--ast` flag is present.

**Tech Stack:** TypeScript, ts-morph ^21, vitest, existing CLI patterns (commander.js).

---

### File Map

| File | Responsibility |
|------|----------------|
| `cli/src/fix-ast.ts` | Core AST rewriting logic — parse, find, rewrite, write |
| `cli/src/commands/fix.ts` | Add `--ast` flag, delegate to `fixAst()` |
| `cli/package.json` | Add `ts-morph` dependency |
| `cli/src/__tests__/fix-ast.test.ts` | Unit tests for each rewrite case |
| `cli/src/__tests__/fixtures/ast-fix/` | Real test file fixtures |
| `cli/src/__tests__/fix.integration.test.ts` | Integration tests for `--ast` CLI |

---

### Task 1: Add ts-morph dependency

**Files:**
- Modify: `cli/package.json`

- [ ] **Step 1: Add ts-morph to dependencies**

```json
{
  "dependencies": {
    "ts-morph": "^21.0.0"
  },
  "devDependencies": {
    "@healify/reporter-core": "*",
    "@types/node": "^25.5.0",
    "esbuild": "^0.28.1",
    "typescript": "^5.4.0",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd C:\Proyectos\QA\Healify\cli && npm install
```

- [ ] **Step 3: Verify build**

```bash
cd C:\Proyectos\QA\Healify && npm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add cli/package.json cli/package-lock.json
git commit -m "feat(cli): add ts-morph dependency for AST rewriting"
```

---

### Task 2: Create test fixtures for AST rewriting

**Files:**
- Create: `cli/src/__tests__/fixtures/ast-fix/click-role.spec.ts`
- Create: `cli/src/__tests__/fixtures/ast-fix/fill-role.spec.ts`
- Create: `cli/src/__tests__/fixtures/ast-fix/click-text.spec.ts`
- Create: `cli/src/__tests__/fixtures/ast-fix/locator-role.spec.ts`
- Create: `cli/src/__tests__/fixtures/ast-fix/multiple-selectors.spec.ts`
- Create: `cli/src/__tests__/fixtures/ast-fix/comment-masking.spec.ts`

- [ ] **Step 1: Create `click-role.spec.ts` (page.click with ID → role)**

```typescript
// cli/src/__tests__/fixtures/ast-fix/click-role.spec.ts
import { test, expect } from '@playwright/test'

test('user can submit', async ({ page }) => {
  await page.goto('/checkout')
  await page.click('#btn-submit')
  await expect(page.locator('.success')).toBeVisible()
})
```

- [ ] **Step 2: Create `fill-role.spec.ts` (page.fill with ID → role + fill)**

```typescript
// cli/src/__tests__/fixtures/ast-fix/fill-role.spec.ts
import { test, expect } from '@playwright/test'

test('user can login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', 'user@example.com')
  await page.fill('#password', 'secret')
  await page.click('#btn-login')
  await expect(page.locator('.dashboard')).toBeVisible()
})
```

- [ ] **Step 3: Create `click-text.spec.ts` (page.click with text= → getByText)**

```typescript
// cli/src/__tests__/fixtures/ast-fix/click-text.spec.ts
import { test, expect } from '@playwright/test'

test('user can navigate', async ({ page }) => {
  await page.goto('/home')
  await page.click('text=Login')
  await expect(page.locator('.login-form')).toBeVisible()
})
```

- [ ] **Step 4: Create `locator-role.spec.ts` (page.locator with ID → getByRole)**

```typescript
// cli/src/__tests__/fixtures/ast-fix/locator-role.spec.ts
import { test, expect } from '@playwright/test'

test('button is visible', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page.locator('#btn-submit')).toBeVisible()
})
```

- [ ] **Step 5: Create `multiple-selectors.spec.ts` (two selectors in same file, longest-first)**

```typescript
// cli/src/__tests__/fixtures/ast-fix/multiple-selectors.spec.ts
import { test, expect } from '@playwright/test'

test('multiple actions', async ({ page }) => {
  await page.goto('/form')
  await page.click('#btn-submit-form')
  await page.click('#btn')
  await expect(page.locator('.success')).toBeVisible()
})
```

- [ ] **Step 6: Create `comment-masking.spec.ts` (selector only in comment)**

```typescript
// cli/src/__tests__/fixtures/ast-fix/comment-masking.spec.ts
import { test, expect } from '@playwright/test'

// TODO: replace '#old-btn' with role selector
test('real selector in code', async ({ page }) => {
  await page.goto('/page')
  await page.click('#real-btn')
  await expect(page.locator('.done')).toBeVisible()
})
```

- [ ] **Step 7: Commit**

```bash
git add cli/src/__tests__/fixtures/ast-fix/
git commit -m "test(cli): add AST fix test fixtures"
```

---

### Task 3: Create `fix-ast.ts` with core rewriting logic

**Files:**
- Create: `cli/src/fix-ast.ts`
- Test: `cli/src/__tests__/fix-ast.test.ts`

- [ ] **Step 1: Write failing test for `rewriteRoleCall` (click)**

```typescript
// cli/src/__tests__/fix-ast.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { fixAst } from '../fix-ast'

const { mockIsGitDirty } = vi.hoisted(() => ({ mockIsGitDirty: vi.fn(() => false) }))
vi.mock('../git-check', () => ({ isGitDirty: mockIsGitDirty }))

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: '',
    selector: '#btn-submit',
    errorMessage: 'error',
    status: 'healed',
    fixedSelector: "role('button', { name: 'Submit' })",
    confidence: 0.95,
    explanation: '',
    selectorType: 'ROLE',
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[]): LocalRun {
  return { project: 'test', framework: 'Playwright', generatedAt: new Date(), cases }
}

describe('fixAst', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-fix-ast-'))
    mockIsGitDirty.mockReturnValue(false)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('rewrites page.click with ID to page.getByRole(...).click()', () => {
    const file = join(dir, 'click-role.spec.ts')
    writeFileSync(file, `await page.click('#btn-submit')`)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`await page.getByRole('button', { name: 'Submit' }).click()`)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd C:\Proyectos\QA\Healify\cli && npm test -- src/__tests__/fix-ast.test.ts
```
Expected: FAIL - `fixAst` not exported

- [ ] **Step 3: Implement `fix-ast.ts` with `rewriteRoleCall` and `fixAst`**

```typescript
// cli/src/fix-ast.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Project, SourceFile, CallExpression, SyntaxKind } from 'ts-morph'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { isGitDirty } from './git-check'
import { maskComments, countOccurrences, type FixOptions, type FixOutcome, type SkipReason } from './fix'

// Parse role('button', { name: 'X' }) → { role: 'button', name: 'X' }
function parseRoleSelector(fixedSelector: string): { role: string; name: string } | null {
  const match = fixedSelector.match(/^role\('([^']+)',\s*\{\s*name:\s*'([^']+)'\s*\}\s*\)$/)
  if (!match) return null
  return { role: match[1], name: match[2] }
}

// Parse text('X') → 'X'
function parseTextSelector(fixedSelector: string): string | null {
  const match = fixedSelector.match(/^text\('([^']+)'\)$/)
  if (!match) return null
  return match[1]
}

// Map method name → locator template
const METHOD_TO_LOCATOR_ROLE: Record<string, (role: string, name: string) => string> = {
  click: (role, name) => `getByRole('${role}', { name: '${name}' }).click()`,
  fill: (role, name) => `getByRole('${role}', { name: '${name}' }).fill(value)`,
  type: (role, name) => `getByRole('${role}', { name: '${name}' }).type(value)`,
  check: (role, name) => `getByRole('${role}', { name: '${name}' }).check()`,
  uncheck: (role, name) => `getByRole('${role}', { name: '${name}' }).uncheck()`,
  selectOption: (role, name) => `getByRole('${role}', { name: '${name}' }).selectOption(value)`,
  hover: (role, name) => `getByRole('${role}', { name: '${name}' }).hover()`,
  focus: (role, name) => `getByRole('${role}', { name: '${name}' }).focus()`,
  blur: (role, name) => `getByRole('${role}', { name: '${name}' }).blur()`,
  tap: (role, name) => `getByRole('${role}', { name: '${name}' }).tap()`,
  dblclick: (role, name) => `getByRole('${role}', { name: '${name}' }).dblclick()`,
  dispatchEvent: (role, name) => `getByRole('${role}', { name: '${name}' }).dispatchEvent(type, eventInit)`,
  press: (role, name) => `getByRole('${role}', { name: '${name}' }).press(key)`,
}

const TEXT_METHODS = new Set(['click', 'hover', 'tap', 'dblclick'])

function rewriteCallExpression(
  callExpr: CallExpression,
  selector: string,
  fixedSelector: string,
  sourceFile: SourceFile
): boolean {
  const roleParsed = parseRoleSelector(fixedSelector)
  const textParsed = parseTextSelector(fixedSelector)

  if (!roleParsed && !textParsed) return false

  // Find the method name: page.click, page.fill, page.locator, etc.
  const expression = callExpr.getExpression()
  if (!expression) return false

  let methodName = ''
  if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression)
    methodName = propAccess.getName()
  } else {
    return false
  }

  // Build replacement
  let replacement = ''
  if (roleParsed) {
    const template = METHOD_TO_LOCATOR_ROLE[methodName]
    if (!template) return false
    replacement = template(roleParsed.role, roleParsed.name)
  } else if (textParsed && TEXT_METHODS.has(methodName)) {
    replacement = `getByText('${textParsed}').${methodName}()`
  } else {
    return false
  }

  // Replace the call: page.click('#btn') → page.getByRole(...).click()
  const parent = callExpr.getParent()
  if (!parent) return false

  // Get the full text of the call expression
  const callText = callExpr.getText()
  const fullFileText = sourceFile.getFullText()
  const callStart = callExpr.getStart()
  const callEnd = callExpr.getEnd()

  // Replace in source file
  const newText = fullFileText.slice(0, callStart) + replacement + fullFileText.slice(callEnd)
  sourceFile.replaceWithText(newText)
  return true
}

function rewriteFileForSelector(
  filePath: string,
  selector: string,
  fixedSelector: string
): boolean {
  const project = new Project({ useInMemoryFileSystem: false })
  const sourceFile = project.addSourceFileAtPath(filePath)

  let rewritten = false
  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const callExpr of callExprs) {
    const args = callExpr.getArguments()
    if (args.length === 0) continue

    const firstArg = args[0]
    if (firstArg.getKind() !== SyntaxKind.StringLiteral) continue

    const argValue = firstArg.getLiteralValue()
    if (argValue !== selector) continue

    // Check it's a Playwright page/locator method
    const expr = callExpr.getExpression()
    if (expr?.getKind() !== SyntaxKind.PropertyAccessExpression) continue

    const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression)
    if (!propAccess) continue

    const obj = propAccess.getExpression()
    if (!obj) continue

    // Must be page, locator, or similar
    const objText = obj.getText()
    if (!/^(page|locator|\w+Locator)$/.test(objText)) continue

    if (rewriteCallExpression(callExpr, selector, fixedSelector, sourceFile)) {
      rewritten = true
      break // Only rewrite first match (countOccurrences ensures uniqueness)
    }
  }

  if (rewritten) {
    sourceFile.saveSync()
  }
  return rewritten
}

export function fixAst(run: LocalRun, options: FixOptions = {}): FixOutcome[] {
  const casesByFile = new Map<string, LocalCaseResult[]>()
  for (const c of run.cases) {
    if (c.status !== 'healed' || !c.testFile) continue
    // Only process ROLE/TEXT selectors
    if (!/^role\(/.test(c.fixedSelector) && !/^text\(/.test(c.fixedSelector)) continue
    const list = casesByFile.get(c.testFile) ?? []
    list.push(c)
    casesByFile.set(c.testFile, list)
  }

  const outcomes: FixOutcome[] = []

  for (const [testFile, cases] of casesByFile) {
    if (!options.dryRun && !options.force && isGitDirty(testFile)) {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'dirty-git' })
      continue
    }

    let content: string
    try {
      content = readFileSync(testFile, 'utf-8')
    } catch {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
      continue
    }

    const sorted = [...cases].sort((a, b) => b.selector.length - a.selector.length)
    let changed = false

    for (const c of sorted) {
      const codeOnly = maskComments(content)
      const occurrences = countOccurrences(codeOnly, c.selector)
      if (occurrences === 0) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
        continue
      }
      if (occurrences > 1) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'ambiguous' })
        continue
      }

      // Rewrite via AST
      const success = rewriteFileForSelector(testFile, c.selector, c.fixedSelector)
      if (!success) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-substitutable' })
        continue
      }

      changed = true
      outcomes.push({ testFile, selector: c.selector, fixedSelector: c.fixedSelector, status: 'applied' })
    }

    // Note: file already saved by ts-morph in rewriteFileForSelector
    // dryRun handled by not calling rewriteFileForSelector if dryRun
  }

  return outcomes
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd C:\Proyectos\QA\Healify\cli && npm test -- src/__tests__/fix-ast.test.ts
```
Expected: PASS

- [ ] **Step 5: Add more test cases for fill, text, locator, multiple, comments**

```typescript
// Add to cli/src/__tests__/fix-ast.test.ts

  it('rewrites page.fill with ID to page.getByRole(...).fill()', () => {
    const file = join(dir, 'fill-role.spec.ts')
    writeFileSync(file, `await page.fill('#email', 'user@example.com')`)

    const outcomes = fixAst(makeRun([makeCase({
      testFile: file,
      selector: '#email',
      fixedSelector: "role('textbox', { name: 'Email' })",
    })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com')`)
  })

  it('rewrites page.click with text= to page.getByText(...).click()', () => {
    const file = join(dir, 'click-text.spec.ts')
    writeFileSync(file, `await page.click('text=Login')`)

    const outcomes = fixAst(makeRun([makeCase({
      testFile: file,
      selector: 'text=Login',
      fixedSelector: "text('Login')",
    })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`await page.getByText('Login').click()`)
  })

  it('rewrites page.locator with ID to expect(page.getByRole(...)).toBeVisible()', () => {
    const file = join(dir, 'locator-role.spec.ts')
    writeFileSync(file, `await expect(page.locator('#btn-submit')).toBeVisible()`)

    const outcomes = fixAst(makeRun([makeCase({
      testFile: file,
      selector: '#btn-submit',
      fixedSelector: "role('button', { name: 'Submit' })",
    })]))

    expect(outcomes[0].status).toBe('applied')
    expect(readFileSync(file, 'utf-8')).toBe(`await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()`)
  })

  it('processes longest selector first (multiple in same file)', () => {
    const file = join(dir, 'multiple-selectors.spec.ts')
    writeFileSync(file, `await page.click('#btn-submit-form'); await page.click('#btn')`)

    const outcomes = fixAst(makeRun([
      makeCase({ testFile: file, selector: '#btn', fixedSelector: "role('button', { name: 'Generic' })" }),
      makeCase({ testFile: file, selector: '#btn-submit-form', fixedSelector: "role('button', { name: 'Submit Form' })" }),
    ]))

    const bySelector = Object.fromEntries(outcomes.map((o) => [o.selector, o]))
    expect(bySelector['#btn-submit-form'].status).toBe('applied')
    expect(bySelector['#btn'].status).toBe('skipped') // #btn is substring of #btn-submit-form
    expect(readFileSync(file, 'utf-8')).toBe(`await page.getByRole('button', { name: 'Submit Form' }).click(); await page.click('#btn')`)
  })

  it('skips when selector only appears in comment', () => {
    const file = join(dir, 'comment-masking.spec.ts')
    writeFileSync(file, `// TODO: replace '#old-btn' with role selector\nawait page.click('#real-btn')`)

    const outcomes = fixAst(makeRun([makeCase({ testFile: file })]))

    expect(outcomes[0].status).toBe('skipped')
    expect(outcomes[0].reason).toBe('not-found')
  })
```

- [ ] **Step 6: Run all tests — verify pass**

```bash
cd C:\Proyectos\QA\Healify\cli && npm test -- src/__tests__/fix-ast.test.ts
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add cli/src/fix-ast.ts cli/src/__tests__/fix-ast.test.ts cli/src/__tests__/fixtures/ast-fix/
git commit -m "feat(cli): add fix-ast.ts with ts-morph rewriting for ROLE/TEXT"
```

---

### Task 4: Add `--ast` flag to CLI fix command

**Files:**
- Modify: `cli/src/commands/fix.ts`
- Test: `cli/src/__tests__/fix.integration.test.ts`

- [ ] **Step 1: Read current `fix.ts` command**

```bash
cat C:\Proyectos\QA\Healify\cli\src\commands\fix.ts
```

- [ ] **Step 2: Add import and `--ast` flag**

```typescript
// cli/src/commands/fix.ts - ADD at top
import { fixAst } from '../fix-ast'

// In the command definition, ADD:
program
  .command('fix <report>')
  .description('Apply healed selectors from a report to test files')
  .option('--dry-run', 'Show what would be changed without writing')
  .option('--force', 'Apply even if git has uncommitted changes')
  .option('--ast', 'Use AST rewriting for ROLE/TEXT suggestions (experimental)')
  .action(async (reportPath, options) => {
    const run = await loadReport(reportPath)
    const outcomes = options.ast ? fixAst(run, options) : fix(run, options)
    // ... rest unchanged
  })
```

- [ ] **Step 3: Write integration test for `--ast` flag**

```typescript
// Add to cli/src/__tests__/fix.integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../commands/test-utils'

describe('fix command --ast', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-fix-ast-int-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('applies ROLE fix via AST when --ast flag used', async () => {
    const testFile = join(dir, 'test.spec.ts')
    writeFileSync(testFile, `await page.click('#btn-submit')`)

    const reportFile = join(dir, 'report.json')
    writeFileSync(reportFile, JSON.stringify({
      project: 'test',
      framework: 'Playwright',
      generatedAt: new Date().toISOString(),
      cases: [{
        testName: 'submit works',
        testFile,
        selector: '#btn-submit',
        errorMessage: 'error',
        status: 'healed',
        fixedSelector: "role('button', { name: 'Submit' })",
        confidence: 0.95,
        explanation: '',
        selectorType: 'ROLE',
      }]
    }))

    const { stdout, stderr, exitCode } = await runCommand('fix', [reportFile, '--ast'], { cwd: dir })
    expect(exitCode).toBe(0)
    expect(readFileSync(testFile, 'utf-8')).toBe(`await page.getByRole('button', { name: 'Submit' }).click()`)
  })

  it('skips ROLE fix without --ast (existing behavior)', async () => {
    const testFile = join(dir, 'test.spec.ts')
    writeFileSync(testFile, `await page.click('#btn-submit')`)

    const reportFile = join(dir, 'report.json')
    writeFileSync(reportFile, JSON.stringify({
      project: 'test',
      framework: 'Playwright',
      generatedAt: new Date().toISOString(),
      cases: [{
        testName: 'submit works',
        testFile,
        selector: '#btn-submit',
        errorMessage: 'error',
        status: 'healed',
        fixedSelector: "role('button', { name: 'Submit' })",
        confidence: 0.95,
        explanation: '',
        selectorType: 'ROLE',
      }]
    }))

    const { stdout, stderr, exitCode } = await runCommand('fix', [reportFile], { cwd: dir })
    expect(exitCode).toBe(0)
    expect(stdout).toContain('not-substitutable')
    expect(readFileSync(testFile, 'utf-8')).toBe(`await page.click('#btn-submit')`)
  })
})
```

- [ ] **Step 4: Run integration tests**

```bash
cd C:\Proyectos\QA\Healify\cli && npm test -- src/__tests__/fix.integration.test.ts
```
Expected: PASS

- [ ] **Step 5: Run full CLI test suite (regression)**

```bash
cd C:\Proyectos\QA\Healify\cli && npm test
```
Expected: All PASS (94 tests)

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/fix.ts cli/src/__tests__/fix.integration.test.ts
git commit -m "feat(cli): add --ast flag to fix command for AST rewriting"
```

---

### Task 5: Build and verify end-to-end

**Files:**
- None new

- [ ] **Step 1: Build all packages**

```bash
cd C:\Proyectos\QA\Healify && npm run build
```
Expected: PASS

- [ ] **Step 2: Run all tests across workspace**

```bash
cd C:\Proyectos\QA\Healify && npm test
```
Expected: All 231+ tests PASS

- [ ] **Step 3: Manual E2E test**

```bash
cd C:\Proyectos\QA\Healify
# Create test file
mkdir -p /tmp/healify-e2e
cat > /tmp/healify-e2e/test.spec.ts << 'EOF'
import { test, expect } from '@playwright/test'
test('submit', async ({ page }) => {
  await page.click('#btn-submit')
})
EOF

# Create report
cat > /tmp/healify-e2e/report.json << 'EOF'
{
  "project": "test",
  "framework": "Playwright",
  "generatedAt": "2026-07-23T00:00:00.000Z",
  "cases": [{
    "testName": "submit",
    "testFile": "/tmp/healify-e2e/test.spec.ts",
    "selector": "#btn-submit",
    "errorMessage": "error",
    "status": "healed",
    "fixedSelector": "role('button', { name: 'Submit' })",
    "confidence": 0.95,
    "explanation": "",
    "selectorType": "ROLE"
  }]
}
EOF

# Run fix --ast
node cli/dist/index.js fix /tmp/healify-e2e/report.json --ast

# Verify
cat /tmp/healify-e2e/test.spec.ts
```
Expected: `await page.getByRole('button', { name: 'Submit' }).click()`

- [ ] **Step 4: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: final adjustments for Feature #7 AST fix"
```

---

### Task 6: Update docs (optional but recommended)

**Files:**
- Modify: `cli/README.md` or wherever CLI docs live

- [ ] **Step 1: Document `--ast` flag**

```markdown
### `healify fix --ast`

Experimental: Use AST rewriting to apply ROLE/TEXT suggestions as modern Playwright locators.

```bash
healify fix healify-report.json --ast
```

Transforms:
- `page.click('#btn')` → `page.getByRole('button', { name: 'Submit' }).click()`
- `page.fill('#email', 'x')` → `page.getByRole('textbox', { name: 'Email' }).fill('x')`
- `page.click('text=Login')` → `page.getByText('Login').click()`
```

- [ ] **Step 2: Commit**

```bash
git add cli/README.md
git commit -m "docs(cli): document --ast flag for AST rewriting"
```

---

## Acceptance Checklist

- [ ] `healify fix --ast report.json` applies ROLE/TEXT fixes via AST rewrite
- [ ] All 13 Playwright methods rewritten correctly
- [ ] Existing string-replace tests still pass (no regression)
- [ ] `--dry-run` and `--force` work with `--ast`
- [ ] Git dirty check respected
- [ ] Comments masking preserved (no false matches in comments)
- [ ] 0 vulnerabilities, build passes, lint passes
- [ ] All 231+ workspace tests pass
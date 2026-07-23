# Feature #7 — AST-based Fix for ROLE/TEXT Selectors

## Status: APPROVED — Ready for Implementation Plan

---

## Problem

The current `fix` command only does string replacement. It **skips** any suggestion that starts with `role('...')` or `text('...')` because those are not valid selector strings — they're readable representations meant for the HTML report, not for pasting inside `page.click('...')`.

Result: **~40-60% of high-confidence suggestions are never auto-applied** (ROLE/TEXT are the most robust strategies).

---

## Solution: ts-morph AST Rewriter

Add a new `fix-ast.ts` module that uses **ts-morph** (TypeScript AST manipulation) to rewrite the **entire method call**:

| Before | After |
|--------|-------|
| `page.click('#btn-submit')` | `page.getByRole('button', { name: 'Submit' }).click()` |
| `page.fill('#email', 'x@y.com')` | `page.getByRole('textbox', { name: 'Email' }).fill('x@y.com')` |
| `await page.locator('text=Login').click()` | `await page.getByText('Login').click()` |

---

## Scope (Phase 1)

| Framework | Status | Methods Mapped |
|-----------|--------|----------------|
| **Playwright** | ✅ In scope | 13 methods: `click`, `fill`, `type`, `press`, `check`, `uncheck`, `selectOption`, `hover`, `focus`, `blur`, `tap`, `dblclick`, `dispatchEvent` |
| **Cypress** | ⏳ Phase 2 | `cy.get().click()` → `cy.contains().click()` / `cy.findByRole().click()` |
| **WebdriverIO** | ❌ Out of scope | No standard modern API |
| **Selenium** | ❌ Out of scope | No standard modern API |

---

## Architecture

### New File: `cli/src/fix-ast.ts`

```typescript
// Exports
export function fixAst(run: LocalRun, options: FixOptions): FixOutcome[]
```

**Responsibilities:**
- Import shared utilities from `fix.ts`: `maskComments`, `countOccurrences`, `isGitDirty`
- For each `healed` case with `fixedSelector` starting with `role(` or `text(`:
  1. Parse test file with ts-morph
  2. Find the exact `CallExpression` containing the broken selector
  3. Rewrite to modern locator call chain
  4. Write file (respecting `dryRun`, `force`)

### Modified File: `cli/src/commands/fix.ts`

```typescript
// New flag
program
  .command('fix <report>')
  .option('--ast', 'Use AST rewriting for ROLE/TEXT suggestions (opt-in)')
  .action(async (reportPath, options) => {
    const run = loadReport(reportPath)
    const outcomes = options.ast ? fixAst(run, options) : fix(run, options)
    // ...
  })
```

### Mapping Logic (Playwright)

| Selector Type | Fixed Selector Pattern | Rewritten To |
|---------------|------------------------|--------------|
| `role('button', { name: 'X' })` | `page.getByRole('button', { name: 'X' }).click()` |
| `role('textbox', { name: 'Y' })` | `page.getByRole('textbox', { name: 'Y' }).fill(value)` |
| `role('checkbox', { name: 'Z' })` | `page.getByRole('checkbox', { name: 'Z' }).check()` |
| `text('Visible Text')` | `page.getByText('Visible Text').click()` |
| `text('Visible Text')` (input) | `page.getByText('Visible Text').fill(value)` → *fallback to role* |

**Method → Locator mapping:**
```ts
const METHOD_TO_LOCATOR: Record<string, (role: string, name: string) => string> = {
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
```

**TEXT fallback:** `text('X')` → `getByText('X')` (only for `click`, `hover`, `tap`, `dblclick` — not for input methods)

---

## Dependencies

Add to `cli/package.json`:
```json
"dependencies": {
  "ts-morph": "^21.0.0"
}
```

---

## Testing Strategy

| Test Type | Count | Description |
|-----------|-------|-------------|
| Unit: `fix-ast.ts` | ~15 | Each method rewrite, edge cases (nested calls, await, chaining) |
| Integration: CLI `--ast` | ~5 | End-to-end with real test files |
| Regression | +0 | Existing `fix.test.ts` unchanged |

**Test fixtures:** Real test files in `cli/src/__tests__/fixtures/ast-fix/` covering:
- `page.click('#btn')` → role
- `await page.fill('#email', 'x')` → role + fill
- `page.locator('text=Login').click()` → getByText
- Chained: `await page.locator('#btn').click()` → getByRole
- Multiple selectors in same file (longest-first ordering preserved)
- Comments masking (reuse `maskComments` logic)

---

## Rollout

1. **v0.7.0** — `--ast` flag opt-in, docs warn "experimental"
2. **v0.8.0** — Default on if confident (after 2+ weeks real usage)
3. **v1.0.0** — Remove string-replace fallback for ROLE/TEXT entirely

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| ts-morph breaks on malformed TS | Wrap in try/catch, fallback to `not-substitutable` |
| Rewrites wrong call (false positive) | Reuse `maskComments` + exact selector match + longest-first ordering |
| Loses formatting (prettier) | ts-morph preserves formatting; run `prettier --write` post-fix in CI |
| Cypress/WebdriverIO users expect parity | Document Phase 2 clearly; `--ast` only enables for Playwright in v0.7 |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `cli/src/fix-ast.ts` | **NEW** — Core AST rewriting logic |
| `cli/src/commands/fix.ts` | **MODIFY** — Add `--ast` flag, delegate |
| `cli/package.json` | **MODIFY** — Add `ts-morph` dependency |
| `cli/src/__tests__/fix-ast.test.ts` | **NEW** — Unit tests |
| `cli/src/__tests__/fixtures/ast-fix/` | **NEW** — Test fixtures |
| `cli/src/__tests__/fix.integration.test.ts` | **MODIFY** — Add `--ast` integration tests |

---

## Acceptance Criteria

- [ ] `healify fix --ast report.json` applies ROLE/TEXT fixes via AST rewrite
- [ ] All 13 Playwright methods rewritten correctly
- [ ] Existing string-replace tests still pass (no regression)
- [ ] `--dry-run` and `--force` work with `--ast`
- [ ] Git dirty check respected
- [ ] Comments masking preserved (no false matches in comments)
- [ ] 0 vulnerabilities, build passes, lint passes

---

*Approved: 2026-07-23*  
*Next: Feature #8 Historical Report brainstorm*
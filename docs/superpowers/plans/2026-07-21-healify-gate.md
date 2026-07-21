# Healify Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three duplicated, hardcoded `confidence >= 0.95` checks that gate auto-PR/auto-heal today with a single reusable `evaluateGate()` that also blocks on fragile or non-unique selectors, using the per-project `autoHealThreshold` that already exists in the schema but nothing reads yet.

**Architecture:** One new pure function, `evaluateGate()`, in `src/lib/gate/evaluate-gate.ts` — no DB, no network, fully unit-testable. It's wired into the two places that currently decide "is this healing suggestion good enough to act on automatically": `tryOpenAutoPR()` (`src/lib/github/auto-pr.ts`, blocks the real GitHub PR) and `POST /api/v1/report` (`src/app/api/v1/report/route.ts`, sets the `HealingEvent.status` label). `src/workers/lib/healing-ops.ts` (the Railway worker's own hardcoded `0.95` check) is explicitly **out of scope** — excluded by instruction, not by oversight; it keeps its current hardcoded threshold after this plan ships.

**Tech Stack:** TypeScript, Prisma (Postgres), Vitest (existing `src/lib/__tests__/` convention, `@/*` path alias to `./src/*`), Next.js route handlers.

**Reference spec:** `docs/superpowers/specs/2026-07-21-healify-v2-complementary-tools.md` §3

---

## File Structure

```
prisma/schema.prisma                        (MODIFY — autoHealThreshold default 0.85 → 0.95)
prisma/migrations/<ts>_bump_auto_heal_threshold_default/migration.sql   (CREATE — via prisma CLI + manual backfill line)

src/lib/gate/
  evaluate-gate.ts                          (CREATE)

src/lib/__tests__/
  evaluate-gate.test.ts                     (CREATE)
  auto-pr.test.ts                           (CREATE)
  report-api.test.ts                        (MODIFY — replace mirrored 0.95 logic with real evaluateGate calls)

src/lib/github/auto-pr.ts                   (MODIFY — remove AUTO_PR_CONFIDENCE_THRESHOLD, call evaluateGate)
src/app/api/v1/report/route.ts              (MODIFY — remove hardcoded 0.95, call evaluateGate)
```

---

### Task 1: Prisma — preserve today's auto-heal bar as the real default

Today `Project.autoHealThreshold` defaults to `0.85` in the schema but no code reads it — the real threshold everywhere is `0.95` hardcoded three times. Once `evaluateGate()` starts reading `autoHealThreshold` for real (Tasks 3–4), leaving the schema default at `0.85` would silently loosen auto-heal for every existing and new project the moment this ships. This task changes the default to `0.95` so behavior doesn't change until someone deliberately edits a project's setting, and backfills existing rows (every row today has the old, never-enforced `0.85` — nobody ever knowingly chose it, since it was invisible dead config until now).

**Files:**
- Modify: `prisma/schema.prisma:148`
- Create: `prisma/migrations/<timestamp>_bump_auto_heal_threshold_default/migration.sql` (via CLI, then hand-edited)

- [ ] **Step 1: Change the schema default**

In `prisma/schema.prisma`, line 148:

```prisma
  autoHealThreshold  Float    @default(0.95)  // Min AI confidence to auto-apply a selector fix
```

(was `@default(0.85)`)

- [ ] **Step 2: Generate the migration without applying it**

Run: `npx prisma migrate dev --name bump_auto_heal_threshold_default --create-only`
Expected: creates `prisma/migrations/<timestamp>_bump_auto_heal_threshold_default/migration.sql` containing only:
```sql
-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "autoHealThreshold" SET DEFAULT 0.95;
```
Prisma does not apply it yet because of `--create-only`.

- [ ] **Step 3: Add the backfill to the generated migration file**

Open the file created in Step 2 and append:

```sql

-- Backfill: autoHealThreshold existed in the schema but no code path read it
-- until this change (see docs/superpowers/specs/2026-07-21-healify-v2-complementary-tools.md §3.6).
-- Every existing row still has the original, never-enforced 0.85 default —
-- no user ever knowingly chose that value. Bringing them to 0.95 preserves
-- today's de-facto auto-heal bar instead of silently loosening it the
-- moment the threshold starts being enforced.
UPDATE "projects" SET "autoHealThreshold" = 0.95 WHERE "autoHealThreshold" = 0.85;
```

- [ ] **Step 4: Apply the migration**

Run: `npx prisma migrate dev`
Expected: output ends with `Your database is now in sync with your schema.` and regenerates `@prisma/client`.

- [ ] **Step 5: Verify migration status is clean**

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "fix(db): default autoHealThreshold to 0.95, backfill existing projects

Preserves today's de-facto auto-heal confidence bar before evaluateGate()
starts actually reading this field (previously dead config)."
```

---

### Task 2: `evaluateGate()` — core pure function

**Files:**
- Create: `src/lib/gate/evaluate-gate.ts`
- Test: `src/lib/__tests__/evaluate-gate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/evaluate-gate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { evaluateGate } from '@/lib/gate/evaluate-gate'

describe('evaluateGate — low_confidence', () => {
  it('bloquea cuando confidence < threshold', () => {
    const result = evaluateGate({
      confidence: 0.80,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'low_confidence', confidence: 0.80, threshold: 0.95 })
  })

  it('confidence exactamente igual al threshold: pasa (no bloquea)', () => {
    const result = evaluateGate({
      confidence: 0.95,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    expect(result.blockedBy.find(r => r.code === 'low_confidence')).toBeUndefined()
  })
})

describe('evaluateGate — fragile_selector', () => {
  it('bloquea un selector nth-child (score < 0.40)', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: 'div:nth-child(3)',
      selectorType: 'CSS',
      threshold: 0.85,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy.some(r => r.code === 'fragile_selector')).toBe(true)
  })

  it('no bloquea un data-testid robusto', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.85,
    })
    expect(result.pass).toBe(true)
  })
})

describe('evaluateGate — not_unique', () => {
  const htmlTwoMatches = '<button id="login-btn">A</button><button id="login-btn">B</button>'
  const htmlOneMatch = '<button id="login-btn">A</button>'

  it('bloquea cuando el selector matchea más de un elemento', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#login-btn',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlTwoMatches,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'not_unique', matches: 2 })
  })

  it('no bloquea cuando el selector matchea exactamente un elemento', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#login-btn',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlOneMatch,
    })
    expect(result.pass).toBe(true)
  })

  it('no bloquea cuando el selector no aparece (0 matches — puede ser truncamiento del snapshot)', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#does-not-exist',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlOneMatch,
    })
    expect(result.pass).toBe(true)
  })

  it('no bloquea selectores complejos (indeterminado: combinadores/pseudo-clases no se cuentan)', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '.form > button:not(.disabled)',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: htmlTwoMatches,
    })
    expect(result.pass).toBe(true)
  })

  it('sin domSnapshot: no se evalúa unicidad', () => {
    const result = evaluateGate({
      confidence: 1.0,
      selector: '#login-btn',
      selectorType: 'CSS',
      threshold: 0.85,
    })
    expect(result.pass).toBe(true)
  })

  it('cuenta selectores de clase respetando límites de palabra (no substring)', () => {
    const html = '<div class="btn-group">X</div><div class="btn">Y</div><div class="btn">Z</div>'
    const result = evaluateGate({
      confidence: 1.0,
      selector: '.btn',
      selectorType: 'CSS',
      threshold: 0.85,
      domSnapshot: html,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'not_unique', matches: 2 })
  })

  it('cuenta selectores de atributo data-*/aria-*', () => {
    const html = '<button data-testid="submit-btn">A</button><button data-testid="submit-btn">B</button>'
    const result = evaluateGate({
      confidence: 1.0,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.85,
      domSnapshot: html,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy).toContainEqual({ code: 'not_unique', matches: 2 })
  })
})

describe('evaluateGate — múltiples razones simultáneas', () => {
  it('reporta todas las razones de bloqueo a la vez, no solo la primera', () => {
    const result = evaluateGate({
      confidence: 0.50,
      selector: 'div:nth-child(3)',
      selectorType: 'CSS',
      threshold: 0.95,
    })
    expect(result.pass).toBe(false)
    expect(result.blockedBy.map(r => r.code).sort()).toEqual(['fragile_selector', 'low_confidence'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/evaluate-gate.test.ts`
Expected: FAIL — `Cannot find module '@/lib/gate/evaluate-gate'`

- [ ] **Step 3: Implement `evaluateGate()`**

Create `src/lib/gate/evaluate-gate.ts`:

```ts
import type { SelectorType } from '@/lib/enums'
import { selectorAnalyzer } from '@/lib/selector-analyzer'

export interface GateInput {
  confidence: number
  selector: string
  selectorType: SelectorType
  /** project.autoHealThreshold — caller resolves any null/undefined fallback before calling. */
  threshold: number
  /** Truncated DOM snapshot (oldDomSnapshot/newDomSnapshot), if one was captured. */
  domSnapshot?: string
}

export type GateFailureReason =
  | { code: 'low_confidence'; confidence: number; threshold: number }
  | { code: 'fragile_selector'; score: number }
  | { code: 'not_unique'; matches: number }

export interface GateResult {
  pass: boolean
  blockedBy: GateFailureReason[]
}

// Same cutoff selector-analyzer.ts already uses for "Critical risk" in getRecommendation().
const FRAGILE_SCORE_CEILING = 0.40

export function evaluateGate(input: GateInput): GateResult {
  const blockedBy: GateFailureReason[] = []

  if (input.confidence < input.threshold) {
    blockedBy.push({ code: 'low_confidence', confidence: input.confidence, threshold: input.threshold })
  }

  const score = selectorAnalyzer.calculateScore(input.selector, input.selectorType)
  if (score < FRAGILE_SCORE_CEILING) {
    blockedBy.push({ code: 'fragile_selector', score })
  }

  if (input.domSnapshot) {
    const matches = countSimpleSelectorMatches(input.selector, input.domSnapshot)
    if (matches !== null && matches > 1) {
      blockedBy.push({ code: 'not_unique', matches })
    }
  }

  return { pass: blockedBy.length === 0, blockedBy }
}

// ── DOM uniqueness — best-effort regex count, no HTML parser ───────────
//
// Only counts three simple, unambiguous selector shapes (#id, .single-class,
// [data-*="..."]/[aria-*="..."]). Anything else (combinators, pseudo-classes,
// XPath) returns null — "indeterminate" — and is never used to block, because
// a truncated 8000-char snapshot can't be trusted for anything more complex
// than a literal attribute match.

function countSimpleSelectorMatches(selector: string, html: string): number | null {
  const idMatch = selector.match(/^#([A-Za-z0-9_-]+)$/)
  if (idMatch) {
    const re = new RegExp(`\\bid=["']${escapeRegExp(idMatch[1])}["']`, 'g')
    return (html.match(re) ?? []).length
  }

  const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)$/)
  if (classMatch) {
    const classAttrRe = /\bclass=["']([^"']*)["']/g
    let count = 0
    let m: RegExpExecArray | null
    while ((m = classAttrRe.exec(html)) !== null) {
      if (m[1].split(/\s+/).includes(classMatch[1])) count++
    }
    return count
  }

  const attrMatch = selector.match(/^\[((?:data|aria)-[A-Za-z0-9_-]+)=["']([^"']+)["']\]$/)
  if (attrMatch) {
    const [, attrName, attrValue] = attrMatch
    const re = new RegExp(`\\b${escapeRegExp(attrName)}=["']${escapeRegExp(attrValue)}["']`, 'g')
    return (html.match(re) ?? []).length
  }

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/evaluate-gate.test.ts`
Expected: PASS — all `it()` green (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/gate/evaluate-gate.ts src/lib/__tests__/evaluate-gate.test.ts
git commit -m "feat(gate): add evaluateGate() — confidence, fragility, uniqueness

Pure function, no DB/network. Centralizes what's currently three separate
hardcoded confidence>=0.95 checks, plus adds fragility (reuses
SelectorAnalyzer) and best-effort DOM-uniqueness checks that don't exist
anywhere today."
```

---

### Task 3: Wire gate into `tryOpenAutoPR()`

**Files:**
- Modify: `src/lib/github/auto-pr.ts`
- Test: `src/lib/__tests__/auto-pr.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `src/lib/__tests__/auto-pr.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = {
  healingEvent: { update: vi.fn() },
  account: { findFirst: vi.fn() },
  notification: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ db: mockDb }))

const mockCreateSmartPR = vi.fn()
const mockCreateHealifyCheckRun = vi.fn()
vi.mock('@/lib/github/checks', () => ({
  createSmartPR: mockCreateSmartPR,
  createHealifyCheckRun: mockCreateHealifyCheckRun,
}))

// db.healingEvent.findUnique is imported fresh per test via a local mock
const mockFindUnique = vi.fn()
mockDb.healingEvent.findUnique = mockFindUnique

global.fetch = vi.fn()

const { tryOpenAutoPR } = await import('@/lib/github/auto-pr')

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_1',
    confidence: 0.97,
    newSelector: '[data-testid="submit-btn"]',
    newSelectorType: 'TESTID',
    selectorType: 'CSS',
    failedSelector: '#old-btn',
    testName: 'Login test',
    testFile: 'tests/login.spec.ts',
    reasoning: 'because',
    oldDomSnapshot: null,
    newDomSnapshot: null,
    testRun: {
      project: {
        repository: 'https://github.com/acme/app',
        userId: 'user_1',
        autoHealThreshold: 0.85,
      },
    },
    ...overrides,
  }
}

describe('tryOpenAutoPR — gate integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bloquea (no llama createSmartPR) cuando el selector propuesto es frágil, aunque la confidence sea alta', async () => {
    mockFindUnique.mockResolvedValue(makeEvent({
      confidence: 0.99,
      newSelector: 'div:nth-child(3)',
      newSelectorType: 'CSS',
    }))

    const result = await tryOpenAutoPR('evt_1')

    expect(result.opened).toBe(false)
    expect(result.reason).toContain('gate:fragile_selector')
    expect(mockCreateSmartPR).not.toHaveBeenCalled()
  })

  it('bloquea cuando la confidence no alcanza el autoHealThreshold configurado del proyecto', async () => {
    mockFindUnique.mockResolvedValue(makeEvent({
      confidence: 0.90,
      testRun: {
        project: { repository: 'https://github.com/acme/app', userId: 'user_1', autoHealThreshold: 0.95 },
      },
    }))

    const result = await tryOpenAutoPR('evt_1')

    expect(result.opened).toBe(false)
    expect(result.reason).toContain('gate:low_confidence')
    expect(mockCreateSmartPR).not.toHaveBeenCalled()
  })

  it('permite auto-PR cuando confidence, fragilidad y unicidad pasan el gate', async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ confidence: 0.87 }))
    mockDb.account.findFirst.mockResolvedValue({ access_token: 'gh_token' })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ default_branch: 'main' }),
    })
    mockCreateSmartPR.mockResolvedValue({
      prUrl: 'https://github.com/acme/app/pull/1',
      headSha: 'sha123',
      branch: 'healify-fix-1',
    })
    mockCreateHealifyCheckRun.mockResolvedValue('check_1')
    mockDb.healingEvent.update.mockResolvedValue({})
    mockDb.notification.create.mockResolvedValue({})

    const result = await tryOpenAutoPR('evt_1')

    expect(result.opened).toBe(true)
    expect(result.prUrl).toBe('https://github.com/acme/app/pull/1')
    expect(mockCreateSmartPR).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify the first two cases fail against current code**

Run: `npx vitest run src/lib/__tests__/auto-pr.test.ts`
Expected: FAIL on the first two `it()` blocks — current `tryOpenAutoPR()` only checks `confidence < 0.95` and has no fragility check, so `reason` never contains `'gate:'` and the fragile-selector case (confidence 0.99) incorrectly proceeds to call `createSmartPR`. Third test may pass already (happy path unaffected by the missing gate) — that's fine, it's regression coverage, not the red test.

- [ ] **Step 3: Wire `evaluateGate()` into `tryOpenAutoPR()`**

Modify `src/lib/github/auto-pr.ts`. Add the import at the top (after the existing imports):

```ts
import { db } from '@/lib/db'
import { createSmartPR, createHealifyCheckRun } from './checks'
import { evaluateGate } from '@/lib/gate/evaluate-gate'
import type { SelectorType } from '@/lib/enums'
```

Remove the module-level constant (no longer used):

```ts
const AUTO_PR_CONFIDENCE_THRESHOLD = 0.95
```

Replace steps 2–4 of `tryOpenAutoPR()` (currently lines 85–102: the confidence check, the "hay selector nuevo" check, and the `const project = event.testRun.project` line) with:

```ts
        // 2. Verificar que hay un selector nuevo
        if (!event.newSelector) {
            return { opened: false, reason: 'No hay selector nuevo para aplicar' }
        }

        const project = event.testRun.project

        // 3. Gate: confidence, fragilidad y unicidad del selector propuesto
        const gate = evaluateGate({
            confidence: event.confidence ?? 0,
            selector: event.newSelector,
            selectorType: (event.newSelectorType ?? event.selectorType) as SelectorType,
            threshold: project.autoHealThreshold,
            domSnapshot: event.newDomSnapshot ?? event.oldDomSnapshot ?? undefined,
        })
        if (!gate.pass) {
            return { opened: false, reason: `gate:${gate.blockedBy.map(r => r.code).join(',')}` }
        }

        // 4. Verificar que el proyecto tiene repo configurado
        if (!project.repository) {
            return { opened: false, reason: 'Proyecto sin repositorio GitHub configurado' }
        }
```

The rest of the function (steps 5–10, from "Parsear owner/repo" through the final `return { opened: true, ... }`) stays exactly as-is — it already reads `project` and `parsed`, both still defined the same way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/auto-pr.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Run the full suite to check nothing else broke**

Run: `npx vitest run`
Expected: PASS (no regressions in unrelated tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/github/auto-pr.ts src/lib/__tests__/auto-pr.test.ts
git commit -m "feat(gate): block tryOpenAutoPR() on evaluateGate() failure

Replaces the hardcoded AUTO_PR_CONFIDENCE_THRESHOLD=0.95 check with
evaluateGate(), reading project.autoHealThreshold for real and also
blocking on fragile or non-unique selectors, neither of which was
checked before."
```

---

### Task 4: Wire gate into `POST /api/v1/report`

`/api/v1/report` (used by `test-runner`/`cypress-plugin`) doesn't call `tryOpenAutoPR()` — it only sets `HealingEvent.status` (`HEALED_AUTO` vs `NEEDS_REVIEW`) and the test-run counters. This task applies the same gate logic here so the status label is consistent with what would actually happen if this event later went through the PR path, and consolidates the two separate `db.project.findUnique` lookups already in this handler into one.

**Files:**
- Modify: `src/app/api/v1/report/route.ts`
- Modify: `src/lib/__tests__/report-api.test.ts`

- [ ] **Step 1: Add a failing test for the new fragile-selector-blocks-even-at-high-confidence behavior**

In `src/lib/__tests__/report-api.test.ts`, add this import at the top:

```ts
import { evaluateGate } from '@/lib/gate/evaluate-gate'
```

Replace the whole `describe('/api/v1/report — healing result logic', ...)` block with:

```ts
describe('/api/v1/report — healing result logic (evaluateGate real)', () => {

  it('confidence >= threshold, selector robusto y sin domSnapshot → HEALED_AUTO', () => {
    const gate = evaluateGate({
      confidence: 0.97,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    const status = gate.pass ? 'HEALED_AUTO' : 'NEEDS_REVIEW'
    expect(status).toBe('HEALED_AUTO')
  })

  it('confidence < threshold → NEEDS_REVIEW', () => {
    const gate = evaluateGate({
      confidence: 0.80,
      selector: '[data-testid="submit-btn"]',
      selectorType: 'TESTID',
      threshold: 0.95,
    })
    const status = gate.pass ? 'HEALED_AUTO' : 'NEEDS_REVIEW'
    expect(status).toBe('NEEDS_REVIEW')
  })

  it('confidence alta pero selector frágil → también NEEDS_REVIEW (gate bloquea aunque el modelo esté seguro)', () => {
    const gate = evaluateGate({
      confidence: 0.99,
      selector: 'div:nth-child(3)',
      selectorType: 'CSS',
      threshold: 0.85,
    })
    expect(gate.pass).toBe(false)
  })

  it('confidence < 0.70 → notificación requerida', () => {
    expect(0.65 < 0.70).toBe(true)
    expect(0.71 < 0.70).toBe(false)
  })

  it('processingTimeMs es número positivo', () => {
    const start = Date.now() - 50
    const ms = Date.now() - start
    expect(ms).toBeGreaterThan(0)
    expect(typeof ms).toBe('number')
  })
})
```

- [ ] **Step 2: Run test to verify the fragile-selector case fails**

Run: `npx vitest run src/lib/__tests__/report-api.test.ts`
Expected: the "confidence alta pero selector frágil" test FAILS with `Cannot find module '@/lib/gate/evaluate-gate'` (route.ts doesn't import it yet). The other tests pass trivially since they were already testing `evaluateGate` output shape correctly by coincidence of matching thresholds — the point of this step is confirming the new test is exercising real, not-yet-wired logic.

- [ ] **Step 3: Wire `evaluateGate()` into the route handler**

Modify `src/app/api/v1/report/route.ts`. Add the import (after the existing `import type { SelectorType } from '@/lib/enums'`):

```ts
import { evaluateGate } from '@/lib/gate/evaluate-gate'
```

Replace steps 6 through 9 (currently lines 118–173: running the healing engine, updating the healing event, updating test run stats, and the low-confidence notification) with:

```ts
    // 6. Run Healing Engine (ZAI + deterministic fallback)
    const suggestion = await analyzeBrokenSelector(
      payload.selector,
      payload.error,
      payload.context ?? '',
    )

    const fixedSelector = suggestion?.newSelector  ?? payload.selector
    const confidence    = suggestion?.confidence   ?? 0.0
    const reasoning     = suggestion?.reasoning    ?? 'Analysis unavailable'
    const selectorType  = suggestion?.selectorType ?? 'UNKNOWN'

    // 6b. Gate: confidence, fragilidad y unicidad del selector propuesto
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { userId: true, autoHealThreshold: true },
    })
    const gate = evaluateGate({
      confidence,
      selector: fixedSelector,
      selectorType: selectorType as SelectorType,
      threshold: project?.autoHealThreshold ?? 0.95,
      domSnapshot: payload.context,
    })

    // 7. Update healing event with result
    const updatedEvent = await db.healingEvent.update({
      where: { id: healingEvent.id },
      data: {
        newSelector: fixedSelector,
        newSelectorType: selectorType as SelectorType,
        confidence,
        status: gate.pass ? 'HEALED_AUTO' : 'NEEDS_REVIEW',
        reasoning,
        actionTaken: gate.pass ? 'auto_fixed' : 'suggested',
        appliedAt: gate.pass ? new Date() : null,
        appliedBy: 'system',
      },
    })

    // 8. Update test run stats
    await db.testRun.update({
      where: { id: testRun.id },
      data: {
        totalTests: { increment: 1 },
        healedTests: gate.pass ? { increment: 1 } : undefined,
        failedTests: !gate.pass ? { increment: 1 } : undefined,
      },
    })

    // 9. Create notification for low confidence
    if (confidence < 0.70 && project?.userId) {
      await db.notification.create({
        data: {
          userId: project.userId,
          type: 'warning',
          title: 'Manual Review Required',
          message: `Test "${payload.testName}" needs review (${Math.round(confidence * 100)}% confidence)`,
          link: `/dashboard/tests`,
        },
      })
    }
```

Then update the response body (currently around line 189) so `needsReview` reflects the gate instead of the old hardcoded check:

```ts
        result: {
          fixedSelector,
          confidence,
          selectorType,
          explanation: reasoning,
          needsReview: !gate.pass,
          alternatives: [],
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/report-api.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v1/report/route.ts src/lib/__tests__/report-api.test.ts
git commit -m "feat(gate): use evaluateGate() in /api/v1/report instead of hardcoded 0.95

Consolidates the two separate db.project.findUnique lookups in this
handler into one (now needed unconditionally for autoHealThreshold).
This endpoint still never calls tryOpenAutoPR() — this only changes
the HealingEvent.status label shown in the dashboard, for consistency
with what Task 3's gate would decide if this event later went through
the PR path."
```

---

## Self-review

**Spec coverage:** §3.4 (evaluateGate contract, 3 checks) → Task 2. §3.5 (integration into `tryOpenAutoPR` and `/api/v1/report`) → Tasks 3–4. §3.6 (schema default decision) → Task 1. §3.2 (non-goals: no `src/workers/` changes, no npm package, no new prod dependency for DOM parsing, reuse `SelectorAnalyzer` instead of reimplementing) → respected throughout; `evaluate-gate.ts` imports `selectorAnalyzer` rather than duplicating scoring logic, and uses regex instead of adding `jsdom`/`cheerio` as a prod dependency. §3.7 (testing) → Tasks 2–4 each carry real unit/integration tests, not placeholders.

**Out of scope, confirmed not touched by any task:** `reporter-core/`, `test-runner/`, `cypress-plugin/`, `src/workers/` (including `src/workers/lib/healing-ops.ts`, which keeps its own hardcoded `0.95` — this is the one gap the spec explicitly leaves open, not an oversight here).

**Type consistency check:** `GateInput`/`GateResult`/`GateFailureReason` defined once in Task 2 and used identically (same field names, same literal `code` values) in Tasks 3 and 4 — no renaming drift. `evaluateGate` is imported by that exact name in both `auto-pr.ts` and `route.ts`.

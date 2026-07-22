# `@healify/selenium-plugin` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@healify/selenium-plugin`, a wrapper for Selenium `WebDriver` that intercepts `findElement` calls and cures broken locators in-process using the existing heuristic engine (`analyzeAndHeal()` from `@healify/reporter-core`) — no new heuristic, no cloud mode, no HTML/JSON report in this phase.

**Architecture:** A single `wrap(driver)` call returns a `Proxy` over the real `WebDriver`. Only `findElement` is intercepted; every other method (including `findElements`) passes straight through unmodified. On `NoSuchElementError`, the failing `By` locator is converted to a selector string (`src/locator.ts`) and handed to the same `analyzeAndHeal()` that Playwright/Cypress already use — no bespoke rules. `analyzeAndHeal()` is always wrapped in `try/catch`; a failure there never breaks the caller's test, it just re-throws the original Selenium error.

**Tech Stack:** TypeScript (CommonJS output, same as the other 4 workspaces), `selenium-webdriver@^4.0.0` (peer dependency), `@healify/reporter-core` (devDependency, bundled inline via esbuild at build time — it's private, never published), `vitest` for unit tests, `esbuild` for the bundled build (mirrors `cypress-plugin`/`test-runner`).

**Reference spec:** `docs/superpowers/specs/2026-07-22-selenium-plugin-design.md`

---

## File Structure

```
package.json                          (MODIFY — add "selenium-plugin" to workspaces)
.gitignore                            (MODIFY — ignore dist/ and node_modules/ under selenium-plugin)
.github/workflows/ci.yml              (MODIFY — add typecheck step for selenium-plugin)

selenium-plugin/
  package.json                        (CREATE)
  tsconfig.json                       (CREATE)
  README.md                           (CREATE)
  src/
    types.ts                          (CREATE)
    locator.ts                        (CREATE)
    wrap.ts                           (CREATE)
    plugin.ts                         (CREATE)
    index.ts                          (CREATE)
  src/__tests__/
    locator.test.ts                   (CREATE)
    wrap.test.ts                      (CREATE)
    plugin.test.ts                    (CREATE)
```

---

### Task 1: Workspace scaffolding

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.github/workflows/ci.yml`
- Create: `selenium-plugin/package.json`, `selenium-plugin/tsconfig.json`

- [ ] **Step 1: Add `selenium-plugin` to the root `package.json` workspaces**

Open `package.json` at the repo root. It currently reads:

```json
{
  "name": "healify",
  "version": "0.2.0",
  "private": true,
  "workspaces": [
    "reporter-core",
    "test-runner",
    "cypress-plugin",
    "cli"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm test --workspaces --if-present"
  }
}
```

Change the `"workspaces"` array to:

```json
"workspaces": [
  "reporter-core",
  "test-runner",
  "cypress-plugin",
  "cli",
  "selenium-plugin"
]
```

- [ ] **Step 2: Ignore build output and nested `node_modules` for the new package**

Append to `.gitignore` (it already has equivalent entries for the other 4 packages, right after the `cli/node_modules` line):

```
selenium-plugin/dist
selenium-plugin/node_modules
```

- [ ] **Step 3: Create `selenium-plugin/package.json`**

```json
{
  "name": "@healify/selenium-plugin",
  "version": "0.1.0",
  "description": "Self-healing wrapper for Selenium WebDriver — heuristic, local-first, no AI, no server.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --emitDeclarationOnly && esbuild src/index.ts --bundle --platform=node --outdir=dist --format=cjs --external:selenium-webdriver",
    "test": "vitest run"
  },
  "publishConfig": {
    "access": "public"
  },
  "peerDependencies": {
    "selenium-webdriver": "^4.0.0"
  },
  "devDependencies": {
    "@healify/reporter-core": "*",
    "esbuild": "^0.27.3",
    "selenium-webdriver": "^4.27.0",
    "typescript": "^5.4.0",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 4: Create `selenium-plugin/tsconfig.json`**

Same pattern as `cypress-plugin/tsconfig.json` and `test-runner/tsconfig.json` (no `"types"` override needed here — unlike `cypress-plugin`, which needs `"types": ["cypress", "node"]` for Cypress's ambient globals, `selenium-webdriver` ships its own TypeScript types as regular module exports, nothing ambient to declare):

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

- [ ] **Step 5: Add the typecheck step to CI**

Open `.github/workflows/ci.yml`. Find the `typecheck` job's last step:

```yaml
      - name: Type check cli
        run: npx tsc --noEmit -p cli/tsconfig.json
```

Add a new step immediately after it (still inside the `typecheck` job, same indentation):

```yaml

      - name: Type check selenium-plugin
        run: npx tsc --noEmit -p selenium-plugin/tsconfig.json
```

Do not touch the `test`, `build`, or `security-sca` jobs — they already delegate to every workspace automatically (`npm test --workspaces --if-present`, `npm run build --workspaces`), no changes needed there.

- [ ] **Step 6: Install workspace dependencies from the repo root**

Run: `npm install`
Expected: npm creates a symlink for `selenium-plugin` under the root `node_modules/@healify/selenium-plugin`, installs `selenium-webdriver`/`esbuild`/`typescript`/`vitest` as devDependencies for the new package. No errors.

- [ ] **Step 7: Verify the other 4 workspaces still typecheck (nothing broken by the scaffolding)**

Run: `npx tsc --noEmit -p reporter-core/tsconfig.json && npx tsc --noEmit -p test-runner/tsconfig.json && npx tsc --noEmit -p cypress-plugin/tsconfig.json && npx tsc --noEmit -p cli/tsconfig.json`
Expected: no output, exit code 0 for all four.

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore .github/workflows/ci.yml selenium-plugin/package.json selenium-plugin/tsconfig.json package-lock.json
git commit -m "chore(selenium-plugin): scaffold workspace, wire into root + CI"
```

---

### Task 2: Public types (`src/types.ts`)

**Files:**
- Create: `selenium-plugin/src/types.ts`

No test file for this task — it's pure type/constant declarations, nothing to assert at runtime. Verified instead by every later task's test files successfully importing from it (if a type is wrong, those imports fail to typecheck).

- [ ] **Step 1: Create `selenium-plugin/src/types.ts`**

```ts
/** Piso de confianza por default — igual al umbral HEALED_THRESHOLD (auto-aplicado sin revisión) de reporter-core/src/local-mode.ts, no al de "a revisar" (0.8): acá no hay paso de revisión humana, así que el piso para actuar solo debe ser el más alto que el motor ya define. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.9

export interface HealifySeleniumOptions {
  /** Confianza mínima (0-1) de analyzeAndHeal() para probar la sugerencia. Default: 0.9. */
  confidenceThreshold?: number
  /** Si es true, cura pero nunca aplica el fix — solo emite el evento 'healed' con dryRun implícito y lanza el error original. Default: false. */
  dryRun?: boolean
  /** Hook opcional para observar cada intento de curado (logging, tests del usuario). */
  onEvent?: (event: HealingEvent) => void
}

export type HealingEventType =
  | 'healed'
  | 'no-suggestion'
  | 'not-convertible'
  | 'failed'
  | 'error'

export interface HealingEvent {
  type: HealingEventType
  originalSelector: string
  fixedSelector?: string
  confidence?: number
  explanation?: string
  latencyMs: number
}
```

- [ ] **Step 2: Verify it typechecks**

Run (from `selenium-plugin/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add selenium-plugin/src/types.ts
git commit -m "feat(selenium-plugin): add public types"
```

---

### Task 3: Locator conversion (`src/locator.ts`)

**Files:**
- Create: `selenium-plugin/src/locator.ts`
- Test: `selenium-plugin/src/__tests__/locator.test.ts`

Per spec §3, verified against the real `selenium-webdriver@4.27.0` source: `By.id()`/`By.className()`/`By.name()` all collapse to `{ using: 'css selector', value: ... }` internally before this code ever sees them — indistinguishable from a hand-written `By.css()` call. Only `By.id()`'s resulting value (`*[id="x"]`) needs rewriting, to `#x`, so `healing-engine.ts`'s ID-specific rule (`startsWith('#')`) fires instead of the generic CSS fallback.

- [ ] **Step 1: Write the failing test**

Create `selenium-plugin/src/__tests__/locator.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { By } from 'selenium-webdriver'
import { locatorToSelector } from '../locator'

describe('locatorToSelector', () => {
  it('convierte By.css tal cual', () => {
    expect(locatorToSelector(By.css('.btn.primary'))).toBe('.btn.primary')
  })

  it('convierte By.xpath tal cual', () => {
    expect(locatorToSelector(By.xpath('//button[@id="x"]'))).toBe('//button[@id="x"]')
  })

  it('reescribe By.id a selector #id para activar la regla de ID dinámico', () => {
    expect(locatorToSelector(By.id('user-1234'))).toBe('#user-1234')
  })

  it('preserva By.className como selector de clase — ya empieza con "."', () => {
    expect(locatorToSelector(By.className('btn-primary'))).toBe('.btn-primary')
  })

  it('preserva By.name como selector de atributo — ya contiene "[name="', () => {
    expect(locatorToSelector(By.name('email'))).toBe('*[name="email"]')
  })

  it('devuelve null para By.linkText — no convertible', () => {
    expect(locatorToSelector(By.linkText('Home'))).toBeNull()
  })

  it('devuelve null para By.partialLinkText — no convertible', () => {
    expect(locatorToSelector(By.partialLinkText('Ho'))).toBeNull()
  })

  it('devuelve null para By.tagName — no convertible', () => {
    expect(locatorToSelector(By.tagName('button'))).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `selenium-plugin/`): `npx vitest run`
Expected: FAIL — `Cannot find module '../locator'`

- [ ] **Step 3: Write the implementation**

Create `selenium-plugin/src/locator.ts`:

```ts
import type { By } from 'selenium-webdriver'

/** Las únicas dos propiedades públicas y estables que expone el constructor de By (lib/by.js) — using/value, no hay tipo runtime más específico que inspeccionar. */
interface RawLocator {
  using: string
  value: string
}

const ID_ATTRIBUTE_PATTERN = /^\*\[id="(.*)"\]$/

/**
 * Convierte un locator de Selenium a un selector-string que analyzeAndHeal()
 * sabe interpretar. Devuelve null cuando el locator no tiene equivalente
 * limpio (linkText/partialLinkText/tagName) — el llamador debe tratar null
 * como "no convertible", nunca inventar una heurística nueva acá.
 */
export function locatorToSelector(locator: By): string | null {
  const raw = locator as unknown as RawLocator
  if (typeof raw.using !== 'string' || typeof raw.value !== 'string') return null

  if (raw.using === 'css selector') {
    const idMatch = raw.value.match(ID_ATTRIBUTE_PATTERN)
    if (idMatch) return `#${idMatch[1]}`
    return raw.value
  }

  if (raw.using === 'xpath') return raw.value

  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add selenium-plugin/src/locator.ts selenium-plugin/src/__tests__/locator.test.ts
git commit -m "feat(selenium-plugin): add locatorToSelector, verified against real By internals"
```

---

### Task 4: Healing wrapper (`src/wrap.ts`)

**Files:**
- Create: `selenium-plugin/src/wrap.ts`
- Test: `selenium-plugin/src/__tests__/wrap.test.ts`

This is the core of the plugin — the `Proxy` that intercepts `findElement`, and only `findElement`. `findElements` (plural) and every other `WebDriver` method pass straight through unmodified, no special-casing needed for them.

- [ ] **Step 1: Write the failing test**

Create `selenium-plugin/src/__tests__/wrap.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { By, error, type WebDriver, type WebElement } from 'selenium-webdriver'

const { mockAnalyzeAndHeal } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
}))

vi.mock('@healify/reporter-core', () => ({
  analyzeAndHeal: mockAnalyzeAndHeal,
}))

import { wrapDriver } from '../wrap'

function makeElement(tag: string): WebElement {
  return { __tag: tag } as unknown as WebElement
}

function makeDriver(findElementImpl: ReturnType<typeof vi.fn>): WebDriver {
  return {
    findElement: findElementImpl,
    findElements: vi.fn().mockResolvedValue([]),
  } as unknown as WebDriver
}

const NO_SUCH_ELEMENT = () => new error.NoSuchElementError('no such element: Unable to locate element')
const STALE_ELEMENT = () => new error.StaleElementReferenceError('stale element reference')

describe('wrapDriver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve el elemento cuando el locator original funciona — no invoca analyzeAndHeal', async () => {
    const el = makeElement('real')
    const findElement = vi.fn().mockResolvedValue(el)
    const wrapped = wrapDriver(makeDriver(findElement))

    const result = await wrapped.findElement(By.css('#real'))

    expect(result).toBe(el)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('cura con éxito cuando el original lanza NoSuchElementError y la sugerencia encuentra el elemento', async () => {
    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(NO_SUCH_ELEMENT())
      .mockResolvedValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'testid estable detectado',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    const result = await wrapped.findElement(By.css('#old'))

    expect(result).toBe(healedEl)
    expect(findElement).toHaveBeenCalledTimes(2)
    expect(findElement).toHaveBeenNthCalledWith(2, By.css('[data-testid="real"]'))
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'healed',
        originalSelector: '#old',
        fixedSelector: '[data-testid="real"]',
        confidence: 0.95,
      })
    )
  })

  it('reporta sin sugerencia cuando la confianza queda debajo del threshold — lanza el error original', async () => {
    const findElement = vi.fn().mockRejectedValueOnce(NO_SUCH_ELEMENT())
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: 'visible=old',
      confidence: 0.75,
      explanation: 'sin candidato confiable',
      selectorType: 'CSS',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBeInstanceOf(error.NoSuchElementError)
    expect(findElement).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'no-suggestion', originalSelector: '#old', confidence: 0.75 })
    )
  })

  it('propaga errores que NO son NoSuchElementError sin intentar curar', async () => {
    const staleErr = STALE_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(staleErr)
    const wrapped = wrapDriver(makeDriver(findElement))

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(staleErr)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('un error interno de analyzeAndHeal no rompe el test del usuario — lanza el error original y reporta el detalle', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    mockAnalyzeAndHeal.mockImplementation(() => {
      throw new Error('boom interno de la heurística')
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', originalSelector: '#old', explanation: 'boom interno de la heurística' })
    )
  })

  it('dryRun=true emite el evento healed pero lanza el error original, sin aplicar el fix', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { dryRun: true, onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(findElement).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'healed', fixedSelector: '[data-testid="real"]' }))
  })

  it('locator no convertible (By.linkText) no intenta curar', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn().mockRejectedValueOnce(originalErr)
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.linkText('Home'))).rejects.toBe(originalErr)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'not-convertible', originalSelector: 'Home' }))
  })

  it('si el retry con la sugerencia también falla, lanza el error original — no uno sintético', async () => {
    const originalErr = NO_SUCH_ELEMENT()
    const retryErr = NO_SUCH_ELEMENT()
    const findElement = vi.fn()
      .mockRejectedValueOnce(originalErr)
      .mockRejectedValueOnce(retryErr)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '[data-testid="real"]',
      confidence: 0.95,
      explanation: 'x',
      selectorType: 'TESTID',
    })
    const onEvent = vi.fn()
    const wrapped = wrapDriver(makeDriver(findElement), { onEvent })

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'failed', originalSelector: '#old' }))
  })

  it('findElements (plural) llama directo al método real, sin pasar por el flujo de curado', async () => {
    const driver = makeDriver(vi.fn())
    const wrapped = wrapDriver(driver)

    await wrapped.findElements(By.css('.item'))

    expect(driver.findElements).toHaveBeenCalledWith(By.css('.item'))
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('respeta un confidenceThreshold custom', async () => {
    const healedEl = makeElement('healed')
    const findElement = vi.fn()
      .mockRejectedValueOnce(NO_SUCH_ELEMENT())
      .mockResolvedValueOnce(healedEl)
    mockAnalyzeAndHeal.mockReturnValue({
      fixedSelector: '.stable',
      confidence: 0.78,
      explanation: 'x',
      selectorType: 'CSS',
    })
    const wrapped = wrapDriver(makeDriver(findElement), { confidenceThreshold: 0.7 })

    const result = await wrapped.findElement(By.css('#old'))

    expect(result).toBe(healedEl)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run`
Expected: FAIL — `Cannot find module '../wrap'`

- [ ] **Step 3: Write the implementation**

Create `selenium-plugin/src/wrap.ts`:

```ts
import type { WebDriver, WebElement, By } from 'selenium-webdriver'
import { By as SeleniumBy, error } from 'selenium-webdriver'
import { analyzeAndHeal } from '@healify/reporter-core'
import { locatorToSelector } from './locator'
import { DEFAULT_CONFIDENCE_THRESHOLD, type HealifySeleniumOptions, type HealingEvent } from './types'

function isNoSuchElementError(err: unknown): boolean {
  return err instanceof error.NoSuchElementError
}

/** Mejor esfuerzo para describir un locator no convertible en el evento emitido — no es un selector real, solo para logging. */
function rawLocatorValue(locator: By): string {
  const raw = locator as unknown as { value?: unknown }
  return typeof raw.value === 'string' ? raw.value : String(locator)
}

/**
 * Envuelve un WebDriver de Selenium en un proxy que cura findElement() en
 * vivo usando analyzeAndHeal() de @healify/reporter-core — el mismo motor
 * que usan test-runner/cypress-plugin. No reimplementa heurística.
 */
export function wrapDriver(driver: WebDriver, options: HealifySeleniumOptions = {}): WebDriver {
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD

  function emit(event: HealingEvent): void {
    options.onEvent?.(event)
  }

  async function findElement(locator: By): Promise<WebElement> {
    const start = Date.now()
    try {
      return await driver.findElement(locator)
    } catch (originalErr) {
      if (!isNoSuchElementError(originalErr)) throw originalErr

      const selector = locatorToSelector(locator)
      if (selector === null) {
        emit({ type: 'not-convertible', originalSelector: rawLocatorValue(locator), latencyMs: Date.now() - start })
        throw originalErr
      }

      let result: ReturnType<typeof analyzeAndHeal>
      try {
        result = analyzeAndHeal({ selector })
      } catch (healErr) {
        const message = healErr instanceof Error ? healErr.message : String(healErr)
        emit({ type: 'error', originalSelector: selector, explanation: message, latencyMs: Date.now() - start })
        throw originalErr
      }

      if (result.confidence < threshold) {
        emit({
          type: 'no-suggestion',
          originalSelector: selector,
          confidence: result.confidence,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }

      if (options.dryRun) {
        emit({
          type: 'healed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          explanation: result.explanation,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }

      try {
        const healedElement = await driver.findElement(SeleniumBy.css(result.fixedSelector))
        emit({
          type: 'healed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          explanation: result.explanation,
          latencyMs: Date.now() - start,
        })
        return healedElement
      } catch {
        emit({
          type: 'failed',
          originalSelector: selector,
          fixedSelector: result.fixedSelector,
          confidence: result.confidence,
          latencyMs: Date.now() - start,
        })
        throw originalErr
      }
    }
  }

  return new Proxy(driver, {
    get(target, prop, receiver) {
      if (prop === 'findElement') return findElement
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run`
Expected: 18 passed (8 from `locator.test.ts` in Task 3 + 10 from `wrap.test.ts` in this task)

- [ ] **Step 5: Commit**

```bash
git add selenium-plugin/src/wrap.ts selenium-plugin/src/__tests__/wrap.test.ts
git commit -m "feat(selenium-plugin): add wrapDriver, curado en vivo reusando analyzeAndHeal()"
```

---

### Task 5: Plugin class (`src/plugin.ts`)

**Files:**
- Create: `selenium-plugin/src/plugin.ts`
- Test: `selenium-plugin/src/__tests__/plugin.test.ts`

Thin class wrapping `wrapDriver` — exists so the public API reads as `new HealifySeleniumPlugin(options).wrap(driver)`, matching the shape agreed in the spec (§2).

- [ ] **Step 1: Write the failing test**

Create `selenium-plugin/src/__tests__/plugin.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { WebDriver, WebElement } from 'selenium-webdriver'
import { By, error } from 'selenium-webdriver'

const { mockAnalyzeAndHeal } = vi.hoisted(() => ({
  mockAnalyzeAndHeal: vi.fn(),
}))

vi.mock('@healify/reporter-core', () => ({
  analyzeAndHeal: mockAnalyzeAndHeal,
}))

import { HealifySeleniumPlugin } from '../plugin'

describe('HealifySeleniumPlugin', () => {
  it('wrap() devuelve un driver que resuelve findElement normalmente cuando no hace falta curar', async () => {
    const el = { __tag: 'real' } as unknown as WebElement
    const driver = {
      findElement: vi.fn().mockResolvedValue(el),
      findElements: vi.fn(),
    } as unknown as WebDriver

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)
    const result = await wrapped.findElement(By.css('#real'))

    expect(result).toBe(el)
    expect(mockAnalyzeAndHeal).not.toHaveBeenCalled()
  })

  it('wrap() no muta el driver original — el original sigue siendo el objeto pasado', () => {
    const driver = {
      findElement: vi.fn(),
      findElements: vi.fn(),
    } as unknown as WebDriver

    const plugin = new HealifySeleniumPlugin()
    const wrapped = plugin.wrap(driver)

    expect(wrapped).not.toBe(driver)
  })

  it('pasa las opciones (confidenceThreshold, onEvent) a wrapDriver', async () => {
    const originalErr = new error.NoSuchElementError('no such element')
    const driver = {
      findElement: vi.fn().mockRejectedValueOnce(originalErr),
      findElements: vi.fn(),
    } as unknown as WebDriver
    mockAnalyzeAndHeal.mockReturnValue({ fixedSelector: '.x', confidence: 0.5, explanation: '', selectorType: 'CSS' })
    const onEvent = vi.fn()

    const plugin = new HealifySeleniumPlugin({ confidenceThreshold: 0.9, onEvent })
    const wrapped = plugin.wrap(driver)

    await expect(wrapped.findElement(By.css('#old'))).rejects.toBe(originalErr)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'no-suggestion' }))
  })
})
```

This test uses the real `error.NoSuchElementError` from `selenium-webdriver` (imported at the top alongside `By`) rather than a duck-typed error object — `wrap.ts`'s `isNoSuchElementError` check uses `instanceof error.NoSuchElementError`, which a plain `Error` with a matching `.name` property would never satisfy.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run`
Expected: FAIL — `Cannot find module '../plugin'`

- [ ] **Step 3: Write the implementation**

Create `selenium-plugin/src/plugin.ts`:

```ts
import type { WebDriver } from 'selenium-webdriver'
import { wrapDriver } from './wrap'
import type { HealifySeleniumOptions } from './types'

export class HealifySeleniumPlugin {
  private readonly options: HealifySeleniumOptions

  constructor(options: HealifySeleniumOptions = {}) {
    this.options = options
  }

  /** Devuelve un proxy sobre el driver — el original nunca se muta. */
  wrap(driver: WebDriver): WebDriver {
    return wrapDriver(driver, this.options)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run`
Expected: 21 passed (8 locator + 10 wrap + 3 plugin)

- [ ] **Step 5: Commit**

```bash
git add selenium-plugin/src/plugin.ts selenium-plugin/src/__tests__/plugin.test.ts
git commit -m "feat(selenium-plugin): add HealifySeleniumPlugin class"
```

---

### Task 6: Barrel export and package build

**Files:**
- Create: `selenium-plugin/src/index.ts`

- [ ] **Step 1: Create the barrel export**

Create `selenium-plugin/src/index.ts`:

```ts
export { HealifySeleniumPlugin } from './plugin'
export type { HealifySeleniumOptions, HealingEvent, HealingEventType } from './types'
```

- [ ] **Step 2: Build the package**

Run (from `selenium-plugin/`): `npm run build`
Expected: `dist/index.js`, `dist/index.d.ts` created (the `esbuild --bundle` step inlines `plugin.ts`/`wrap.ts`/`locator.ts`/`types.ts` and `@healify/reporter-core` into `dist/index.js`; `tsc --emitDeclarationOnly` separately emits `dist/index.d.ts` plus per-file `.d.ts`/`.test.d.ts` files, matching how `cypress-plugin`/`test-runner` already build). No TypeScript errors, no esbuild errors.

- [ ] **Step 3: Verify all selenium-plugin tests still pass**

Run (from `selenium-plugin/`): `npx vitest run`
Expected: 21 passed

- [ ] **Step 4: Commit**

```bash
git add selenium-plugin/src/index.ts
git commit -m "feat(selenium-plugin): add barrel export"
```

---

### Task 7: README

**Files:**
- Create: `selenium-plugin/README.md`

Per spec §1 and the project-wide rule in `CONTEXT_HANDOFF.md` ("Nunca inflar lo que hace el motor: es heurística, no IA"), the README must lead with the same disclaimer the other packages carry, plus this package's specific out-of-scope list so nobody expects report/cloud/history features that don't exist here.

- [ ] **Step 1: Write `selenium-plugin/README.md`**

```markdown
# @healify/selenium-plugin

Wrapper de auto-sanado para Selenium `WebDriver`. Cuando `findElement` falla porque un
selector ya no existe en la página, este plugin intenta curarlo en vivo con una
heurística de pattern-matching — **no es IA, no analiza el DOM en tiempo real, no hay
red ni servidor**. Es el mismo motor que usan `@healify/test-runner` (Playwright) y
`@healify/cypress-plugin` (Cypress): [`analyzeAndHeal()`](https://github.com/mescobar996/Healify/blob/main/reporter-core/src/healing-engine.ts).

## Instalación

```bash
npm install --save-dev @healify/selenium-plugin selenium-webdriver
```

## Uso

```typescript
import { Builder } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'

const raw = await new Builder().forBrowser('chrome').build()
const driver = new HealifySeleniumPlugin({ onEvent: console.log }).wrap(raw)

// Si '#add-to-cart-btn' se rompió, el plugin intenta un selector alternativo
// antes de dejar que el error se propague.
await driver.findElement(By.css('#add-to-cart-btn')).click()
```

## Opciones

```typescript
new HealifySeleniumPlugin({
  confidenceThreshold: 0.9, // default — mismo piso que reporter-core (HEALED_THRESHOLD, auto-aplicado sin revisión)
  dryRun: false,             // default — true: cura pero nunca aplica el fix, solo emite el evento
  onEvent: (e) => {},        // opcional — se llama en cada intento de curado
})
```

## Qué locators soporta

`By.css`, `By.xpath`, `By.id`, `By.className`, `By.name` — Selenium mismo convierte
`By.id`/`By.className`/`By.name` a un selector CSS internamente antes de que este
plugin los vea, así que no hace falta heurística extra para esos tres.

`By.linkText`, `By.partialLinkText`, `By.tagName` **no están soportados** — no tienen
equivalente limpio en el motor de heurística. Si se usan, el plugin no intenta curar y
deja pasar el error de Selenium tal cual.

## Fuera de alcance (a propósito, en esta versión)

- **Modo cloud**: no existe. Healify es 100% local — sin `apiKey`, sin servidor.
- **Reporte HTML/JSON**: `test-runner`/`cypress-plugin` generan
  `healify-report.html`/`.json` porque Playwright/Cypress tienen un hook de "fin de
  corrida". Selenium no lo tiene — este plugin solo cura en vivo. Se evalúa agregar un
  método `flush()` en una versión futura.
- **Memoria entre tests** ("si otro test ya usa un selector estable, sugerirlo acá
  también"): el motor de heurística no tiene esta capacidad hoy, en ningún paquete de
  Healify. No se agregó solo para Selenium.
- **`findElements` (plural)**: pasa directo al driver real, sin intentar curar — Selenium
  devuelve `[]` cuando no hay matches, en vez de lanzar un error, así que no hay nada
  concreto que curar ahí.

## Licencia

MIT
```

- [ ] **Step 2: Commit**

```bash
git add selenium-plugin/README.md
git commit -m "docs(selenium-plugin): add README with honest scope/limitations"
```

---

### Task 8: Full monorepo verification

**Files:** none (verification only — no repo changes expected unless a bug is found)

- [ ] **Step 1: Clean install from the repo root**

Run: `npm install`
Expected: no errors, all 5 workspaces resolve.

- [ ] **Step 2: Build every workspace**

Run: `npm run build`
Expected: `reporter-core`, `test-runner`, `cypress-plugin`, `cli`, `selenium-plugin` all build without errors. Confirm `selenium-plugin/dist/index.js` and `selenium-plugin/dist/index.d.ts` exist.

- [ ] **Step 3: Test every workspace**

Run: `npm test`
Expected: all 5 workspaces report passing tests, total test count is 78 (existing, per `CONTEXT_HANDOFF.md`) + 21 (`selenium-plugin`) = **99 tests, all green**.

- [ ] **Step 4: Typecheck every workspace, matching CI exactly**

Run:
```bash
npx tsc --noEmit -p reporter-core/tsconfig.json
npx tsc --noEmit -p test-runner/tsconfig.json
npx tsc --noEmit -p cypress-plugin/tsconfig.json
npx tsc --noEmit -p cli/tsconfig.json
npx tsc --noEmit -p selenium-plugin/tsconfig.json
```
Expected: no output, exit code 0 for all five — this is exactly what the CI `typecheck` job runs.

- [ ] **Step 5: Manual smoke test against a real ChromeDriver session**

This is the one thing unit tests with mocked drivers cannot prove: that `wrapDriver`'s `Proxy` actually works against a real Selenium `WebDriver` instance (not just a hand-rolled mock object), and that a real `NoSuchElementError` from a real browser is caught correctly.

Create a scratch script `selenium-plugin/smoke-test.mjs` (temporary, not committed):

```js
import { Builder, By } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import { HealifySeleniumPlugin } from './dist/index.js'

const options = new chrome.Options().addArguments('--headless=new')
const raw = await new Builder().forBrowser('chrome').setChromeOptions(options).build()

try {
  const driver = new HealifySeleniumPlugin({ onEvent: (e) => console.log('[healify]', e) }).wrap(raw)

  await driver.get('data:text/html,<html><body><button data-testid="submit">Enviar</button></body></html>')

  // Selector roto a propósito: el botón real tiene data-testid="submit", esto busca un ID que no existe.
  const el = await driver.findElement(By.id('submit-btn-a1b2c3'))
  const text = await el.getText()

  console.log(text === 'Enviar' ? 'PASS: se curó y encontró el botón real' : `FAIL: texto inesperado "${text}"`)
} finally {
  await raw.quit()
}
```

Requires a local ChromeDriver-compatible Chrome install (skip this step with a note if none is available in this environment — it is not required for the plan's tests to be considered complete, only for extra confidence beyond the mocked test suite).

Run (from `selenium-plugin/`, after Task 6's build):
```bash
node smoke-test.mjs
```
Expected: a `[healify] { type: 'healed', ... }` log line, followed by `PASS: se curó y encontró el botón real`.

Delete `smoke-test.mjs` afterward — it's a manual verification script, not part of the package.

- [ ] **Step 6: Record the result**

Update `CONTEXT_HANDOFF.md` (not committed — it's gitignored, personal) with a new dated bitácora entry noting `@healify/selenium-plugin` added, test count, and whether the ChromeDriver smoke test ran.

---

## Notes for whoever picks this up

- Do **not** add a cloud mode, a report generator, or a `history-sibling`/selector-memory feature as part of this plan — all three are explicitly out of scope per the spec (§1, "Fuera de alcance").
- Do **not** write new heuristic rules. If a locator type doesn't cure well, the fix belongs in `reporter-core/src/healing-engine.ts` (shared by every adapter), not duplicated here.
- Publishing `@healify/selenium-plugin` to npm is not part of this plan — same manual `npm publish` step (2FA/token, done by the user) as the other 4 packages, whenever that's decided separately.

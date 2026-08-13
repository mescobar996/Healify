# Healify Guide

End-to-end guide: what it is, how to install it step by step, how the engine works, and how
to solve the most common problems. For a quick API reference of each package, see its own
README (linked below): this guide is the full walkthrough, not an API index. The
[root README](../../README.md) is the short pitch — if you're looking for something that is
not there, it lives here.

## Table of contents

1. [What Healify is and isn't](#what-healify-is-and-isnt)
2. [Installation by package](#installation-by-package)
3. [Start from zero, step by step](#start-from-zero-step-by-step)
4. [Manual installation (without `init`)](#manual-installation-without-init)
5. [How the heuristic engine works](#how-the-heuristic-engine-works)
6. [Verification against the real page](#verification-against-the-real-page)
7. [The repertoire: memory between runs](#the-repertoire-memory-between-runs)
8. [Interactive mode](#interactive-mode)
9. [Multi-language: Python, Java, C#](#multi-language-python-java-c)
10. [The HTML report](#the-html-report)
11. [Closing the loop: applying suggestions with `cli`](#closing-the-loop-applying-suggestions-with-cli)
12. [Monorepo architecture](#monorepo-architecture)
13. [Test coverage](#test-coverage)
14. [Troubleshooting](#troubleshooting)

---

## What Healify is and isn't

Healify runs alongside your Playwright, Cypress, Selenium or WebdriverIO tests. When a test
fails because a selector no longer finds the element on the page, Healify:

1. Extracts the failed selector from the error message.
2. Applies a pattern-matching heuristic over the selector text: it recognizes dynamically
   generated IDs/classes, stable attributes (`data-testid`, `aria-label`, `name`), modern
   Playwright locators, CSS combinators (`.parent > .child`), and action/field dictionaries
   in Spanish and English.
3. **When it can, it checks the suggestion against the real DOM** of the page (see
   [Verification against the real page](#verification-against-the-real-page)) — it cannot
   always do this, and the report always says whether it did.
4. Proposes an alternative selector with a confidence score (0–100%).

What it is not: it is not AI. No model, no inference, no call to any language service. The
text heuristic is a deterministic function; the same input selector always gives the same
base suggestion. The page-verification part is real (Selenium, WebdriverIO, Playwright, and
Cypress if you use `cy.healifyGet`) — Healify does not guess when it has the real data
available, it queries it.

It keeps no memory beyond what you ask it to: the repertoire (`.healify/history.jsonl`) is
opt-in, not hidden tracking.

And there is no server, account or network. Everything runs in the same process as your
tests (or in a local subprocess for the multi-language bridge, never over the internet).
The engine code lives in
[`reporter-core/src/healing-engine.ts`](../../reporter-core/src/healing-engine.ts),
auditable, not a black box.

If a selector has no recognizable pattern and could not be confirmed against the page
either, the heuristic does not invent an answer: the report marks it `unresolved` and says
so honestly.

## Installation by package

| Framework | Package | Installation | Full guide |
|---|---|---|---|
| Playwright | `@healify/test-runner` | `npm install --save-dev @healify/test-runner` | [README](../../test-runner/README.md) |
| Cypress | `@healify/cypress-plugin` | `npm install --save-dev @healify/cypress-plugin` | [README](../../cypress-plugin/README.md) |
| Selenium | `@healify/selenium-plugin` | `npm install --save-dev @healify/selenium-plugin selenium-webdriver` | [README](../../selenium-plugin/README.md) |
| WebdriverIO | `@healify/webdriverio-plugin` | `npm install --save-dev @healify/webdriverio-plugin` | [README](../../webdriverio-plugin/README.md) |
| — | `@healify/cli` | `npm install --save-dev @healify/cli` | [README](../../cli/README.md) |

Playwright and Cypress generate a report (`healify-report.html`/`.json`/`.md`) at the end
of the run automatically. Selenium and WebdriverIO have no native "end of run" hook, so
those two plugins heal selectors live and only generate `healify-report.json` (no HTML) if
you call `flush()` yourself at the end of your suite. See their READMEs for the detail and
the limitations of that mode.

## Start from zero, step by step

If you've never used Healify, this takes 2 minutes.

**Step 1: Install the CLI**

```bash
npm install -g @healify/cli
```

**Step 2: Point it at your project**

```bash
cd your-project
healify init
```

It detects your test framework (Playwright, Cypress, Selenium, WebdriverIO), installs the
adapter, wires the config, and for Selenium/WebdriverIO leaves a reference file (never
executed) showing how to wrap your driver/browser. It duplicates nothing you already have.

The output moves in steps: **1/4 detects** your framework (with the evidence: which
dependency and which config file), **2/4 installs** what's missing, **3/4 wires** the
config, **4/4 adds** three convenience npm scripts:

| Script | Command | What it's for |
|---|---|---|
| `npm run healify` | `healify fix` | apply fixes when a selector breaks |
| `npm run healify:dry` | `healify fix --dry-run` | see suggestions without touching files |
| `npm run healify:dashboard` | `healify dashboard --serve` | see your healing history |

When it finishes it runs an **instant check** (`healify doctor`) that shows the real state
of the project, and closes by telling you the exact command to run your tests for the
framework it detected. `healify init --dry-run` shows the whole plan without executing
anything.

> **Don't even have the framework installed?** Skip the diagnostics: run
> `healify init` directly. It asks which framework to set up, installs it and leaves the
> config wired. **It never generates tests**: the first broken selector Healify heals has
> to be one from your own app, not an invented one. Details of the 3 cases in the
> [CLI README](../../cli/README.md).

**Step 3: Start your app and write your first real test**

An e2e test opens a real browser and navigates to a real URL. Before writing or running
anything, start your app in a separate terminal and leave it running (`npm run dev`), and
confirm it responds by opening that URL by hand in the browser.

Only then write your first test. Healify does not generate it: the first selector it heals
has to be one from your own app.

**If you use Playwright**, create `e2e/mi-primer-test.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('mi primer test', async ({ page }) => {
  await page.goto('/')
  await page.click('#reemplazar-por-tu-selector-real')
})
```

**If you use Cypress**, create `cypress/e2e/mi-primer-test.cy.ts`:

```ts
it('mi primer test', () => {
  cy.visit('/')
  cy.get('#reemplazar-por-tu-selector-real').click()
})
```

- `goto('/')` / `visit('/')` opens the browser at your `baseURL`. The bare slash is the
  home page; you can use `/login` or any other route.
- `click(...)` looks up an element and clicks it. **That is the selector Healify will heal
  when it breaks** — the rest of the test is scaffolding.
- `#reemplazar-por-tu-selector-real` is a placeholder. Replace it with a real one from your
  app or the test will fail for the wrong reason.

`init` prints this same snippet when it finishes, already adjusted to your project: `.js`
if you don't use TypeScript, and `require` instead of `import` if your `package.json` is
CommonJS.

To get a real selector: open your app in the browser, right-click the element →
*Inspect*. Look for an `id` (`#my-id`) or a `data-testid` (`[data-testid="my-id"]`). If it
has neither, a class works (`.my-class`), though classes are more fragile — exactly the
kind of fragility Healify detects.

> **Use the framework `init` detected.** Running `npx cypress run` in a project that only
> has Playwright configured fails because Cypress is missing, not because of Healify.

With the file created and your app running:

```bash
npx playwright test
# or, if your project uses Cypress
npx cypress run
```

When it finishes, `healify-report.html`, `healify-report.md` and `healify-report.json`
are created at the root — always, whether tests failed or not. If the run was clean, the
report says so with a **PASS** verdict instead of staying empty.

**Step 4: See the report and apply the fix**

```bash
npx @healify/cli fix --dry-run       # see what it would do, touching nothing
npx @healify/cli fix                 # apply the highest-confidence fixes
npx @healify/cli fix --interactive   # or decide case by case
```

Open `healify-report.html` to see something like `Healed: 1 | Review: 1 | Unresolved: 2`.
Done.

**Step 5: See the dashboard and the daily loop**

```bash
npm run healify:dashboard    # or npx @healify/cli dashboard --serve
```

Starts the local dashboard (http://127.0.0.1:5173) with your healing history, acceptance
rate per framework and chronic selectors.

From here on, daily use is a three-command loop:

```bash
npx playwright test          # 1. run your tests (YOUR framework's command)
npm run healify              # 2. if a selector broke, apply the fix
npm run healify:dashboard    # 3. see what you healed and how much was accepted
```

### Commands by framework

| Framework | Run tests | Apply fix | Dashboard |
|---|---|---|---|
| Playwright | `npx playwright test` | `npm run healify` | `npm run healify:dashboard` |
| Cypress | `npx cypress run` | `npm run healify` | `npm run healify:dashboard` |
| Selenium | `npm test` | `npm run healify` | `npm run healify:dashboard` |
| WebdriverIO | `npx wdio run` | `npm run healify` | `npm run healify:dashboard` |

The end of `init` tells you the right test command for what it detected — if you forgot,
run `npx @healify/cli doctor` and look at the first check.

## Manual installation (without `init`)

<details>
<summary><strong>Playwright</strong></summary>

```bash
npm install --save-dev @healify/test-runner
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  reporter: [['list'], ['@healify/test-runner/reporter']],
})
```

</details>

<details>
<summary><strong>Cypress</strong></summary>

```bash
npm install --save-dev @healify/cypress-plugin
```

`cypress.config.ts`:

```ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'
export default defineConfig({
  e2e: { setupNodeEvents: (on, config) => HealifyCypressPlugin(on, config) },
})
```

Optional, for live healing (`cy.healifyGet`): add
`import '@healify/cypress-plugin/support'` to your support file.

</details>

<details>
<summary><strong>Selenium</strong></summary>

```bash
npm install --save-dev @healify/selenium-plugin selenium-webdriver
```

```ts
import { Builder, By } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'
const raw = await new Builder().forBrowser('chrome').build()
const healify = new HealifySeleniumPlugin({ onEvent: console.log })
const driver = healify.wrap(raw)
await driver.findElement(By.css('#add-to-cart-btn')).click()
// at the end of the suite, if you want a healify-report.json:
healify.flush()
```

Heals live, verified against the real DOM. `flush()` generates `healify-report.json` (no
HTML). See its README for limitations.
</details>

<details>
<summary><strong>WebdriverIO</strong></summary>

```bash
npm install --save-dev @healify/webdriverio-plugin
```

```ts
import { remote } from 'webdriverio'
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'
const raw = await remote({ capabilities: { browserName: 'chrome' } })
const healify = new HealifyWebdriverIOPlugin({ onEvent: console.log })
const browser = healify.wrap(raw)
await browser.$('#add-to-cart-btn').click()
// at the end of the suite, if you want a healify-report.json:
healify.flush()
```

Heals live, verified against the real DOM. `flush()` generates `healify-report.json` (no
HTML). See its README for limitations.
</details>

## How the heuristic engine works

Everything lives in `reporter-core/src/healing-engine.ts`, shared by all the packages.
Main rules:

| Pattern detected | Example | Suggestion |
|---|---|---|
| ID with digits or hex suffix | `#user-a1b2c3` | Class derived from the same name, without the dynamic suffix |
| CSS-modules or styled-components class | `.btn_a1b2`, `.sc-x7f2` | Alternative semantic selector (role, text, `data-testid`) |
| `data-testid` / `data-cy` / `data-qa` / `data-test` / `data-e2e` | `[data-testid="x"]` | Kept and normalized, the highest-confidence candidate |
| XPath | `//div[3]/button` | Replaced with an ARIA role selector (XPath is the most fragile type) |
| `[name=]` / `[aria-label=]` | `[name="email"]` | Kept as-is, already reasonably stable attributes |
| Modern Playwright locator | `getByRole(...)`, `getByText(...)` | Not touched, marked for manual review |
| Positional | `li:nth-child(3) > a` | Marked fragile, a role selector is proposed |
| Composite CSS combinator | `.card .title`, `.parent > .child` | Only the target element (last segment) is kept, without the ancestor path |

For buttons/inputs/links detected by patterns in the selector text (`button`, `input`,
`login`, etc.), the engine builds the suggestion with bilingual dictionaries
(`ACTIONS`/`FIELDS` in `healing-engine.ts`): `login`→`Login`/`Iniciar Sesión`,
`email`→`Email`/`Correo`, `guardar`→`Guardar`, etc.

Confidence: each strategy has a base score. Without page verification, it is adjusted
deterministically (not randomly) by a hash of the selector, so the same DOM-less input
always gives the same result, bounded between 75% and 98%. With verification, the real
confidence replaces the hash adjustment.

Thresholds (defined in `reporter-core/src/local-mode.ts`):

| Confidence | Status | What it means |
|---|---|---|
| ≥ 90% | `healed` | Auto-applicable without review; this is what `@healify/cli fix` uses |
| 80–90% | `review` | Shown in the report, but requires your confirmation |
| < 80% | `unresolved` | No suggestion; the engine prefers not to risk it |

## Verification against the real page

The engine works two ways, and the difference matters. The report always tells you which
one it used per case (`verified: true/false`).

**Verified against the page (Playwright, Selenium, WebdriverIO, and Cypress via
`cy.healifyGet`).** Each path gets there differently:

- **Playwright** saves the accessibility tree of the screen when a test fails. Healify
  reads it from the file Playwright already wrote.
- **Selenium and WebdriverIO** heal live: at the exact moment a `findElement`/`$()` fails,
  they still have the browser open in hand. Healify queries the real DOM right there
  (`executeScript`/`execute`).
- **Cypress** is passive by default (`after:spec`/`after:run`, no access to the real DOM,
  since the spec and the engine run in separate processes). `cy.healifyGet(selector)` —
  opt-in, `import '@healify/cypress-plugin/support'` — replaces `cy.get()` at specific
  points where you know a selector is fragile: it probes the real DOM via `cy.task` and
  verifies before retrying. Anything that does not go through `healifyGet` stays without
  the verified mark.

In every verified case the result is the same: Healify confronts its suggestions against
what was actually on screen — discards what does not exist and takes names from the page
instead of inferring them. A broken `#buy-now-a1b2c3` resolves to
`role('button', { name: 'Buy' })` with the button's real text, and the fix is applied by
rewriting the call (`page.click(...)` → `page.getByRole(...)`, or the equivalent XPath for
Selenium/WebdriverIO, which do not interpret Playwright syntax).

If nothing matches, the report says so: the element may no longer exist, and then the
problem is not the selector but the missing functionality.

In every case it is string/DOM comparison against data already on your machine: no AI, no
network, no server.

## The repertoire: memory between runs

Every healing **verified against the real page** can be recorded in
`.healify/history.jsonl` — a local JSONL in the project, with the same format across all
adapters (JS, Python, Java, C#).

The next time that same selector breaks in the same file, if that run **cannot** verify
anything on its own (Cypress without `cy.healifyGet`, or any framework in an environment
where probing was not available that time), Healify does not guess blind again: it reuses
the correction that was already confirmed before.

The live verification of the current run always wins — if the page changed, what you see
now is more reliable than what was recorded last time. The repertoire is a fallback, not a
replacement. And it is shared across languages: a verified healing from Playwright (JS)
can resolve a broken selector in a Python test, if they run against the same repo.

`npx @healify/cli history` shows which selectors break most often and which broke again
after being healed — useful to prioritize which elements deserve a stable `data-testid`.

## Interactive mode

```bash
npx @healify/cli fix --interactive
```

Instead of applying everything above the automatic threshold, Healify shows you each
suggestion — selector, proposal, confidence, whether it is verified against the page or
comes from the repertoire — and asks. It also offers the "review" cases (80–89%
confidence), which plain `fix` never touches: if you decide they make sense, they get
applied too. `a` applies the rest without further questions, `q` stops and leaves the rest
untouched. It needs a real terminal — in CI or behind a pipe, it warns and continues in
automatic mode instead of hanging.

## Multi-language: Python, Java, C#

The engine is not tied to JS: `npx @healify/cli heal` exposes it as a command that reads
JSON from stdin and writes JSON to stdout — heuristic, page verification and repertoire
included. `npx @healify/cli probe-script` prints the DOM probing script that runs in the
browser. Any language that can spawn a subprocess can use it.

- **Python**: `pip install healify-selenium` — real package, verified end to end.
- **Java**: Maven, `io.github.mescobar996:healify-selenium:0.1.0` — real package,
  published on Maven Central, verified end to end.
- **C#**: reference adapter (code to copy and adapt, no NuGet package yet), verified end
  to end with .NET 8 + real Chrome.

Full JSON bridge contract in [`docs/adapters/README.md`](../adapters/README.md) in case
your language does not have an adapter yet.

## The HTML report

`healify-report.html` (generated by `test-runner`/`cypress-plugin`) has two sections:

- **"Needs your attention"**: `review` and `unresolved` cases, ordered by severity (no
  suggestion first, then ascending confidence). Expanded by default.
- **"Healed automatically"**: `healed` cases, collapsed by default.

You can mark cases as "fixed" (persists in `localStorage`, scoped by project and run),
copy the suggestion with one click, and switch between light/dark themes. Everything runs
in the HTML itself, no server. The file is fully self-contained.

The three formats (`html`/`md`/`json`) start with a **PASS/FAIL** verdict of the run and
the environment where it executed (framework, version, browser, base URL, OS, Node,
duration). Every defect carries a stable ID (`HLF-A1B2C3`, same selector + same file →
same ID always), severity, expected vs. actual result, reproduction steps (those the
framework actually recorded) and evidence (link to the screenshot the framework already
saved, if you have it enabled). What an adapter cannot know does not appear — Selenium and
WebdriverIO have no concept of "suite", so their report does not invent a test total.

## Closing the loop: applying suggestions with `cli`

```bash
npx @healify/cli fix                # applies the "healed" cases from ./healify-report.json
npx @healify/cli fix --dry-run       # shows what it would do, writing nothing
```

It only touches cases with ≥90% confidence, never guesses on ambiguous selectors (2+
occurrences in the same file) and never touches files with uncommitted git changes (except
`--force`). See [`cli/README.md`](../../cli/README.md) for the full detail.

## Monorepo architecture

```
reporter-core/     # Heuristic engine + shared types (private)
  ├─ healing-engine.ts       # The rules in the table above
  ├─ browser-probe.ts        # DOM probing script (Selenium/WebdriverIO/Cypress)
  ├─ repertoire.ts           # Parse/match of .healify/history.jsonl
  ├─ local-mode.ts           # Thresholds + runLocalHealing()
  ├─ local-report.ts         # Generates the HTML/JSON
  └─ selector-extractor.ts   # Parses the selector from the error message

test-runner/         # Playwright adapter (Reporter + optional fixture)
cypress-plugin/      # Cypress adapter (setupNodeEvents + optional cy.healifyGet)
selenium-plugin/     # Selenium WebDriver wrapper (Proxy over findElement)
webdriverio-plugin/  # WebdriverIO wrapper
cli/                  # init/doctor/fix/history + heal/probe-script (multi-language bridge)
python/healify-selenium/  # PyPI package
java/healify-selenium/    # Maven Central package
docs/adapters/        # C# reference adapter, bridge contract
```

The framework packages depend on `reporter-core` but never reimplement its rules: if a
selector heals wrong in one framework, the fix goes in `healing-engine.ts`, not in the
adapter.

npm workspaces, strict TypeScript, Vitest for unit tests, `esbuild` to bundle
`reporter-core` inline in every publishable package (it is private, never installed on its
own).

## Test coverage

```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
npm run build
npm run verify     # build + all tests, per-package summary
npm run coverage   # line coverage per package (v8)
```

| Package | Lines |
|---|---|
| reporter-core (the engine) | 93.4% |
| cypress-plugin | 94.8% |
| selenium-plugin | 98.8% |
| webdriverio-plugin | 87.6% |
| cli | 93.0% |
| test-runner | 79.5% |
| mcp | 88.6% |
| dashboard-web | 76.8% |
| ai-local | 33.8% |

Reproducible on your machine with `npm run coverage`. The heuristic engine
(`reporter-core`), where all the real logic lives, is the most covered; framework adapters
are thinner and some paths only run against a real browser.

## Troubleshooting

**"The report says `unresolved` on almost all my cases."** If your framework does not
verify against the real DOM (Cypress without `cy.healifyGet`) and your selectors have no
recognizable pattern (no `data-testid`, no `name`, no clear action text), the engine has
nowhere to get a reliable suggestion from. This is expected, not a bug. Adding
`data-testid` to the elements you test is the most reliable way to raise the healing rate.

**"`@healify/cli fix` skipped a case with `role(...)`."** Expected. Those suggestions are
human-readable text for the report, not a pasteable selector (`role('button', { name: 'X' })`
is not valid Playwright/Selenium code). Applying it as-is would corrupt the file, so it
skips with a notice instead of breaking anything.

**"`ENOENT: healify-report.json`."** You have not run the tests yet. Run `doctor` first,
then your tests, only then `fix`.

**"The test fails right at startup, with something that has nothing to do with my app (a
blank page, content from another tool)."** Another program may be using the same port as
your `baseURL`. Confirm who is answering there before suspecting Healify or your selector:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress, OwningProcess
```

If a process that is not your app appears, run your `dev` on another port (adjusting
`baseURL` in `playwright.config.ts`/`cypress.config.*` by hand, or changing the port in
your `dev` script permanently if the conflict repeats).

**"`init`/`doctor` do not show the new stuff from this version."** Check which version you
actually have installed (`npx @healify/cli --version`). If you come from an install older
than 1.0.0, `doctor` warns you if your `package.json` still has an old `^0.x.y` range (the
semver gotcha: `^0.4.1` means "any `0.4.x`", it does not bump you to `0.5.0` on its own,
let alone `1.x.x`). Update it by asking for the version explicitly:

```bash
npm install --save-dev @healify/cli@latest @healify/test-runner@latest
```

This does not happen the first time you install Healify in a new project (there you get
`^1.0.0`, which does bump minor versions with a plain `npm install`).

**"The report mentions `Cloud mode` / `HEALIFY_API_KEY` in old versions of a README."**
That mode existed, but the server that received those reports no longer exists in this
repo (it was removed together with the full SaaS; see the "History" section of the root
README). Healify today is 100% local.



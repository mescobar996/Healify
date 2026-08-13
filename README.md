<div align="center">
  <img src="landing/public/logo-static.svg" alt="Healify Logo" width="64" style="filter: drop-shadow(0 0 20px rgba(16,185,129,0.4))" />

  <h3>Healify repairs broken E2E selectors. Local and deterministic.</h3>
  <p><strong>Playwright · Cypress · Selenium · WebdriverIO</strong></p>

  <img src="https://img.shields.io/badge/version-2.8.0-blue" alt="version 2.8.0" />
  <img src="https://img.shields.io/badge/tests-1164%20passing-brightgreen" alt="1164 tests passing" />
  <img src="https://img.shields.io/badge/coverage-93%25-brightgreen" alt="93% CLI coverage" />
  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" />

  <p>
    <a href="docs/"><strong>Docs</strong></a> ·
    <a href="examples/"><strong>Examples</strong></a> ·
    <a href="https://healify-sigma.vercel.app"><strong>Demo</strong></a> ·
    <a href="README.es.md">Español</a>
  </p>
</div>

---

## What it does

A button's `id` changed in the last deploy. Your suite goes red. Healify reads the page
evidence your test framework already captured and tells you which stable selector to use
instead.

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Add to cart' }).click()
```

It does not guess and it does not use AI. Deterministic heuristics, same input, same output,
nothing leaves your machine. When it refuses to propose a fix, it says so and why.

The honest limit, up front: broken selectors cause roughly a quarter of e2e failures. Timing,
test data and real assertion failures are the rest. Healify names those instead of "fixing"
them, because a tool that swaps a selector to make a failing assertion pass is hiding the bug
the test caught. That is worse than a red build.

## How to use it

Five steps. The first time takes two minutes.

**1. Install it once**

```bash
npm install -g @healify/cli
```

**2. Point it at your project**

```bash
cd your-project
healify init
```

It detects your test framework (Playwright, Cypress, Selenium, WebdriverIO), installs the
adapter, wires the config, adds `healify` / `healify:dry` / `healify:dashboard` npm scripts,
and runs a `healify doctor` check. It never writes tests.

**3. Run your tests**

```bash
npx playwright test   # Playwright
npx cypress run       # Cypress
npm test              # Selenium
npx wdio run          # WebdriverIO
```

Nothing happens until a selector actually breaks. Healify waits for your suite to fail.

**4. When a selector breaks, heal it**

```bash
npm run healify            # applies the fix to your test files
npm run healify:dry        # shows what it would change, touches nothing
```

The report tells you which selector broke, what it proposes, with what confidence, and
whether it verified the fix against the real page.

**5. See what you healed**

```bash
npm run healify:dashboard
```

Local dashboard with your healing history, acceptance rate per framework and chronic
selectors. Data stays on your machine.

The full walkthrough, with every command explained, is in the
[step-by-step guide](docs/guide/README.md).

## What's in the box

- **CLI**: `fix`, `init`, `doctor`, `dashboard`, `history`, `heal`, `watch` → [docs/cli.md](docs/cli.md)
- **Adapters**: Playwright, Cypress, Selenium, WebdriverIO, plus reference code for
  Python/Java/.NET → [docs/adapters](docs/adapters)
- **Dashboard**: local stats, efficacy, chronic selectors → [docs/DASHBOARD.md](docs/DASHBOARD.md)
- **GitHub Action**: comments on PRs or opens fix PRs from test logs → [docs/github-action.md](docs/github-action.md)
- **Tickets**: Jira, GitHub Issues and webhooks from a broken selector → [docs/jira.md](docs/jira.md)
- **MCP server**: answers questions from AI agents → [mcp/](mcp/)
- **VS Code extension**: underlines fragile selectors as you type → [vscode-extension/](vscode-extension/)
- **Local AI, optional**: explanations in natural language via Ollama → [docs/ai/](docs/ai/)

## Repository

An npm monorepo with 9 `@healify/*` workspaces.

| Package | Role |
|---|---|
| `reporter-core` | Healing engine: heuristics, DOM probing, repertoire. Private, not published |
| `cli` | Command-line interface |
| `test-runner` | Playwright adapter |
| `cypress-plugin` | Cypress adapter |
| `selenium-plugin` | Selenium adapter |
| `webdriverio-plugin` | WebdriverIO adapter |
| `dashboard-web` | React UI for the local dashboard |
| `ai-local` | Optional local AI via Ollama |
| `mcp` | MCP server for AI agents |

Quality: 1,164 unit tests, all passing. CI enforces anti-regression coverage thresholds, every
package above 80% stays there. Current per-package numbers live in
[docs/project-status.md](docs/project-status.md).

One gotcha before touching code: workspaces import each other as `@healify/reporter-core`,
which resolves to the built `dist/`. Run `npm run build` first after a fresh checkout.

## Start here

- **[Documentation](docs/)** — installation, commands, configuration
- **[Examples that run](examples/)** — complete projects, verified in CI against a real browser
- **[Contributing](CONTRIBUTING.md)** — dev commands, commit policy, how to add an adapter
- **[Security](SECURITY.md)** — how to report a vulnerability

---

<sub>
MIT · Every release signed and traceable to a public commit
(<a href="https://search.sigstore.dev/?packageName=%40healify">verify it here</a>) ·
© 2026 Matías Escobar, Rosario, Argentina
</sub>

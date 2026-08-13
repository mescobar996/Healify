[← Back to Healify](../README.md) · [Español](README.es.md)

---

# Documentation

Everything you need to use Healify for real.

## Getting started

New to Healify? Start here:

| | |
|---|---|
| **[Step-by-step guide](guide/README.en.md)** | The full walkthrough: install, `init`, write your first test, heal a broken selector, see the dashboard. Five steps, two minutes. |
| **[Quickstart (installation)](installation.md)** | Wiring it into Playwright, Cypress, Selenium or WebdriverIO. One snippet per runner. |
| **[Commands](cli.md)** | `doctor`, `fix`, `dashboard`, `flake`, `watch` and the rest of the CLI. |

## Tune it

| | |
|---|---|
| **[Configuration](configuration.md)** | Confidence thresholds, turning healing off, your own test-ids. Optional — it works with none of this. |
| **[Reports & dashboard](reports.md)** | The HTML report you hand to your team, the healing history, and flaky-test detection. |

## Integrations

| | |
|---|---|
| **[VS Code extension](../vscode-extension/)** | Fragile selectors underlined as you type; the ones that actually broke get a verified `Ctrl+.` fix. |
| **[GitHub Action](github-action.md)** | Comments broken selectors on every PR. Never modifies files. |
| **[Jira / webhook reporting](jira.md)** | Defects land in your backlog with evidence. Opt-in, off by default. |

## Examples that actually run

Not snippets: complete projects, verified in CI against a real browser.

| | |
|---|---|
| **[Playwright + Page Object Model](../examples/playwright-pom/)** | The selector lives in `pages/`, not in the test. Healify finds it anyway. |
| **[Cypress + Shadow DOM](../examples/cypress-shadow-dom/)** | The button is inside a web component, where `querySelector` returns zero. |
| **[Selenium + live healing](../examples/selenium-live-heal/)** | `plugin.wrap(driver)` and nothing else. The test never changes. |

## Understanding the why

| | |
|---|---|
| **[Competitive analysis](research/competitive-gaps.md)** | The 15 tools in this space that were researched before writing a line, and what Healify was missing against each. |
| **[Adapters](adapters/README.md)** | Using the engine from Python, Java, C# or whatever you have, over JSON on stdin/stdout. |
| **[Optional local AI](ai/README.md)** | `healify ai` with Ollama. Optional, and also 100% local. |

---

Something missing or unclear? [Open an issue](https://github.com/mescobar996/Healify/issues) —
documentation nobody understands is a bug.

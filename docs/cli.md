[← Documentation](README.md) · [Healify](../README.md) · [Español](cli.es.md)

---

# Commands

> Everything the CLI does. None of it sends data anywhere.

| Command | What it does |
|---|---|
| `healify init` | Detects your framework (or asks which one to set up if there isn't one), installs what's missing and configures the reporter/plugin. Does not generate tests. |
| `healify doctor` | Checks that Healify is installed and correctly configured. |
| `healify fix [report.json]` | Applies the highest-confidence suggestions straight into your test files. |
| `healify history` | Shows recurring and re-broken selectors from `.healify/history.jsonl`. |
| `healify report [report.json]` | Reports the run's defects to your Jira (or a webhook). Deduped by `defectId`, opt-in. |
| `healify dashboard [--out <path>]` | Generates `healify-dashboard.html`, the offline view of your healing history (same look as `healify-report.html`). |
| `healify flake [--min-runs <n>]` | Detects flaky tests (green on some runs, red on others) from `.healify/runs.jsonl`, which the Playwright/Cypress reporters record on every run. |
| `healify heal [--stats]` | The engine over JSON on stdin/stdout, so you can drive it from Python/Java/C#/etc. `--stats` prints the summary of the stats accumulated in `~/.healify/stats.json` (to stderr, so stdout stays pure JSON). |
| `healify probe-script` | Prints the script to probe the DOM with `execute_script()` (input for `heal`). |
| `healify explain [selector]` | Explains why a selector is brittle and what the engine proposes. |
| `healify ai <setup\|status\|explain\|chat\|models>` | Optional local AI via Ollama. |

## `healify fix` flags

| Flag | Effect |
|---|---|
| `--dry-run` | Shows what would be healed without modifying files. |
| `--force` | Applies even if the file has uncommitted changes. |
| `--pr` | Creates branch + commit + PR automatically (requires the `gh` CLI). |
| `--no-ast` | Disables rewriting `role(...)` suggestions (plain substitution instead). |
| `--no-pom` | Don't look for the selector in page objects when it isn't in the test file. |
| `--watch` | Keeps watching the report and re-applies on every new run. `--interval <ms>` to adjust (default 1000). |
| `--interactive` | Asks case by case before applying. |

### Watch mode

```bash
npx @healify/cli@latest fix --watch
```

It stays listening: every time your tests write a new report, it applies on its own. The
equivalent of Playwright's `--ui` but on Healify's side — leave the terminal open and you don't
have to remember anything.

If there's no report yet, it says so once and waits. The first pass is immediate, so if one was
already there when you started, it applies right away. `--pr` and `--interactive` don't apply
here (opening a PR per run, or asking you something while you're looking elsewhere, makes no
sense).

### Page Object Model

If the broken selector isn't in the spec (the norm with POM: it lives in `pages/login.page.ts`),
`fix` looks for it across the rest of your project's code and applies the change there, telling
you which file it touched. Conservative by design: it only applies when there's **exactly one**
file with **exactly one** occurrence; with two candidates it reports ambiguity and touches
nothing. Turn it off with `--no-pom`.

## `healify heal` (for adapters)

```bash
echo '{"testFile":"test.py","testName":"test_login","selector":"#old-btn","errorMessage":"..."}' | npx @healify/cli@latest heal
# -> {"fixedSelector":"[data-testid='login']","confidence":0.95,"verified":true,...}
```

Every run measures its own phases (`probeMs`, `analysisMs`, `healingMs`, `totalMs`) and, unless
you pass `--stats`-free output, accumulates them in `~/.healify/stats.json`. Nothing leaves the
machine — there's no telemetry. `--stats` prints the summary on stderr so the JSON on stdout
stays parseable:

```bash
echo '{"selector":"#old-btn"}' | npx @healify/cli@latest heal --stats
# stdout: {"fixedSelector":"[data-testid='login']","confidence":0.95,"verified":true,...}
# stderr: ✅ 42 selectores sanados (21 roles, 17 testids, 4 css) en 238ms — tasa de éxito: 78%
```

# Submit @healify/cypress-plugin to Cypress Plugin List

## Steps

1. Fork `cypress-io/cypress-documentation`
2. Clone your fork
3. Add the entry from `docs/cypress-plugin-submission.json` to `src/data/plugins.json`
4. Commit and push
5. Open PR against `main` branch

## PR Title

feat(plugins): add @healify/cypress-plugin to plugins list

## PR Description

Adds @healify/cypress-plugin to the community plugins list.

### What it does

Self-healing selectors for Cypress — when a test fails due to a broken selector, Healify analyzes the DOM and proposes alternatives. 100% local, no API key, no AI.

### Key features

- 100% local — no internet, no API key, no account
- Heuristic + verification — deterministic, not AI
- DOM snapshot — captures context at failure time
- Audit logging — full trail for every healing event
- Confidence scores — know how reliable each fix is
- Multi-framework — same engine for Playwright, Cypress, Selenium, WebdriverIO

### Links

- npm: https://www.npmjs.com/package/@healify/cypress-plugin
- GitHub: https://github.com/mescobar96/healify
- Documentation: https://github.com/mescobar96/healify/blob/main/docs/cypress-plugin.md

### Checklist

- [ ] Integration tests with Cypress
- [ ] CI pipeline
- [ ] Compatible with Cypress >= 13.0.0
- [ ] Documentation with installation guide
- [ ] MIT License

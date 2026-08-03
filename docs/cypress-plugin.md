# Healify Cypress Plugin

## Installation

```bash
npm install @healify/cypress-plugin --save-dev
```

Requires `cypress >= 13.0.0` as a peer dependency.

## Configuration

### 1. Register the plugin

In your `cypress.config.ts`:

```typescript
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return HealifyCypressPlugin(on, config)
    },
  },
})
```

### 2. Import support code (optional, for live healing)

In your `cypress/support/e2e.ts`:

```typescript
import '@healify/cypress-plugin/support'
```

This imports the browser-side support code that:
- Registers a global `Cypress.on('fail')` handler for audit logging.
- Adds the `cy.healifyGet()` command for live selector healing.

## Usage

### Automatic Report Generation

Once configured, Healify automatically intercepts failed tests and generates a report at the end of the Cypress run:

- `healify-report.html` — interactive HTML report (dark/light, offline)
- `healify-report.json` — machine-readable JSON report
- `healify-report.md` — markdown summary

If any selectors failed and were healed via `cy.healifyGet()`, an audit log is also written:

- `healify-audit.json` — detailed audit trail of healing events

### Live Healing with `cy.healifyGet`

After importing the support code, you can use `cy.healifyGet()` to attempt real-time healing against the live DOM:

```typescript
// Instead of:
cy.get('#comprar-ahora-a1b2c3').click()

// Use:
cy.healifyGet('#comprar-ahora-a1b2c3').click()
```

If the selector is not found within the timeout, Healify:
1. Probes the current page DOM
2. Runs its heuristic to find a working alternative
3. Retries with the suggested selector before failing the test

**Options:**

```typescript
cy.healifyGet(selector, {
  timeout: 4000,                    // ms to wait (default: Cypress defaultCommandTimeout)
  confidenceThreshold: 0.9         // minimum confidence to apply a fix (default: 0.9)
})
```

### Audit Logging

Healify automatically generates an audit log (`healify-audit.json`) when selectors fail or are healed. Example entry:

```json
{
  "entries": [
    {
      "id": "...",
      "timestamp": "...",
      "originalSelector": "#comprar-ahora-a1b2c3",
      "healedSelector": "button[data-testid='buy-now']",
      "framework": "cypress",
      "confidence": 0.95,
      "verified": true
    }
  ]
}
```

## API Reference

### `HealifyCypressPlugin(on, config)`

Registers the Healify plugin with Cypress's Node process.

**Parameters:**
- `on` — Cypress plugin event handler
- `config` — Cypress configuration object

**Returns:** The same `config` object, unchanged.

**What it does:**
- Registers tasks: `healify:probe-script`, `healify:heal`, `healify:record-event`, `healify:audit-entry`
- Listens to `after:spec` to run local healing on failed tests
- Listens to `after:run` to write reports and print a summary

### `@healify/cypress-plugin/support`

Imports the browser-side support code that:
- Registers the `cy.healifyGet()` command
- Registers a global `fail` handler for audit logging

### `cy.healifyGet(selector, options?)`

Custom Cypress command that attempts to find a selector, and if it fails, probes the DOM and retries with a healed alternative.

**Parameters:**
- `selector` (string) — CSS or XPath selector to find
- `options` (optional):
  - `timeout` (number) — milliseconds to wait for the selector (default: Cypress defaultCommandTimeout)
  - `confidenceThreshold` (number) — minimum confidence 0-1 to accept a healed selector (default: 0.9)

**Returns:** `Chainable<JQuery<HTMLElement>>`

## CLI Integration

After generating a report, you can apply fixes automatically:

```bash
npx @healify/cli fix --dry-run      # preview changes
npx @healify/cli fix                 # apply high-confidence fixes
npx @healify/cli fix --interactive   # choose which fixes to apply
```

## Troubleshooting

### Plugin not working

1. Ensure you've added both the config (`HealifyCypressPlugin`) and support imports.
2. Check that `@healify/reporter-core` is installed (it's a dependency of the plugin).
3. Verify your selectors are using standard CSS/XPath syntax.

### Audit log not generated

The audit log (`healify-audit.json`) is only created when selectors fail or are healed via `cy.healifyGet()`. If all tests pass with valid selectors, no audit log is created.

### Reports not appearing

Reports are written to the current working directory when Cypress finishes running. Make sure you run Cypress from the project root where you expect the files.

### `cy.healifyGet` not found

Ensure you have imported the support file in `cypress/support/e2e.ts`:

```typescript
import '@healify/cypress-plugin/support'
```

## How It Works

1. **Local Healing (always active):** When a test fails, Cypress's `after:spec` hook triggers Healify's heuristic on the failed test. It pattern-matches on selector text and error messages without network access.

2. **Live Healing (opt-in via `cy.healifyGet`):** When a selector is not found, the command probes the real DOM, sends the page elements to the Node process via `cy.task()`, receives a healed selector, and retries.

3. **Audit Trail:** Every healing event is recorded to `healify-audit.json` with timestamps, original/healed selectors, confidence scores, and verification status.

## Example

```typescript
// cypress/e2e/checkout.cy.ts
describe('Checkout', () => {
  it('adds item to cart', () => {
    // If this selector breaks, Healify will try to fix it
    cy.healifyGet('#add-to-cart-btn').click()
    cy.healifyGet('.checkout-form').should('be.visible')
    cy.healifyGet('button[type="submit"]').click()
  })
})
```

Running `npx cypress run` will generate a report with any healing suggestions.
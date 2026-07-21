# @healify/cypress-plugin

Healify reporter for Cypress. Reports broken selectors to Healify without requiring GitHub repo access or webhook setup.

## Setup

```bash
npm install --save-dev @healify/cypress-plugin
```

Requires `cypress >= 13.0.0` as a peer dependency.

## Usage

### 1. Register the plugin

In `cypress.config.ts`:

```ts
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

### 2. Set environment variables

| Env var | Required | Description |
|---|---|---|
| `HEALIFY_API_KEY` | Yes | Your project API key from the Healify dashboard |
| `HEALIFY_API_URL` | No | API base URL (defaults to `https://healify-sigma.vercel.app`) |
| `HEALIFY_BRANCH` | No | Git branch name to include in reports |
| `HEALIFY_COMMIT_SHA` | No | Git commit SHA to include in reports |

Set these in your CI/CD provider or `cypress.env.json`.

## How it works

1. After each spec finishes, the plugin inspects all failed tests.
2. It extracts the failing selector from the error message and POSTs the report to Healify.
3. Healify's AI analyzes the selector and returns a suggested fix.

The plugin is fire-and-forget — reports are sent via `Promise.allSettled` and never block the Cypress run. When `HEALIFY_API_KEY` is not set, the plugin returns the config unchanged (zero overhead when disabled).

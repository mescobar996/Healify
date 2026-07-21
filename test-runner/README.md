# @healify/test-runner

Healify reporter for Playwright. Reports broken selectors to Healify without requiring GitHub repo access or webhook setup.

## Setup

```bash
npm install --save-dev @healify/test-runner
```

Requires `@playwright/test >= 1.40.0` as a peer dependency.

## Usage

### 1. Configure the reporter

In `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [
    ['list'],
    ['html'],
    ['@healify/test-runner/reporter'],
  ],
})
```

### 2. Use the extended fixture

Replace `import { test, expect } from '@playwright/test'` with:

```ts
import { test, expect } from '@healify/test-runner'
```

The extended fixture captures the page HTML on failure and attaches it as `healify-dom` for context in the report.

### 3. Set environment variables

| Env var | Required | Description |
|---|---|---|
| `HEALIFY_API_KEY` | Yes | Your project API key from the Healify dashboard |
| `HEALIFY_API_URL` | No | API base URL (defaults to `https://healify-sigma.vercel.app`) |
| `HEALIFY_BRANCH` | No | Git branch name to include in reports |
| `HEALIFY_COMMIT_SHA` | No | Git commit SHA to include in reports |

Set these in your CI/CD provider, `.env` file, or `playwright.config.ts` via `process.env`.

## How it works

1. When a test fails or times out, the fixture captures `page.content()` and stores it as a Playwright attachment.
2. `HealifyReporter.onTestEnd` reads the attachment, extracts the failing selector from the error message, and POSTs the report to Healify.
3. Healify's AI analyzes the selector and returns a suggested fix.

The reporter is fire-and-forget — it never blocks the test run or throws. When `HEALIFY_API_KEY` is not set, both the fixture and reporter are no-ops (zero overhead when disabled).

# @healify/reporter-core

Internal shared library for Healify's test reporter packages. Not published standalone.

## API

### `resolveConfig(): HealifyConfig | null`

Reads configuration from environment variables. Returns `null` when `HEALIFY_API_KEY` is not set (callers treat this as "reporter disabled").

| Env var | Required | Default |
|---|---|---|
| `HEALIFY_API_KEY` | Yes | — |
| `HEALIFY_API_URL` | No | `https://healify-sigma.vercel.app` |
| `HEALIFY_BRANCH` | No | — |
| `HEALIFY_COMMIT_SHA` | No | — |

### `extractSelectorFromError(errorMessage: string): string`

Parses a Playwright/Cypress error message and extracts the failing selector. Returns `'Unknown selector'` if no pattern matches. Handles ANSI escape codes.

### `reportFailure(config: HealifyConfig, payload: ReportPayload): Promise<void>`

POSTs a broken-selector report to the Healify API. Never throws — failures are logged once via `console.warn` and swallowed.

### Interfaces

```ts
interface HealifyConfig {
  apiKey: string
  apiUrl: string
  branch?: string
  commitSha?: string
}

interface ReportPayload {
  testName: string
  testFile?: string
  selector: string
  error: string
  context?: string
  selectorType?: 'CSS' | 'XPATH' | 'TESTID' | 'ROLE' | 'TEXT' | 'UNKNOWN'
  branch?: string
  commitSha?: string
}
```

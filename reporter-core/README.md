# @healify/reporter-core

Internal shared library for Healify's test reporter packages. Not published standalone.

## API

### `extractSelectorFromError(errorMessage: string): string`

Parses a Playwright/Cypress error message and extracts the failing selector. Returns `'Unknown selector'` if no pattern matches. Handles ANSI escape codes.

### `analyzeAndHeal(request: HealRequest): HealResponse`

Runs the local heuristic (pattern-matching, no network, no AI) against a broken selector and proposes an alternative.

### `runLocalHealing(input: LocalCaseInput): LocalCaseResult`

Extracts the selector from an error message and runs `analyzeAndHeal` on it, returning a result with a `'healed' | 'review' | 'unresolved'` status based on confidence.

### `renderLocalReportHtml(run: LocalRun): string` / `renderLocalReportJson(run: LocalRun): string`

Renders the accumulated `LocalCaseResult[]` from a test run into `healify-report.html` / `.json`.

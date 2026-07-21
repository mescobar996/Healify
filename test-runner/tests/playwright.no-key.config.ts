import { defineConfig } from '@playwright/test'

// Separate config/testDir from playwright.config.ts on purpose: this suite must run
// WITHOUT HEALIFY_API_KEY set, which would otherwise change the assertions the main
// suite's verify-fixture-capture.mjs relies on if mixed into the same run.
export default defineConfig({
  testDir: './fixtures-no-key',
  reporter: [
    ['json', { outputFile: 'test-results/report-no-key.json' }],
    ['../src/reporter.ts'],
  ],
  use: { headless: true },
})

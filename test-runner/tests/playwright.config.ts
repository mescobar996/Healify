import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './fixtures',
  reporter: [
    ['json', { outputFile: 'test-results/report.json' }],
    ['../src/reporter.ts'],
  ],
  use: { headless: true },
})

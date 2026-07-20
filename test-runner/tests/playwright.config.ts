import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './fixtures',
  reporter: [['json', { outputFile: 'test-results/report.json' }]],
  use: { headless: true },
})

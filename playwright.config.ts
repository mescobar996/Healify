import { defineConfig, devices } from '@playwright/test'

/**
 * HEALIFY — Playwright E2E Configuration
 *
 * Tests cubren el flujo completo:
 *   Auth → Dashboard → Proyectos → Webhook → Worker → Healing
 *
 * Para correr localmente:
 *   npx playwright test
 *
 * Para correr en CI (sin browser UI):
 *   npx playwright test --reporter=github
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Correr tests en paralelo por archivo, secuencial dentro de cada archivo
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,

  // Reintentos en CI
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Headers comunes
    extraHTTPHeaders: {
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  },

  projects: [
    // ── Setup: seed DB con usuario de test ──────────────────────────
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    // ── Desktop Chrome — suite principal ────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /global\.setup\.ts/,
    },

    // ── Mobile Chrome — responsive check ────────────────────────────
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /global\.setup\.ts/,
      testMatch: /mobile\.spec\.ts/,
    },

    // ── API tests — sin browser ──────────────────────────────────────
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
    },
  ],

  // Levantar Next.js dev server si no está corriendo
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})

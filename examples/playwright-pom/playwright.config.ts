import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Un solo worker y sin retries: el ejemplo tiene que fallar de forma predecible y ruidosa,
  // que es justo lo que queremos mostrar.
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    // 👇 Lo único que hay que agregar en un proyecto real.
    ['@healify/test-runner/reporter', {}],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4321',
  },
  // Servidor estático de 10 líneas (`serve.mjs`), sin dependencias: la app del ejemplo es
  // HTML plano. En tu proyecto acá va tu `npm run dev` de siempre.
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
  },
})

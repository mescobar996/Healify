import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Solo el test de esta carpeta. Antes decía `**/*.test.ts`, que desde la raíz del repo
    // barría los 61 archivos de todos los workspaces: levantaba el test de la extensión de
    // VS Code (que necesita un editor corriendo) y perdía el `TZ: UTC` que el snapshot de
    // reporter-core necesita. Resultado: dos fallos que no eran bugs, en una config que
    // nadie corría.
    include: ['test-full-flow.test.ts'],
    testTimeout: 30000,
  },
})

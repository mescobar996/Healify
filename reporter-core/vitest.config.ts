import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // El snapshot del reporte QA incluye una fecha renderizada con toLocaleString(), que sale
    // en la zona horaria de la máquina. Estaba grabado en UTC-3 (Rosario) y el runner de CI
    // corre en UTC: mismo código, "07:30" acá y "10:30" allá — el job de tests venía fallando
    // por eso, no por un cambio real de formato. Con TZ fija el entregable se compara siempre
    // contra la misma hora, en cualquier máquina.
    env: { TZ: 'UTC' },
  },
})

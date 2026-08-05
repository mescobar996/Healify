import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Solo `src/core/`: es la parte que no importa 'vscode' y por lo tanto corre fuera de un
    // editor. Lo que sí toca esa API se verifica con @vscode/test-electron, que levanta un
    // VS Code de verdad — mockear la API del editor probaría el mock, no la extensión.
    include: ['src/core/__tests__/**/*.test.ts'],
  },
})

<div align="center">
  <h1>Healify</h1>

  <p><strong>Cuando un selector se rompe, Healify te dice cómo arreglarlo — sin salir de tu máquina.</strong></p>

  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" />
  <img src="https://img.shields.io/badge/Cypress-15-green?logo=cypress" />
  <img src="https://img.shields.io/npm/v/%40healify%2Ftest-runner?label=%40healify%2Ftest-runner" />
  <img src="https://img.shields.io/npm/v/%40healify%2Fcypress-plugin?label=%40healify%2Fcypress-plugin" />
</div>

---

## 🩺 Qué hace

Un test de Playwright o Cypress falla porque un selector ya no existe en el DOM. Healify
detecta la falla, corre una heurística local (sin red, sin cuenta, sin servidor) y te
propone un selector alternativo más estable. Al terminar la corrida, genera
`healify-report.html` con cada caso: selector original, sugerencia y nivel de confianza.

**No hace falta cuenta, API key, ni conexión a internet.** Instalás el paquete, corrés tus
tests, y listo.

## 🚀 Uso

```bash
npm install --save-dev @healify/test-runner      # Playwright
# o
npm install --save-dev @healify/cypress-plugin   # Cypress
```

**Playwright** (`playwright.config.ts`):
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [['list'], ['@healify/test-runner/reporter']],
})
```

**Cypress** (`cypress.config.ts`):
```ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: { setupNodeEvents: (on, config) => HealifyCypressPlugin(on, config) },
})
```

Corré tus tests normalmente (`npx playwright test` / `npx cypress run`). Al terminar la
corrida, si algún test falló por un selector roto, aparece `healify-report.html` en el
directorio desde el que corriste los tests. Nada sale de tu máquina.

## 🗂 Estructura del repo

```
reporter-core/     # Motor heurístico + config compartida (privado, no se publica solo)
test-runner/       # @healify/test-runner — reporter de Playwright
cypress-plugin/    # @healify/cypress-plugin — plugin de Cypress
docs/              # Historial de planificación (plan + spec + log de ejecución)
```

## 🧪 Correr los tests

```bash
npm test              # Corre los tests de los 3 paquetes (workspaces)
npm run build          # Compila los 3 paquetes
```

## ⚙️ Local setup

```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
npm run build
```

No hace falta base de datos, cuenta, ni servidor para nada de esto.

## 📜 Historia

Este repo tuvo antes un SaaS completo: dashboard, auth, billing, worker con cola, PR
automático a GitHub, 65+ rutas de API, y hasta un endpoint propio para un modo nube
opcional. Se recortó todo eso porque el caso de uso real — "un tester quiere esto en su
PC" — no lo necesitaba: hoy `main` es exactamente los 3 paquetes de arriba, sin nada más.
Ese código anterior sigue existiendo, intacto, en la rama
[`archive/saas-full`](../../tree/archive/saas-full), por si algún día se retoma la versión
equipo (dashboard, PR automático, etc.).

## 🤝 Contributing

PRs son bienvenidos. Para cambios grandes, abrí un issue primero.

## 📄 License

MIT © 2026 Healify

<div align="center">
  <img src="public/icon.png" alt="Healify Logo" width="72" />

  <h1>Healify</h1>

  <p><strong>Cuando un selector se rompe, Healify te dice cómo arreglarlo — sin salir de tu máquina.</strong></p>

  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" />
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

Corré tus tests normalmente (`npx playwright test` / `npx cypress run`). Sin
`HEALIFY_API_KEY` seteada, el reporter corre en **modo local**: nada sale de tu máquina, y
al final de la corrida aparece `healify-report.html` en el directorio desde el que corriste
los tests.

## 🌐 Modo nube (opcional)

Si además de generar el reporte local querés mandar los fixes a un servidor propio, seteá:

```env
HEALIFY_API_KEY=tu-clave
HEALIFY_API_URL=https://tu-instancia.example.com
```

Este mismo repo incluye ese servidor: un único endpoint (`/api/v1/report`), sin base de
datos, que corre la misma heurística y valida la key contra la variable de entorno
`HEALIFY_API_KEY` del lado del servidor. Se levanta con `npm run dev` / `npm run build`.

## 🗂 Estructura del repo

```
reporter-core/     # Motor heurístico + config compartida (privado, no se publica solo)
test-runner/       # @healify/test-runner — reporter de Playwright
cypress-plugin/    # @healify/cypress-plugin — plugin de Cypress
src/               # Next.js — landing + /api/v1/report (modo nube opcional)
e2e/               # Tests E2E del propio endpoint (Playwright)
```

## 🧪 Correr los tests

```bash
npm test              # Unit tests de la app (Vitest)
npm run test:e2e      # E2E contra la app Next.js

cd reporter-core && npm test    # 33 tests del motor + config
cd test-runner && npx vitest run
```

## ⚙️ Local setup

```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
npm run dev            # → http://localhost:3000 (landing + endpoint opcional)
```

No hace falta base de datos ni cuenta para nada de esto — el modo local de los paquetes
tampoco la necesita.

## 📜 Historia

Este repo tuvo antes un SaaS completo: dashboard, auth, billing, worker con cola, PR
automático a GitHub, 65+ rutas de API. Se recortó a lo de arriba porque el caso de uso real
— "un tester quiere esto en su PC" — no lo necesitaba. Ese código sigue existiendo, intacto,
en la rama [`archive/saas-full`](../../tree/archive/saas-full), por si algún día se retoma
la versión equipo.

## 🤝 Contributing

PRs son bienvenidos. Para cambios grandes, abrí un issue primero.

## 📄 License

MIT © 2026 Healify

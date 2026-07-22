<div align="center">
  <h1>Healify</h1>

  <p><strong>Cuando un selector se rompe, Healify te dice cómo arreglarlo — sin salir de tu máquina.</strong></p>

  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" />
  <img src="https://img.shields.io/badge/Cypress-15-green?logo=cypress" />
  <img src="https://img.shields.io/badge/Selenium-4-green?logo=selenium" />
</div>

---

## 🩺 Qué hace

Un test de Playwright, Cypress o Selenium falla porque un selector ya no existe en el
DOM. Healify detecta la falla, corre una heurística local (sin red, sin cuenta, sin
servidor — pattern-matching sobre el texto del selector, **no es IA**) y te propone un
selector alternativo más estable.

**No hace falta cuenta, API key, ni conexión a internet.** Instalás el paquete, corrés tus
tests, y listo.

## 📦 Paquetes

| Paquete | Para | npm |
|---|---|---|
| [`@healify/test-runner`](test-runner/README.md) | Playwright — genera `healify-report.html`/`.json` al final de la corrida | [![npm](https://img.shields.io/npm/v/%40healify%2Ftest-runner)](https://www.npmjs.com/package/@healify/test-runner) |
| [`@healify/cypress-plugin`](cypress-plugin/README.md) | Cypress — mismo reporte, vía `setupNodeEvents` | [![npm](https://img.shields.io/npm/v/%40healify%2Fcypress-plugin)](https://www.npmjs.com/package/@healify/cypress-plugin) |
| [`@healify/selenium-plugin`](selenium-plugin/README.md) | Selenium `WebDriver` — cura selectores en vivo, sin reporte (ver su README para el alcance) | [![npm](https://img.shields.io/npm/v/%40healify%2Fselenium-plugin)](https://www.npmjs.com/package/@healify/selenium-plugin) |
| [`@healify/cli`](cli/README.md) | Aplica las sugerencias de un `healify-report.json` directo en tus archivos de test | [![npm](https://img.shields.io/npm/v/%40healify%2Fcli)](https://www.npmjs.com/package/@healify/cli) |
| `reporter-core` | Motor heurístico + tipos compartidos. Privado, no se publica solo | — |

Los 4 paquetes están publicados en npm y ya se pueden instalar hoy — no hace falta
clonar el repo ni compilar nada para usarlos. Elegí el que corresponda a tu framework:

### Playwright — `@healify/test-runner`

```bash
npm install --save-dev @healify/test-runner
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [['list'], ['@healify/test-runner/reporter']],
})
```

Corré tus tests normalmente (`npx playwright test`). Al terminar la corrida, si algún
test falló por un selector roto, aparece `healify-report.html` en el directorio desde el
que corriste Playwright.

### Cypress — `@healify/cypress-plugin`

```bash
npm install --save-dev @healify/cypress-plugin
```

`cypress.config.ts`:
```ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: { setupNodeEvents: (on, config) => HealifyCypressPlugin(on, config) },
})
```

Corré tus tests normalmente (`npx cypress run`). Mismo resultado: `healify-report.html`
al terminar la corrida si hubo algún selector roto.

### Selenium — `@healify/selenium-plugin`

```bash
npm install --save-dev @healify/selenium-plugin selenium-webdriver
```

```ts
import { Builder, By } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'

const raw = await new Builder().forBrowser('chrome').build()
const driver = new HealifySeleniumPlugin({ onEvent: console.log }).wrap(raw)

// Si '#add-to-cart-btn' se rompió, el plugin intenta un selector alternativo
// antes de dejar que el error se propague.
await driver.findElement(By.css('#add-to-cart-btn')).click()
```

A diferencia de los otros dos, cura en vivo y no genera reporte (Selenium no tiene un
hook de "fin de corrida" nativo). Ver [su README](selenium-plugin/README.md) para el
alcance completo y las limitaciones.

### Aplicar las sugerencias automáticamente — `@healify/cli`

Con un `healify-report.json` ya generado (por `test-runner` o `cypress-plugin`):

```bash
npm install --save-dev @healify/cli
npx healify fix              # aplica los casos de mayor confianza en tus archivos
npx healify fix --dry-run     # muestra qué haría, sin escribir nada
```

Ver [su README](cli/README.md) para el detalle de qué toca y qué no.

En todos los casos: nada sale de tu máquina, no hace falta cuenta ni conexión a
internet. Para un recorrido completo de punta a punta (cómo funciona el motor por
dentro, troubleshooting), ver [`docs/guide/`](docs/guide/).

## 🗂 Estructura del repo

```
reporter-core/     # Motor heurístico + tipos compartidos (privado, no se publica solo)
test-runner/       # @healify/test-runner — reporter de Playwright
cypress-plugin/    # @healify/cypress-plugin — plugin de Cypress
selenium-plugin/   # @healify/selenium-plugin — wrapper de Selenium WebDriver (curado en vivo)
cli/               # @healify/cli — aplica sugerencias de un reporte directo en los archivos
docs/
  guide/           # Manual de usuario (instalación, uso, troubleshooting)
  superpowers/     # Historial de planificación real (specs, plans, no basura)
```

## 🧪 Correr los tests

```bash
npm test          # Corre los tests de los 5 paquetes (workspaces)
npm run build      # Compila los 5 paquetes
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
PC" — no lo necesitaba: hoy `main` es exactamente los paquetes de arriba, sin nada más.
Ese código anterior sigue existiendo, intacto, en la rama
[`archive/saas-full`](../../tree/archive/saas-full), por si algún día se retoma la versión
equipo (dashboard, PR automático, etc.).

## 📄 License

MIT © 2026 Healify

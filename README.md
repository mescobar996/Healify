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
| [`@healify/selenium-plugin`](selenium-plugin/README.md) | Selenium `WebDriver` — cura selectores **en vivo**, sin reporte (ver su README para el alcance) | no publicado todavía |
| [`@healify/cli`](cli/README.md) | Aplica las sugerencias de un `healify-report.json` directo en tus archivos de test | no publicado todavía |
| `reporter-core` | Motor heurístico + tipos compartidos. Privado, no se publica solo | — |

> ⚠️ **Los paquetes publicados en npm (`test-runner`/`cypress-plugin`) están en `0.1.0`,
> desactualizados respecto a este repo (`0.2.0`)** — no tienen las mejoras del motor
> (diccionarios ES/EN, reconocimiento de `getBy*`, atributos genéricos). `cli` y
> `selenium-plugin` todavía no se publicaron. Para usar la versión actual, instalá desde
> este repo (ver "Local setup" abajo) hasta la próxima publicación.

## 🚀 Uso rápido

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

Para Selenium (`WebDriver`) y para aplicar las sugerencias automáticamente en tus
archivos, ver [`@healify/selenium-plugin`](selenium-plugin/README.md) y
[`@healify/cli`](cli/README.md) — cada uno con su propio README detallado. Para un
recorrido completo de punta a punta (instalación, cómo funciona el motor, troubleshooting),
ver [`docs/guide/`](docs/guide/).

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

## 🤝 Contributing

PRs son bienvenidos. Para cambios grandes, abrí un issue primero.

## 📄 License

MIT © 2026 Healify

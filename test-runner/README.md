# @healify/test-runner

Reporter local para Playwright. Cuando un test falla por un selector roto, corre una
heurística en el mismo proceso (sin red) y al final de la corrida genera
`healify-report.html`/`healify-report.json` con la sugerencia de fix.

## Setup

```bash
npm install --save-dev @healify/test-runner
```

Requiere `@playwright/test >= 1.40.0` como peer dependency.

## Uso — modo local (default, sin configuración)

### 1. Registrar el reporter

En `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [
    ['list'],
    ['@healify/test-runner/reporter'],
  ],
})
```

### 2. Correr tus tests normalmente

```bash
npx playwright test
```

Sin nada más que configurar: si algún test falla por un selector roto, al terminar la
corrida aparece `healify-report.html` en el directorio desde el que corriste Playwright,
con cada caso (selector original, sugerencia, nivel de confianza). Nada sale de tu máquina.

## Uso — fixture extendido (opcional)

Reemplazá `import { test, expect } from '@playwright/test'` por:

```ts
import { test, expect } from '@healify/test-runner'
```

El fixture extendido captura el HTML de la página en cada fallo y lo adjunta como
`healify-dom` para más contexto (solo se usa en modo nube, ver abajo).

## Modo nube (opcional)

Si además querés mandar los reportes a un servidor propio en vez de solo generar el HTML
local, seteá estas variables de entorno:

| Env var | Requerida | Descripción |
|---|---|---|
| `HEALIFY_API_KEY` | Sí | Activa el modo nube. Sin esto, el reporter siempre corre en modo local |
| `HEALIFY_API_URL` | No | URL base de tu servidor (default: `https://healify-sigma.vercel.app`) |
| `HEALIFY_BRANCH` | No | Rama de git a incluir en los reportes |
| `HEALIFY_COMMIT_SHA` | No | Commit SHA a incluir en los reportes |

En modo nube, el reporter nunca bloquea ni hace fallar la corrida — si el POST falla, se
loguea un warning una sola vez y sigue.

## Cómo funciona

- **Modo local** (sin `HEALIFY_API_KEY`): `HealifyReporter.onTestEnd` corre la heurística en
  el mismo proceso para cada test fallido; `onEnd` escribe el HTML/JSON.
- **Modo nube** (con `HEALIFY_API_KEY`): el fixture captura `page.content()` en cada fallo y
  lo adjunta; `HealifyReporter.onTestEnd` lee el attachment y postea el reporte a tu servidor.

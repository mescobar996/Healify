# @healify/cypress-plugin

Reporter local para Cypress. Cuando un test falla por un selector roto, corre una
heurística en el mismo proceso (sin red) y al final de la corrida genera
`healify-report.html`/`healify-report.json` con la sugerencia de fix.

## Setup

```bash
npm install --save-dev @healify/cypress-plugin
```

Requiere `cypress >= 13.0.0` como peer dependency.

## Uso — modo local (default, sin configuración)

En `cypress.config.ts`:

```ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return HealifyCypressPlugin(on, config)
    },
  },
})
```

Corré tus tests normalmente (`npx cypress run`). Sin nada más que configurar: si algún test
falla por un selector roto, al terminar la corrida aparece `healify-report.html` en el
directorio desde el que corriste Cypress. Nada sale de tu máquina.

## Modo nube (opcional)

Si además querés mandar los reportes a un servidor propio en vez de solo generar el HTML
local, seteá estas variables de entorno (en tu CI/CD o `cypress.env.json`):

| Env var | Requerida | Descripción |
|---|---|---|
| `HEALIFY_API_KEY` | Sí | Activa el modo nube. Sin esto, el plugin siempre corre en modo local |
| `HEALIFY_API_URL` | No | URL base de tu servidor (default: `https://healify-sigma.vercel.app`) |
| `HEALIFY_BRANCH` | No | Rama de git a incluir en los reportes |
| `HEALIFY_COMMIT_SHA` | No | Commit SHA a incluir en los reportes |

## Cómo funciona

- **Modo local** (sin `HEALIFY_API_KEY`): tras cada spec (`after:spec`) se corre la
  heurística para cada test fallido; al terminar la corrida (`after:run`) se escribe el
  HTML/JSON.
- **Modo nube** (con `HEALIFY_API_KEY`): tras cada spec se extrae el selector del error y se
  postea el reporte a tu servidor. Fire-and-forget — nunca bloquea ni hace fallar la corrida.

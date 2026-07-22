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

Además, al final de la corrida se imprime un resumen de una línea en stdout — útil en CI,
sin tener que abrir el HTML:

```
Healed: 3 | Review: 1 | Unresolved: 0
```

## Cómo funciona

Tras cada spec (`after:spec`) se corre la heurística (`analyzeAndHeal()` de
`@healify/reporter-core`) para cada test fallido, sin red; al terminar la corrida
(`after:run`) se escribe `healify-report.html`/`.json` con todos los casos acumulados.
Heurística de pattern-matching sobre el texto del selector y del error — no es IA, no
analiza el DOM en tiempo real.

## Siguiente paso

Cuando tengas `healify-report.json`, `npx @healify/cli fix` aplica automáticamente las
sugerencias de mayor confianza directo en tus archivos de test (conservador: nunca toca
selectores ambiguos ni archivos con cambios sin commitear). Ver
[`@healify/cli`](../cli/README.md).

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

Además, al final de la corrida se imprime un resumen de una línea en stdout — útil en CI,
sin tener que abrir el HTML:

```
Healed: 3 | Review: 1 | Unresolved: 0
```

## Cómo funciona

`HealifyReporter.onTestEnd` corre la heurística (`analyzeAndHeal()` de
`@healify/reporter-core`) en el mismo proceso para cada test fallido, sin red. `onEnd`
escribe `healify-report.html`/`.json` con todos los casos acumulados. Heurística de
pattern-matching sobre el texto del selector y del error — no es IA, no analiza el DOM
en tiempo real.

## Siguiente paso

Cuando tengas `healify-report.json`, `npx @healify/cli fix` aplica automáticamente las
sugerencias de mayor confianza directo en tus archivos de test (conservador: nunca toca
selectores ambiguos ni archivos con cambios sin commitear). Ver
[`@healify/cli`](../cli/README.md).

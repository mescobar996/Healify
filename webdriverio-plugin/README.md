# @healify/webdriverio-plugin

Wrapper de auto-sanado para WebdriverIO. Cuando una interacción con un elemento (`click`,
`setValue`, etc.) falla porque el selector ya no existe en la página, este plugin intenta
curarlo en vivo con una heurística de pattern-matching (**no es IA, no analiza el DOM en
tiempo real, no hay red ni servidor**). Es el mismo motor que usan `@healify/test-runner`
(Playwright), `@healify/cypress-plugin` (Cypress) y `@healify/selenium-plugin` (Selenium):
[`analyzeAndHeal()`](https://github.com/mescobar996/Healify/blob/main/reporter-core/src/healing-engine.ts).

## Instalación

```bash
npm install --save-dev @healify/webdriverio-plugin
```

## Uso

```typescript
import { remote } from 'webdriverio'
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'

const raw = await remote({ capabilities: { browserName: 'chrome' } })
const healify = new HealifyWebdriverIOPlugin({ onEvent: console.log })
const browser = healify.wrap(raw)

// Si '#add-to-cart-btn' se rompió, el plugin intenta un selector alternativo
// antes de dejar que el error se propague.
await browser.$('#add-to-cart-btn').click()
```

WebdriverIO es lazy: `$()` no falla hasta que interactuás con el elemento devuelto. El
proxy envuelve los métodos de interacción (`click`, `setValue`, `addValue`, `getText`,
`getAttribute`, `waitForExist`, `waitForDisplayed`, `waitForClickable`, `isExisting`,
`isDisplayed`, `getHTML`, `getLocation`, `getSize`) para capturar el error en el momento
correcto, no en `$()` mismo.

## Opciones

```typescript
new HealifyWebdriverIOPlugin({
  confidenceThreshold: 0.9,       // default: mismo piso que reporter-core (HEALED_THRESHOLD, auto-aplicado sin revisión)
  dryRun: false,                  // default: true = cura pero nunca aplica el fix, solo emite el evento
  onEvent: (e) => {},             // opcional: se llama en cada intento de curado
  projectName: 'mi-proyecto',     // opcional: nombre que va a healify-report.json al llamar flush()
})
```

## Generar un reporte con `flush()`

Igual que Selenium, WebdriverIO no tiene un hook nativo de "fin de corrida" en este
plugin, así que no genera `healify-report.html`/`.json` solo. Llamando `flush()` al final
de tu suite (ej. en un `after`/`afterAll` global) se escribe `healify-report.json` con
todos los eventos acumulados desde la última llamada, mismo formato que
Playwright/Cypress/Selenium:

```typescript
const healify = new HealifyWebdriverIOPlugin({ projectName: 'mi-proyecto' })
const browser = healify.wrap(raw)

// ... corré tu suite normalmente ...

const cantidad = healify.flush()   // escribe healify-report.json, devuelve cuántos casos escribió
```

`healify-report.html` no se genera acá (no hay renderer HTML en este paquete), pero podés
correr `npx @healify/cli fix` sobre el `healify-report.json` resultante igual que con
Playwright/Cypress.

## Qué selectores soporta

WebdriverIO usa strings directos, no una clase de locators como `By` en Selenium:
selectores CSS (`.clase`, `#id`, `[attr=x]`, tag), XPath (`//div`, `(//div)[1]`).

Estrategias de string de WebdriverIO (`linkText=`, `partialText=`, `xpath=` explícito con
prefijo, etc.) **no están soportadas**: no tienen equivalente limpio en el motor de
heurística. Si se usan, el plugin no intenta curar y deja pasar el error original tal cual.

## Fuera de alcance (a propósito, en esta versión)

- **Modo cloud**: no existe. Healify es 100% local, sin `apiKey`, sin servidor.
- **Reporte HTML**: `flush()` (arriba) escribe `healify-report.json`, pero este paquete no
  tiene un renderer de `healify-report.html` propio como `test-runner`/`cypress-plugin`.
- **Memoria entre tests** ("si otro test ya usa un selector estable, sugerirlo acá
  también"): el motor de heurística no tiene esta capacidad hoy, en ningún paquete de
  Healify. No se agregó solo para WebdriverIO.
- **Sugerencias tipo `role(...)`/`:has-text(...)`/`visible=...`/`getBy*(...)`**:
  `analyzeAndHeal()` devuelve esa sintaxis para varias de sus estrategias (pensada
  originalmente para Playwright/Cypress). No es CSS/XPath nativo, así que `$()` de
  WebdriverIO no puede ejecutarla: estos casos se reportan como `'no-suggestion'` en vez
  de intentar un retry que fallaría siempre. En la práctica, esto significa que
  selectores de botones/links/inputs (donde el motor suele proponer una estrategia por
  rol o texto) tienen menor tasa de curado real en WebdriverIO que en Playwright/Cypress;
  el motor compartido no distingue el runtime de destino al generar sugerencias.

## Licencia

MIT

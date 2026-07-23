# @healify/selenium-plugin

Wrapper de auto-sanado para Selenium `WebDriver`. Cuando `findElement` falla porque un
selector ya no existe en la página, este plugin intenta curarlo en vivo con una
heurística de pattern-matching (**no es IA, no analiza el DOM en tiempo real, no hay
red ni servidor**). Es el mismo motor que usan `@healify/test-runner` (Playwright) y
`@healify/cypress-plugin` (Cypress): [`analyzeAndHeal()`](https://github.com/mescobar996/Healify/blob/main/reporter-core/src/healing-engine.ts).

## Instalación

```bash
npm install --save-dev @healify/selenium-plugin selenium-webdriver
```

## Uso

```typescript
import { Builder, By } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'

const raw = await new Builder().forBrowser('chrome').build()
const driver = new HealifySeleniumPlugin({ onEvent: console.log }).wrap(raw)

// Si '#add-to-cart-btn' se rompió, el plugin intenta un selector alternativo
// antes de dejar que el error se propague.
await driver.findElement(By.css('#add-to-cart-btn')).click()
```

## Opciones

```typescript
new HealifySeleniumPlugin({
  confidenceThreshold: 0.9,       // default: mismo piso que reporter-core (HEALED_THRESHOLD, auto-aplicado sin revisión)
  dryRun: false,                  // default: true = cura pero nunca aplica el fix, solo emite el evento
  onEvent: (e) => {},             // opcional: se llama en cada intento de curado
  projectName: 'mi-proyecto',     // opcional: nombre que va a healify-report.json al llamar flush()
})
```

## Generar un reporte con `flush()`

A diferencia de Playwright/Cypress, Selenium no tiene un hook nativo de "fin de corrida",
así que este plugin no genera `healify-report.html`/`.json` solo. Llamando `flush()` al
final de tu suite (ej. en un `after`/`afterAll` global) se escribe `healify-report.json`
con todos los eventos acumulados desde la última llamada, mismo formato que
Playwright/Cypress:

```typescript
const healify = new HealifySeleniumPlugin({ projectName: 'mi-proyecto' })
const driver = healify.wrap(raw)

// ... corré tu suite normalmente ...

const cantidad = healify.flush()   // escribe healify-report.json, devuelve cuántos casos escribió
```

`healify-report.html` no se genera acá (no hay renderer HTML en este paquete), pero podés
correr `npx @healify/cli fix` sobre el `healify-report.json` resultante igual que con
Playwright/Cypress.

## Qué locators soporta

`By.css`, `By.xpath`, `By.id`, `By.className`, `By.name` (Selenium mismo convierte
`By.id`/`By.className`/`By.name` a un selector CSS internamente antes de que este
plugin los vea, así que no hace falta heurística extra para esos tres).

`By.linkText`, `By.partialLinkText`, `By.tagName` **no están soportados**: no tienen
equivalente limpio en el motor de heurística. Si se usan, el plugin no intenta curar y
deja pasar el error de Selenium tal cual.

## Fuera de alcance (a propósito, en esta versión)

- **Modo cloud**: no existe. Healify es 100% local, sin `apiKey`, sin servidor.
- **Reporte HTML**: `flush()` (arriba) escribe `healify-report.json`, pero este paquete no
  tiene un renderer de `healify-report.html` propio como `test-runner`/`cypress-plugin`.
- **Memoria entre tests** ("si otro test ya usa un selector estable, sugerirlo acá
  también"): el motor de heurística no tiene esta capacidad hoy, en ningún paquete de
  Healify. No se agregó solo para Selenium.
- **`findElements` (plural)**: pasa directo al driver real, sin intentar curar. Selenium
  devuelve `[]` cuando no hay matches, en vez de lanzar un error, así que no hay nada
  concreto que curar ahí.
- **Sugerencias tipo `role(...)`/`:has-text(...)`/`visible=...`**: `analyzeAndHeal()`
  devuelve esa sintaxis para varias de sus estrategias (pensada originalmente para
  Playwright/Cypress). No es CSS nativo, así que `By.css()` de Selenium no puede
  ejecutarla: estos casos se reportan como `'no-suggestion'` en vez de intentar un
  retry que fallaría siempre. En la práctica, esto significa que selectores de
  botones/links/inputs (donde el motor suele proponer una estrategia por rol o texto)
  tienen menor tasa de curado real en Selenium que en Playwright/Cypress; el motor
  compartido no distingue el runtime de destino al generar sugerencias.

## Licencia

MIT

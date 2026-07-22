# @healify/selenium-plugin

Wrapper de auto-sanado para Selenium `WebDriver`. Cuando `findElement` falla porque un
selector ya no existe en la página, este plugin intenta curarlo en vivo con una
heurística de pattern-matching — **no es IA, no analiza el DOM en tiempo real, no hay
red ni servidor**. Es el mismo motor que usan `@healify/test-runner` (Playwright) y
`@healify/cypress-plugin` (Cypress): [`analyzeAndHeal()`](https://github.com/mescobar996/Healify/blob/main/reporter-core/src/healing-engine.ts).

## Instalación

```bash
npm install --save-dev @healify/selenium-plugin selenium-webdriver
```

## Uso

```typescript
import { Builder } from 'selenium-webdriver'
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
  confidenceThreshold: 0.9, // default — mismo piso que reporter-core (HEALED_THRESHOLD, auto-aplicado sin revisión)
  dryRun: false,             // default — true: cura pero nunca aplica el fix, solo emite el evento
  onEvent: (e) => {},        // opcional — se llama en cada intento de curado
})
```

## Qué locators soporta

`By.css`, `By.xpath`, `By.id`, `By.className`, `By.name` — Selenium mismo convierte
`By.id`/`By.className`/`By.name` a un selector CSS internamente antes de que este
plugin los vea, así que no hace falta heurística extra para esos tres.

`By.linkText`, `By.partialLinkText`, `By.tagName` **no están soportados** — no tienen
equivalente limpio en el motor de heurística. Si se usan, el plugin no intenta curar y
deja pasar el error de Selenium tal cual.

## Fuera de alcance (a propósito, en esta versión)

- **Modo cloud**: no existe. Healify es 100% local — sin `apiKey`, sin servidor.
- **Reporte HTML/JSON**: `test-runner`/`cypress-plugin` generan
  `healify-report.html`/`.json` porque Playwright/Cypress tienen un hook de "fin de
  corrida". Selenium no lo tiene — este plugin solo cura en vivo. Se evalúa agregar un
  método `flush()` en una versión futura.
- **Memoria entre tests** ("si otro test ya usa un selector estable, sugerirlo acá
  también"): el motor de heurística no tiene esta capacidad hoy, en ningún paquete de
  Healify. No se agregó solo para Selenium.
- **`findElements` (plural)**: pasa directo al driver real, sin intentar curar — Selenium
  devuelve `[]` cuando no hay matches, en vez de lanzar un error, así que no hay nada
  concreto que curar ahí.

## Licencia

MIT

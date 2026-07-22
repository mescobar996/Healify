# `@healify/selenium-plugin` — self-healing wrapper para Selenium WebDriver, design spec

**Fecha:** 2026-07-22
**Estado:** Aprobado, pendiente de implementación

## 0. Contexto

Healify hoy cubre Playwright (`@healify/test-runner`) y Cypress (`@healify/cypress-plugin`):
ambos se enganchan a un hook de "fin de test"/"fin de corrida" del framework, corren la
heurística local (`analyzeAndHeal()` en `reporter-core/src/healing-engine.ts` —
pattern-matching de texto, no IA, no analiza DOM en vivo) sobre los selectores que
fallaron, y escriben `healify-report.html`/`.json`.

Este spec nace de un borrador externo ("Fase 5", de otro agente/sesión, adjunto por el
usuario como *idea*, no como spec aprobada) que proponía expandir Healify a Selenium.
Ese borrador se escribió sin acceso al repo real y tenía tres problemas de fondo,
corregidos acá:

1. Proponía un modo `cloud` (`apiKey`, `endpoint`) — Healify eliminó el modo nube a
   propósito en el achique de sesiones anteriores (todo el SaaS quedó en
   `archive/saas-full`). Este plugin nace sin esa opción.
2. Proponía 4 reglas de heurística nuevas y propias del plugin (`data-testid-match`,
   `aria-label-match`, `name-attr-match`, `history-sibling`), reimplementando 3 de ellas
   desde cero cuando ya existen en `analyzeAndHeal()`. Este spec reusa el motor
   compartido en vez de duplicarlo.
3. Asumía una forma de `LocalCaseResult` desactualizada y no conocía el workspace `cli/`
   (agregado en la sesión anterior). Corregido contra el código real.

Selenium no tiene un hook de "fin de corrida" nativo como Playwright/Cypress — es solo un
wrapper del `WebDriver`. Por eso esta fase se limita a **curado en vivo**, sin reporte.

## 1. Alcance

Nuevo workspace `selenium-plugin/` en el monorepo. Se publica como paquete npm
independiente `@healify/selenium-plugin`, peer dependency de `selenium-webdriver`.

**Dentro de alcance:**
- Un proxy (`wrap()`) sobre el `WebDriver` que intercepta `findElement`/`findElements`.
- Cuando `findElement` falla con "no such element", intenta curar el locator con
  `analyzeAndHeal()` de `@healify/reporter-core` y reintenta una vez con la sugerencia.
- Conversión de los locators `By.css`, `By.xpath`, `By.id`, `By.className`, `By.name` a
  un string que `analyzeAndHeal()` entiende.
- Modo local únicamente, sin red, sin estado persistente entre corridas.

**Fuera de alcance (explícitamente, no en esta iteración):**
- Modo `cloud`/`apiKey`/`endpoint` — no existe como concepto en Healify hoy, no se
  reintroduce acá.
- Reporte `healify-report.html`/`.json` — no hay hook de "fin de corrida" en Selenium;
  se evalúa en una fase 5.5 posterior si hace falta (vía un método explícito
  `plugin.flush()`, a diseñar aparte).
- `history-sibling` (memoria de selectores entre tests) — el motor no tiene memoria
  entre tests hoy (documentado así en `healing-engine.ts` y en el modal del reporte
  HTML); agregarlo solo para Selenium reintroduciría la misma confusión que se acaba de
  corregir. Si se quiere en el futuro, es un spec propio, no una nota al pie de este.
- Locators `By.linkText`, `By.partialLinkText`, `By.tagName` — no tienen conversión
  limpia a lo que el motor sabe interpretar; si el locator no es convertible, el
  wrapper deja pasar el error original sin intentar curar.
- API explícita `plugin.findElement(locator)` fuera de `wrap()` — una sola forma de
  usar el plugin, consistente con cómo test-runner/cypress-plugin no le piden al
  usuario que cambie su código.

## 2. API pública

```typescript
// src/types.ts
export interface HealifySeleniumOptions {
  confidenceThreshold?: number        // default 0.8 — mismo piso que REVIEW_THRESHOLD
                                       // en reporter-core/src/local-mode.ts
  dryRun?: boolean                    // default false — cura pero no aplica, solo emite evento
  onEvent?: (e: HealingEvent) => void // hook opcional, para logging/tests del usuario
}

export type HealingEventType =
  | 'healed'          // curó y el retry con la sugerencia encontró el elemento
  | 'no-suggestion'    // analyzeAndHeal() devolvió confianza < threshold
  | 'not-convertible'  // el locator no es By.css/xpath/id/className/name
  | 'failed'           // curó pero el retry con la sugerencia también falló
  | 'error'            // analyzeAndHeal() tiró una excepción interna

export interface HealingEvent {
  type: HealingEventType
  originalSelector: string
  fixedSelector?: string
  confidence?: number
  explanation?: string
  latencyMs: number
}

// src/plugin.ts
export class HealifySeleniumPlugin {
  constructor(options?: HealifySeleniumOptions)
  wrap(driver: WebDriver): WebDriver   // devuelve un proxy; el driver original no se muta
}

// src/index.ts
export { HealifySeleniumPlugin } from './plugin'
export type { HealifySeleniumOptions, HealingEvent, HealingEventType } from './types'
```

Uso esperado:

```typescript
import { Builder } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'

const raw = await new Builder().forBrowser('chrome').build()
const driver = new HealifySeleniumPlugin({ onEvent: console.log }).wrap(raw)

await driver.findElement(By.css('#add-to-cart-btn')).click()  // se cura solo si rompe
```

## 3. Conversión de locators (`src/locator.ts`)

```typescript
export function locatorToSelector(locator: By): string | null
```

| `By` | Conversión | Nota |
|---|---|---|
| `By.css(s)` | `s` tal cual | ya es lo que el motor espera |
| `By.xpath(s)` | `s` tal cual | el motor reconoce el prefijo `//` |
| `By.id(s)` | `#${s}` | |
| `By.className(s)` | `.${s}` | |
| `By.name(s)` | `[name="${s}"]` | matchea la regla `ATTRIBUTE`/`name` ya existente |
| `By.linkText`/`By.partialLinkText`/`By.tagName` | `null` | no convertible, sin heurística nueva para esto |

`selenium-webdriver` no expone el tipo interno de un `By` de forma pública y estable —
`locatorToSelector` inspecciona `locator.constructor.name` y las propiedades internas
conocidas (`value`, `using`) que la librería sí expone en tiempo de ejecución. Si el
formato interno cambia entre versiones de `selenium-webdriver`, la función degrada a
`null` (no convertible) en vez de tirar, y el `peerDependency` fija `^4.0.0`.

## 4. Flujo de curado (`src/wrap.ts`)

```
wrappedDriver.findElement(locator)
  │
  ├─► try { return await realDriver.findElement(locator) }
  │
  ├─► catch (err) {
  │     if (!isNoSuchElementError(err)) throw err       // Stale/Timeout/etc.: no se tocan
  │
  │     const start = Date.now()
  │     const selector = locatorToSelector(locator)
  │     if (selector === null) { emit('not-convertible'); throw err }
  │
  │     let result
  │     try { result = analyzeAndHeal({ selector }) }
  │     catch { emit('error', latencyMs); throw err }    // la heurística nunca rompe el test
  │
  │     if (result.confidence < options.confidenceThreshold) {
  │       emit('no-suggestion', latencyMs); throw err
  │     }
  │     if (options.dryRun) {
  │       emit('healed', latencyMs, dryRun: true); throw err
  │     }
  │
  │     try { return await realDriver.findElement(By.css(result.fixedSelector)) }
  │     catch { emit('failed', latencyMs); throw err }   // nunca un error sintético
  │
  │     emit('healed', latencyMs); return <el elemento curado>
  │   }
```

**Garantías (igual que test-runner/cypress-plugin):**
- Solo errores de "elemento no encontrado" disparan curado. `StaleElementReferenceError`,
  `TimeoutError`, etc. pasan sin tocar.
- `analyzeAndHeal()` siempre corre dentro de un `try/catch` — un fallo interno de la
  heurística nunca rompe el test del usuario, se propaga el error original de Selenium.
- Si el retry con la sugerencia también falla, se lanza el error **original** — nunca uno
  sintético o de Healify.
- Un locator no convertible (`By.linkText` y similares) no intenta curar, pasa directo.

`findElements` (plural) del proxy llama directo al método real sin interceptar: Selenium
plural devuelve `[]` en vez de lanzar cuando no hay matches, así que no hay una excepción
que capturar ni un caso de "un solo elemento roto" que curar.

## 5. Estructura de archivos

```
selenium-plugin/
├── package.json        # @healify/selenium-plugin, peerDependency selenium-webdriver ^4.0.0
├── tsconfig.json        # mismo patrón que test-runner/cypress-plugin/cli
├── README.md             # "heurística local, no IA", fuera de alcance explícito, ejemplo de uso
├── src/
│   ├── index.ts
│   ├── plugin.ts
│   ├── wrap.ts
│   ├── locator.ts
│   ├── types.ts
│   └── __tests__/
│       ├── locator.test.ts
│       └── wrap.test.ts
```

`package.json` sigue el patrón real del repo (no el que asumía el borrador): sin pin
exacto de versión, `"@healify/reporter-core": "*"` en `devDependencies` — igual que
`cli/package.json` — resuelto por npm workspaces, empaquetado inline con `esbuild
--bundle` en el build (mismo script que `cypress-plugin`, adaptado al nombre del
paquete).

## 6. Testing (TDD, espejo de `cypress-plugin`)

- `locator.test.ts`: los 5 `By` convertibles con su selector esperado exacto, los 3 no
  convertibles devuelven `null`.
- `wrap.test.ts`, con un `WebDriver` mockeado (sin browser real) y
  `vi.mock('@healify/reporter-core')` (mismo patrón que `cypress-plugin/src/__tests__/plugin.test.ts`):
  1. `findElement` devuelve el elemento cuando el locator original funciona — no se
     invoca `analyzeAndHeal`.
  2. Cura con éxito cuando el original lanza "no such element" y la sugerencia sí
     encuentra el elemento.
  3. Sin sugerencia cuando la confianza queda debajo del `confidenceThreshold`.
  4. Propaga sin tocar errores que no son "no such element" (`StaleElementReferenceError`
     simulado).
  5. `analyzeAndHeal` lanzando una excepción interna no rompe el test — se propaga el
     error original.
  6. `dryRun: true` emite el evento `healed` pero lanza el error original (no aplica el
     fix).
  7. Locator no convertible (`By.linkText`) no intenta curar, propaga directo.
  8. El retry con la sugerencia también falla → se emite `failed` y se lanza el error
     **original**, no el del retry.
  9. `findElements` (plural) llama directo al método real, sin pasar por el flujo de
     curado.
  10. `onEvent` recibe la forma correcta de `HealingEvent` (type, selector, confidence,
      latencyMs) para cada uno de los casos de arriba.

Sin test E2E contra `chromedriver` real en esta fase — se puede agregar en una fase 5.5,
gateado por `RUN_E2E=1` para no depender de un browser instalado en CI, siguiendo la
misma idea que proponía el borrador original.

## 7. Integración en el monorepo

- Se agrega `"selenium-plugin"` al array `workspaces` del `package.json` raíz (junto a
  `reporter-core`, `test-runner`, `cypress-plugin`, `cli` — los 4 existentes hoy).
- CI (`.github/workflows/ci.yml`): una línea más en el job `typecheck` existente
  (`npx tsc --noEmit -p selenium-plugin/tsconfig.json`), igual que se hizo para `cli`.
  Los jobs `test` y `build` no necesitan cambios — ya delegan a todos los workspaces
  vía `npm test --workspaces --if-present` / `npm run build --workspaces`.
- Sin `.changeset/` — este repo no usa esa herramienta, versionado manual a mano en cada
  `package.json`, igual que las fases anteriores.
- Versión: `@healify/selenium-plugin@0.1.0` (paquete nuevo, no hereda el `0.2.0` de los
  demás). Los otros 4 paquetes no cambian de versión — no hay cambios de tipos en
  `reporter-core` que lo ameriten.

## 8. Riesgos conocidos, aceptados a propósito

- `locatorToSelector` depende de propiedades internas no documentadas públicamente de
  `selenium-webdriver` (sección 3). Mitigado fijando el peer dependency a `^4.0.0` y
  degradando a `null` en vez de tirar si el shape no matchea lo esperado — un locator
  "no convertible" es un caso ya manejado (pasa el error original), no un caso nuevo de
  falla.
- Sin reporte en esta fase: el usuario no tiene un artefacto tipo `healify-report.html`
  para revisar qué se curó en una corrida de Selenium — solo lo que capture vía
  `onEvent`. Aceptado como límite explícito del alcance; documentado en el README para
  no generar expectativas de paridad completa con test-runner/cypress-plugin todavía.
- `findElements` no cura: si todos los elementos esperados desaparecieron, Selenium
  devuelve `[]` sin señal de error, y hoy este plugin no distingue eso de "la página
  legítimamente no tiene esos elementos". Igual que el borrador original lo dejaba
  implícito, se documenta acá como límite conocido en vez de inventar una heurística de
  "lista vacía sospechosa".

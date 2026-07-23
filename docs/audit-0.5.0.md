# Auditoría 0.4.1 → 0.5.0 — 2026-07-23

Feature grande (init universal, 3 frameworks, cero a e2e real) + un bug crítico real
encontrado *durante* la validación de esa feature, no antes. Todo lo que sigue fue
verificado corriendo binarios reales (Playwright, Cypress, ChromeDriver), no solo tests
unitarios — mismo estándar que las auditorías anteriores de este repo.

## El hallazgo grande: `extractSelectorFromError` nunca extraía un `data-testid` completo

No lo estaba buscando. Apareció al armar el demo universal de `init`: un test de
Playwright con un selector roto `[data-testid="demo-boton-roto-healify"]` que debía
terminar clasificado `healed` (TESTID es la estrategia de mayor confianza del motor, 0.95
base). El primer run real dio `status: 'unresolved'`.

**Repro exacto:** timeout real de Playwright contra ese selector produce el mensaje:

```
TimeoutError: page.click: Timeout 3000ms exceeded.
Call log:
  - waiting for locator('[data-testid="demo-boton-roto-healify"]')
```

`extractSelectorFromError` usaba `/ locator\(["']([^"']+)["']\)/` — la clase `[^"']`
excluye AMBOS tipos de comilla del contenido capturado. Pero el contenido real
(`[data-testid="demo-boton-roto-healify"]`) tiene comillas dobles adentro, envuelto en
comillas simples por Playwright. El regex captura hasta la primera comilla doble interna
(`[data-testid=`), después necesita otra comilla+`)` inmediatamente y no la encuentra →
el patrón entero falla en matchear → ningún otro patrón matchea tampoco →
`'Unknown selector'` → `status: 'unresolved'` siempre.

**Alcance real:** cualquier selector con comillas del otro tipo adentro rompe el patrón.
Esto incluye TESTID (`[data-testid="x"]`, la recomendación estándar de selector estable),
pero también `[name="x"]`/`[aria-label="x"]` vía el patrón `"Waiting for selector"` y el
patrón `"selector ... not found"` (fraseo viejo/genérico de Playwright), y el texto citado
de `.contains()` de Cypress si el texto en sí contiene una comilla. El caso más grave con
diferencia es TESTID vía `locator()`, porque es el fraseo real que usa Playwright moderno
para CUALQUIER timeout de `page.click()`/`page.fill()`/etc. — es decir, este bug estaba
neutralizando la estrategia de mayor confianza del motor para el framework más usado.

**No afecta:** Cypress (`"Expected to find element: \`...\`"` usa backticks, delimitador
distinto, sin conflicto) ni Selenium (`analyzeAndHeal()` se llama directo con el selector
ya conocido — `wrap.ts` nunca pasa por `extractSelectorFromError`). Confirmado leyendo el
código de ambos antes de asumir que el bug era universal.

**Fix:** `reporter-core/src/selector-extractor.ts` — los 4 patrones que delimitaban por
comilla (`Waiting for selector`, `selector ... not found`, `locator(...)`, `Expected to
find content`) ahora usan `(["'])((?:(?!\1).)+)\1` — grupo 1 = qué comilla abrió (vía
backreference en un lookahead negativo), grupo 2 = contenido, que ahora SÍ puede tener
comillas del otro tipo adentro sin cortar la captura. `SelectorPattern` ganó un campo
`group?: number` (default 1) para que el loop sepa de qué grupo leer en cada patrón.

**Verificado real, antes y después:**

| | Antes | Después |
|---|---|---|
| `extractSelectorFromError` de un timeout real con `data-testid` | `'Unknown selector'` | `'[data-testid="demo-boton-roto-healify"]'` completo |
| `npx playwright test` contra ese selector, con la app corriendo | `Healed: 0 \| Review: 0 \| Unresolved: 1` | `Healed: 1 \| Review: 0 \| Unresolved: 0` |

6 tests de regresión nuevos en `reporter-core/src/__tests__/selector-extractor.test.ts`
(el caso real de arriba, la variante `data-cy`, comillas ANSI en el medio, `"Waiting for
selector"` y `"selector ... not found"` con comillas anidadas, el caso inverso —comillas
dobles afuera, simples adentro—, y una prueba de no-regresión del caso simple sin comillas
anidadas).

**Impacto en publicación:** `test-runner` y `cypress-plugin` *bundlean* `reporter-core` en
su propio `dist/` vía esbuild (no es una dependencia externa en el tarball publicado) — la
versión publicada en npm (0.4.0 de ambos) tiene el bug adentro, horneado. Republicar
`@healify/cli` solo no alcanza: hace falta republicar `test-runner` y `cypress-plugin`
también para que el fix llegue a usuarios reales. Ver comandos al final.

## Feature: `init` universal (cero a e2e real, cualquier framework)

Objetivo original: `npx @healify/cli init` funciona en cualquier proyecto (vacío, Vite,
Next, CRA, JS o TS) y con cualquier framework, dejando `doctor` en verde y un
`healify-report.html` real en la primera corrida — sin editar nada a mano.

### Qué se agregó

- `cli/src/scaffold.ts` (nuevo) — templates de config + demo para los 3 frameworks, en TS
  y JS, ESM y CJS
- `cli/src/prompt.ts` (nuevo) — prompt sync sin dependencias nuevas (`fs.readSync` sobre
  el fd 0), default determinístico si stdin no es TTY
- `cli/src/detect.ts` — `hasTypescript`, `detectModuleType`, `detectBaseUrl`
- `cli/src/commands/init.ts` — reescrito para los 3 casos (nada detectado → prompt +
  scaffold; framework instalado sin config → scaffold automático; config sin Healify →
  wireo existente, sin cambios)
- `cli/src/commands/doctor.ts` — mensaje de "no detectamos framework" actualizado

### El baseURL: encontrado un bug real de detección auditando un proyecto Vite real

Vite casi nunca define el puerto en `vite.config.*` — se pasa por flag en el script `dev`
de `package.json` (`"dev": "vite --port=3000"`, confirmado en `sgo-pzbp`: su
`vite.config.ts` no menciona el puerto para nada). Un detector que solo lea
`vite.config.*` habría generado `baseURL: 'http://localhost:5173'` — puerto equivocado, el
demo hubiera fallado por "no pude conectar" en vez de por el selector roto. `detectBaseUrl`
revisa primero el script `dev` (regex `--port[= ](\d+)`), después `server.port` dentro del
config, y recién ahí cae a los defaults (5173 Vite / 3000 Next). Verificado real: el
`playwright.config.ts` scaffoldeado en `sgo-pzbp` salió con `http://localhost:3000`, el
puerto correcto.

### El demo de Selenium: un problema de diseño encontrado corriendo el demo real

Primer intento: mismo selector `[data-testid="..."]` compartido con Playwright/Cypress.
Corrí el demo real contra ChromeDriver — el evento de cura se disparó bien (`confidence:
0.93`), pero el reintento volvió a tirar `NoSuchElementError`. No es un bug de código: es
que la estrategia TESTID solo normaliza el estilo de comillas
(`[data-testid="x"]`→`[data-testid='x']`), y para un navegador ambos selectores son
EXACTAMENTE el mismo — si el original no encuentra nada, el "fix" tampoco puede encontrar
nada nunca, porque no hay forma de que exista un elemento real que matchee uno pero no el
otro. Esto es inherente a la estrategia, no arreglable sin cambiar de estrategia.

A diferencia de Playwright/Cypress (que solo clasifican offline, nunca reintentan en
vivo), Selenium SÍ reintenta — así que su demo necesita un selector cuyo "fix" sea
genuinamente distinto. Se cambió a la estrategia de ID dinámico → clase estable:
`#boton-viejo-12345678` → `.boton-viejo` (confirmado corriendo `analyzeAndHeal()` real,
confidence 0.82 determinístico). El demo ahora navega a una página HTML autocontenida
(`data:` URL, no depende del DOM real del proyecto) con un botón real de clase
`boton-viejo`, y baja `confidenceThreshold` a 0.75 solo para el demo (0.82 queda por
debajo del default de producción 0.9 — comentado en el propio archivo generado, para que
no se confunda con una recomendación de producción). Verificado real: evento `healed` +
`.click()` exitoso.

## Tests

22 nuevos: `init.test.ts` ampliado (CASO A ×4, CASO B ×3, baseURL ×2, TS vs JS ×2,
idempotencia ×1, más los CASO C ya existentes sin tocar), `scaffold.test.ts` nuevo (6),
`selector-extractor.test.ts` +6 de regresión del bug de comillas. Build + verify:

| | Antes (0.4.1) | Después (0.5.0) |
|---|---|---|
| Tests | 138 (30+8+7+64+29) | **160** (36+8+7+80+29) |
| Build (5 workspaces) | ✅ | ✅ |

## Validación real end-to-end (no solo tests)

Contra `sgo-pzbp` (proyecto Vite real, sin ningún e2e armado — confirmado con `git status`
antes de tocar nada: solo cambios preexistentes ajenos en `package.json`/`package-lock.json`
y un archivo de migración SQL, ninguno tocado por esta sesión).

### Test A — Playwright (CASO B real: paquete instalado, sin config)

```
$ node cli/dist/index.js init
✅ @healify/test-runner ya estaba instalado
✅ archivos creados: playwright.config.ts, e2e/healify.demo.spec.ts, e2e/.gitkeep
```

`playwright.config.ts` generado con `baseURL: 'http://localhost:3000'` (correcto — puerto
real del script `dev`, no del `vite.config.ts`). Con la app corriendo:

```
$ npx playwright test e2e/healify.demo.spec.ts
Healed: 1 | Review: 0 | Unresolved: 0
```

(Nota: el primer intento, ANTES del fix de `extractSelectorFromError`, dio `Unresolved:
1` — así se encontró el bug de arriba. Repetido después del fix con el build local
inyectado temporalmente sobre el `dist/` instalado — restaurado el original apenas
terminó la prueba.)

`doctor` → 100% ✅ (framework, paquete, config, `healify-report.json`).

### Test B — Cypress (proyecto descartable aparte)

`cypress` no es una dependencia declarada en `sgo-pzbp` (solo `@healify/cypress-plugin`,
aunque el binario de Cypress 15.19 ya estaba cacheado localmente de trabajo previo). Para
no forzar una dependencia nueva en un repo de producción real, se validó en un proyecto
descartable en el scratchpad de la sesión — mismo patrón que la verificación de Selenium
en la auditoría 0.4.1 (script/proyecto tirable, nada persiste en el repo real):

```
$ npm install   # cypress + @healify/cypress-plugin publicados, ~23s (binario cacheado)
$ node .../cli/dist/index.js init
✅ archivos creados: cypress.config.js, cypress/e2e/healify.demo.cy.js, cypress/support/e2e.js
```

`cypress.config.js` con `baseUrl: 'http://localhost:3000'` (apuntando al mismo dev server
de `sgo-pzbp`, ya corriendo, reusado para no levantar infraestructura de más).

```
$ npx cypress run --spec cypress/e2e/healify.demo.cy.js
Healed: 1 | Review: 0 | Unresolved: 0
```

`doctor` → 100% ✅.

### Test C — Selenium (paquete ya instalado)

```
$ node cli/dist/index.js init
✅ archivos creados: healify.selenium.example.ts, e2e/selenium.demo.test.ts
$ npx tsx e2e/selenium.demo.test.ts
{
  type: 'healed',
  originalSelector: '#boton-viejo-12345678',
  fixedSelector: '.boton-viejo',
  confidence: 0.82,
  ...
}
✅ Healify curó el selector en vivo y el click funcionó — mirá el evento "healed" arriba.
```

ChromeDriver real, navegación a página autocontenida, cura real, click real. `doctor` →
100% ✅.

### Limpieza

Todo lo agregado a `sgo-pzbp` para las pruebas (`playwright.config.ts`, `e2e/`,
`healify.selenium.example.ts`, `healify-report.html/json`, `test-results/`) se borró al
terminar — confirmado con `git status` antes y después: el repo real queda exactamente en
el mismo estado que tenía (Vite-only, con los cambios preexistentes ajenos intactos, sin
tocarlos). El dev server (`vite --port=3000`) levantado para las pruebas se detuvo al
final. El proyecto descartable de Cypress vive en el scratchpad de la sesión, fuera de
cualquier repo real.

## Qué NO se hizo (a propósito)

- **No se instaló `@playwright/test`/`cypress`/`selenium-webdriver` explícitamente en
  `init`.** `test-runner`/`cypress-plugin`/`selenium-plugin` declaran esos frameworks como
  `peerDependencies` — `npm install --save-dev @healify/test-runner` en un proyecto
  realmente vacío ya los instala como efecto de la resolución de peer dependencies de npm
  7+. No hacía falta código nuevo para esto; es comportamiento estándar de npm. Nota para
  el usuario: el framework queda satisfecho en `node_modules`/`package-lock.json` pero no
  aparece como línea propia en `package.json` a menos que se agregue a mano — no es un bug
  de Healify, es cómo funcionan los peer deps.
- **No se tocó `sgo-pzbp` de forma permanente.** Ni un archivo nuevo, ni una dependencia
  nueva quedó en el repo real — coherente con el pedido explícito ("Deja sgo-pzbp
  vite-only") y con el criterio ya establecido en la auditoría 0.4.1 de no inyectar
  infraestructura no pedida en un repo de producción ajeno.
- **`esbuild`** (vulnerabilidad breaking pendiente desde 0.4.1) sigue sin tocar — nadie
  pidió resolverla en esta sesión, y sigue siendo un bump breaking del build de los 4
  paquetes publicables. Ver `docs/audit-0.4.1.md`.

## Qué falta para publicar

**Importante:** a diferencia de auditorías anteriores, esta vez hace falta republicar
`test-runner` y `cypress-plugin` además de `cli` — el fix de `extractSelectorFromError`
vive en `reporter-core`, que ambos bundlean en su propio `dist/` publicado. La versión
0.4.0 actualmente en npm de esos dos paquetes tiene el bug adentro.

```bash
cd C:\Proyectos\QA\Healify
npm publish --workspace=@healify/test-runner
npm publish --workspace=@healify/cypress-plugin
npm publish --workspace=@healify/cli
```

`selenium-plugin` no tiene cambios de código (no usa el archivo con el bug) — no hace
falta republicarlo, queda en `0.1.0`.

## Commit

Sin push, sin publish — a la espera del OK, según lo pedido explícitamente al inicio de
esta tarea ("No push ni publish").

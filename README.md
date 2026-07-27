<div align="center">
  <img src="logo-healify.png" alt="Healify" width="120" />
  <h1>Healify</h1>
  <p><strong>Cuando un selector se rompe, Healify te dice cómo arreglarlo, sin salir de tu máquina.</strong></p>

  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" />
  <img src="https://img.shields.io/badge/Cypress-15-green?logo=cypress" />
  <img src="https://img.shields.io/badge/Selenium-4-green?logo=selenium" />
  <img src="https://img.shields.io/badge/WebdriverIO-9-green?logo=webdriverio" />
  <img src="https://img.shields.io/badge/coverage-~85%25-brightgreen" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
</div>

## En 30 segundos (salida real, sin editar)

Tenés un test que hace `page.click('#add-to-cart-btn')`. Alguien renombró ese botón y el
test se rompe. Así se ve Healify curándolo, de punta a punta:

```console
$ npx @healify/cli init
Healify init

✅ @healify/test-runner ya estaba instalado
✅ archivos creados:
   - playwright.config.js

✅ Config lista. Healify no te genera tests: el primer selector que cure tiene que ser
   uno de tu propia app. Creá este archivo y editalo:

   e2e/mi-primer-test.spec.js
   [...el snippet completo, más abajo en "Tu primer test, paso a paso"]

$ npx playwright test
  1 failed
Healed: 1 | Review: 0 | Unresolved: 0        # ← Healify ya analizó el selector roto

$ npx @healify/cli fix --ast
Healify fix — healify-report.json (--ast)

✓ e2e/checkout.spec.ts — #add-to-cart-btn → role('button', { name: 'Add' })

1 selector aplicado · 0 salteados
```

Y el archivo de test quedó reescrito solo, con un selector estable:

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Add' }).click()
```

Cada corrida además deja un **`healify-report.html`** autocontenido (dark/light,
interactivo, 100% offline). Podés ver uno real acá:
[`docs/ejemplos/healify-report-ejemplo.html`](docs/ejemplos/healify-report-ejemplo.html)
(descargalo y abrilo en tu navegador).

## El reporte, en formato de QA

Cada corrida escribe tres archivos, siempre — también cuando todos los tests pasan, porque
un "salió todo bien" registrado es parte del trabajo:

| Archivo | Para qué |
|---|---|
| `healify-report.html` | Leerlo vos: interactivo, con evidencia y modo claro/oscuro |
| `healify-report.md` | Pegarlo en un ticket de Jira/Redmine o en un informe |
| `healify-report.json` | Consumirlo desde otra herramienta o desde la GitHub Action |

Los tres arrancan con un veredicto **PASS/FAIL** de la corrida y el entorno donde se ejecutó
(framework y versión, navegador, URL base, sistema, Node y duración). Cada defecto trae:

- **ID estable** (`HLF-A1B2C3`) — el mismo selector roto en el mismo archivo da siempre el
  mismo ID, en tu máquina y en la de tu compañero.
- **Severidad**: bloqueante (sin sugerencia), mayor (necesita revisión) o menor (hay un
  arreglo de alta confianza listo para aplicar).
- **Resultado esperado vs. obtenido**, ubicación exacta (`archivo:línea`) y duración.
- **Pasos para reproducir**, tomados de los que el framework registró de verdad durante el
  test — no son pasos inventados.
- **Evidencia**: link al screenshot que Playwright/Cypress ya guardó, si lo tenés activado.

Lo que un adapter no puede saber, no aparece. Selenium y WebdriverIO curan en vivo dentro de
tu código y no tienen concepto de "suite", así que su reporte no inventa un total de tests.

## Frameworks soportados

Playwright, Cypress, Selenium y WebdriverIO. Los cuatro reusan el mismo motor heurístico
(`reporter-core`): Playwright y Cypress generan `healify-report.html`/`.json` al final de
la corrida; Selenium y WebdriverIO curan en vivo (envuelven el driver/browser) y generan
`healify-report.json` cuando llamás a `flush()`.

## Para quién es esto

**Si sos QA Manual, QA Automation o QC Engineer y se te rompe un test porque cambió un ID, una clase o un texto, esto es para vos.**

No necesitás saber programar, no necesitás cuenta, API key, ni internet. Healify corre 100% local.

- **QA Manual:** Te avisa qué selector se rompió y te propone uno más estable.
- **QA Automation:** Te genera un reporte HTML + JSON y te deja aplicar el fix con un comando.
- **QC Engineer:** Te asegura que los selectores que queden sean los más estables (`data-testid` > `id` > `name` > `aria` > texto).

> **Qué NO es:** No es IA, no es un servicio en la nube, no manda tu código a ningún lado.
> Es pattern-matching local sobre el texto del selector y del mensaje de error — nunca
> analiza el DOM real, nunca verifica que la sugerencia exista de verdad en la página.

## Empiezo de cero (recomendado para QA)

Si nunca usaste Healify, hacé esto. Te toma 2 minutos.

**Paso 1: Instalar la herramienta de diagnóstico**

```bash
npm install --save-dev @healify/cli
```

**Paso 2: Diagnosticar tu proyecto**

```bash
npx @healify/cli doctor
```

Te va a decir:

- Qué framework usás (Playwright / Cypress / Selenium / WebdriverIO)
- Si tenés instalado lo necesario
- Si tu config está lista (Playwright/Cypress; Selenium/WebdriverIO curan en vivo, no
  tienen config que wirear)
- Si ya generaste un reporte

Ejemplo real (`npx @healify/cli doctor`, sin nada instalado todavía):

```
Healify doctor

✅ Framework detectado: playwright
❌ @healify/test-runner instalado
   fix: npm install --save-dev @healify/test-runner
❌ playwright.config.ts tiene Healify configurado
   fix: npx @healify/cli init
❌ healify-report.json existe
   fix: Corré tus tests al menos una vez con algún selector roto para generar el reporte.
```

`doctor` no te pregunta nada ni instala nada por vos: solo diagnostica. Cada `fix:` es el
comando exacto para arreglar ese punto. Si usás Selenium o WebdriverIO en vez de
Playwright/Cypress, el check de `healify-report.json` no aparece (curan en vivo, no
generan ese reporte solos).

**Paso 3: Arreglar la config automáticamente**

```bash
npx @healify/cli init
```

Esto:

- Te instala el paquete correcto (`test-runner` para Playwright, `cypress-plugin` para
  Cypress, `selenium-plugin` para Selenium, `webdriverio-plugin` para WebdriverIO)
- Te edita el `playwright.config.ts` o `cypress.config.ts` automáticamente (o te los crea de
  cero si todavía no existían); para Selenium/WebdriverIO te deja un archivo de referencia
  documental (nunca se ejecuta) mostrando cómo envolver tu driver/browser
- No duplica nada si ya lo tenías

> **¿Ni siquiera tenés Playwright/Cypress/Selenium/WebdriverIO instalado?** No hace falta
> el Paso 2: corré directamente `npx @healify/cli init`. Te pregunta qué framework armar,
> lo instala y te deja el config conectado. **No genera ningún test**: el primer selector
> roto que Healify cure tiene que ser uno de tu propia app, no uno inventado. Detalle de
> los 3 casos en el [README del CLI](cli/README.md).

**Paso 4: Levantá tu app y corré tu primer test real**

Un test e2e abre un navegador de verdad y navega a una URL real. Antes de escribir o
correr nada, levantá tu app en una terminal aparte y dejala corriendo:

```bash
npm run dev
```

Confirmá que responde abriendo esa URL a mano en el navegador.

Recién ahí escribí tu primer test. Healify no te lo genera: el primer selector que cure
tiene que ser uno de tu propia app, no uno inventado. Este es el mínimo que necesitás.

**Si usás Playwright**, creá `e2e/mi-primer-test.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('mi primer test', async ({ page }) => {
  await page.goto('/')
  await page.click('#reemplazar-por-tu-selector-real')
})
```

**Si usás Cypress**, creá `cypress/e2e/mi-primer-test.cy.ts`:

```ts
it('mi primer test', () => {
  cy.visit('/')
  cy.get('#reemplazar-por-tu-selector-real').click()
})
```

Línea por línea:

- `goto('/')` / `visit('/')` abre el navegador en tu `baseURL` (la que quedó en el config).
  La barra sola es la home; podés poner `/login` o cualquier otra ruta.
- `click(...)` busca un elemento y le hace click. **Ese es el selector que Healify va a
  curar cuando se rompa** — el resto del test es andamiaje.
- `#reemplazar-por-tu-selector-real` es un placeholder, no un selector que exista. Tenés que
  cambiarlo por uno de tu app o el test va a fallar por el motivo equivocado.

`init` te imprime este mismo snippet al terminar, ya ajustado a tu proyecto: en `.js` si no
usás TypeScript, y con `require` en vez de `import` si tu `package.json` es CommonJS.

Para sacar un selector real: abrí tu app en el navegador, click derecho sobre el elemento →
*Inspeccionar*. En el HTML que se abre buscá un `id` (`#mi-id`) o un `data-testid`
(`[data-testid="mi-id"]`). Si no tiene ninguno de los dos, sirve una clase (`.mi-clase`),
aunque son más frágiles — justamente el tipo de fragilidad que Healify detecta.

> **Usá el framework que ya te detectó `doctor`.** Si tu proyecto tiene Playwright, corré
> `npx playwright test`; no instales Cypress "para probar". Correr `npx cypress run` en un
> proyecto que solo tiene Playwright configurado falla por falta de Cypress, no por Healify.

Con el archivo creado y tu app levantada:

```bash
npx playwright test
# o, si tu proyecto usa Cypress
npx cypress run
```

Al terminar se crean `healify-report.html`, `healify-report.md` y `healify-report.json` en la
raíz — siempre, hayan fallado tests o no. Si la corrida salió limpia, el reporte lo dice con
un **PASS** en vez de quedar vacío.

> **¿El test falla apenas arranca, con algo que no tiene nada que ver con tu app (una
> página en blanco, contenido de otra herramienta)?** Puede que otro programa esté usando
> el mismo puerto que tu `baseURL`. Confirmá quién responde ahí antes de sospechar de
> Healify o de tu selector:
> ```powershell
> Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress, OwningProcess
> ```
> Si aparece un proceso que no es el de tu app, corré tu `dev` en otro puerto (ajustando
> `baseURL` en `playwright.config.ts`/`cypress.config.*` a mano, o cambiando el puerto en
> tu script `dev` de forma permanente si el conflicto se repite siempre).

**Paso 5: Ver el reporte y aplicar el fix**

```bash
# Ver qué haría sin tocar nada
npx @healify/cli fix --dry-run

# Aplicar los fixes de mayor confianza en tus archivos
npx @healify/cli fix
```

Abrí `healify-report.html` en el navegador para ver: `Healed: 1 | Review: 1 | Unresolved: 2`

Listo.

## Paquetes

| Paquete | Versión | Para qué | Comando |
|---|---|---|---|
| [`@healify/test-runner`](test-runner/README.md) | 1.0.0 | Playwright - genera reporte al final | `npm i -D @healify/test-runner` |
| [`@healify/cypress-plugin`](cypress-plugin/README.md) | 1.0.0 | Cypress - mismo reporte | `npm i -D @healify/cypress-plugin` |
| [`@healify/selenium-plugin`](selenium-plugin/README.md) | 1.0.0 | Selenium - cura en vivo, `flush()` genera reporte JSON | `npm i -D @healify/selenium-plugin` |
| [`@healify/webdriverio-plugin`](webdriverio-plugin/README.md) | 1.0.0 | WebdriverIO - cura en vivo, `flush()` genera reporte JSON | `npm i -D @healify/webdriverio-plugin` |
| [`@healify/cli`](cli/README.md) | 1.0.0 | CLI - diagnostica, configura (sin generar tests), aplica fixes y guarda historial | `npm i -D @healify/cli` |
| `reporter-core` | 1.0.0 | Motor heurístico - privado, bundleado | — |

### Instalación manual (si no querés usar `init`)

<details>
<summary><strong>Playwright</strong></summary>

```bash
npm install --save-dev @healify/test-runner
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  reporter: [['list'], ['@healify/test-runner/reporter']],
})
```

</details>

<details>
<summary><strong>Cypress</strong></summary>

```bash
npm install --save-dev @healify/cypress-plugin
```

`cypress.config.ts`:

```ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'
export default defineConfig({
  e2e: { setupNodeEvents: (on, config) => HealifyCypressPlugin(on, config) },
})
```

</details>

<details>
<summary><strong>Selenium</strong></summary>

```bash
npm install --save-dev @healify/selenium-plugin selenium-webdriver
```

```ts
import { Builder, By } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'
const raw = await new Builder().forBrowser('chrome').build()
const healify = new HealifySeleniumPlugin({ onEvent: console.log })
const driver = healify.wrap(raw)
await driver.findElement(By.css('#add-to-cart-btn')).click()
// al final de la suite, si querés un healify-report.json:
healify.flush()
```

Cura en vivo. `flush()` genera `healify-report.json` (sin HTML). Ver su README para
limitaciones.
</details>

<details>
<summary><strong>WebdriverIO</strong></summary>

```bash
npm install --save-dev @healify/webdriverio-plugin
```

```ts
import { remote } from 'webdriverio'
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'
const raw = await remote({ capabilities: { browserName: 'chrome' } })
const healify = new HealifyWebdriverIOPlugin({ onEvent: console.log })
const browser = healify.wrap(raw)
await browser.$('#add-to-cart-btn').click()
// al final de la suite, si querés un healify-report.json:
healify.flush()
```

Cura en vivo. `flush()` genera `healify-report.json` (sin HTML). Ver su README para
limitaciones.
</details>

## Comandos del CLI, explicados para QA

| Comando | Qué hace | Cuándo usarlo |
|---|---|---|
| `npx @healify/cli doctor` | Revisa tu proyecto y te dice qué falta | Siempre primero. Si algo no anda, corrés esto. |
| `npx @healify/cli init` | Detecta tu framework e instala/configura todo | La primera vez que usás Healify en un proyecto. |
| `npx @healify/cli fix --dry-run` | Te muestra qué archivos tocaría, sin tocar nada | Para revisar antes de aplicar. |
| `npx @healify/cli fix` | Aplica los selectores curados en tus archivos de test | Después de ver el reporte. |
| `npx @healify/cli history` | Muestra selectores recurrentes y re-rotos de tu historial local | Después de correr `fix` varias veces, para ver patrones. |

**Si te da error `ENOENT: healify-report.json`:** es porque no corriste los tests todavía. Corré `doctor` primero, después tus tests, recién después `fix`.

**Si ya tenías Healify instalado de antes y `init`/`doctor` no muestran lo nuevo de esta
versión:** revisá qué versión tenés instalada de verdad.

```bash
npx @healify/cli --version
```

Los 6 paquetes de Healify están en `1.0.0`. Si venís de una instalación anterior a la
1.0.0, `doctor` te avisa si tu `package.json` todavía tiene un rango `^0.x.y` viejo (el
gotcha de semver: `^0.4.1` significa "cualquier `0.4.x`", no te sube solo a `0.5.0`, y
mucho menos a `1.0.0`). Actualizalo pidiendo la versión a mano:

```bash
npm install --save-dev @healify/cli@latest @healify/test-runner@latest
# o el paquete que uses: @healify/cypress-plugin@latest, @healify/selenium-plugin@latest, @healify/webdriverio-plugin@latest
```

Esto no pasa la primera vez que instalás Healify en un proyecto nuevo (ahí ya te queda
`^1.0.0`, que sí sube de minor con un `npm install` normal).

## Qué reconoce el motor hoy

Pattern-matching sobre el texto del selector, sin analizar el DOM real:

- Testids: `data-testid`, `data-cy`, `data-qa`, `data-test`, `data-e2e`
- `[name=]`, `[aria-label=]`, `[role=]`, texto visible (`text=`, `:has-text()`)
- Locators modernos de Playwright (`getByRole`/`getByText`/`getByLabel`/`getByPlaceholder`/`getByTestId`) — no les propone downgrade
- IDs y clases dinámicas (hash de build, CSS-in-JS) — propone la parte estable
- Selectores por posición (`nth-child`/`nth-of-type`) — los marca como frágiles y propone una alternativa por rol
- Diccionario bilingüe de acciones/campos (`login`/`iniciar`, `email`/`correo`, etc.)

## Cómo leer el reporte

`healify-report.html` tiene 3 estados:

- **Healed (Verde):** Encontró un selector estable y confiable. Ej: `data-testid="add-to-cart"`. `fix` lo puede aplicar solo.
- **Review (Amarillo):** Encontró algo, pero necesita que lo mires. Ej: propone cambiar de `.css-123` a texto `Add to cart`. Revisalo.
- **Unresolved (Rojo):** No encontró alternativa estable. Tenés que arreglarlo a mano.

El `printSummary` al final de la corrida en consola te muestra lo mismo: `Healed: 3 | Review: 1 | Unresolved: 0`

## Para devs y contribuidores

Estos comandos son del repo de Healify (este monorepo), no de un proyecto que lo consume:

```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
npm run build
npm run verify     # build + todos los tests, resumen por paquete
npm run coverage   # cobertura de líneas por paquete (v8)
```

### Cobertura (medida con `npm run coverage`)

| Paquete | Líneas |
|---|---|
| reporter-core (el motor) | ~90% |
| cypress-plugin | 100% |
| selenium-plugin | 100% |
| webdriverio-plugin | ~87% |
| cli | ~72% |
| test-runner | ~62% |

Reproducible en tu máquina con `npm run coverage`. El motor de heurística
(`reporter-core`), que es donde vive toda la lógica real, es el más cubierto; los adapters
de framework son más finos y algunos caminos solo se ejercitan contra un browser real.

## Estructura

```
reporter-core/       # Motor heurístico (privado)
test-runner/         # @healify/test-runner 1.0.0
cypress-plugin/      # @healify/cypress-plugin 1.0.0
selenium-plugin/     # @healify/selenium-plugin 1.0.0
webdriverio-plugin/  # @healify/webdriverio-plugin 1.0.0
cli/                 # @healify/cli 1.0.0 - init, doctor, fix, history
gh-action/           # GitHub Action (privada, no es workspace de npm ni se publica)
docs/guide/          # Manual detallado
```

## Historia

Antes fue un SaaS completo con dashboard, auth y billing. Se recortó a solo paquetes
locales porque el QA lo quiere en su PC, sin servidor ni cuenta. Ese código viejo vive en
la rama de git [`archive/saas-full`](https://github.com/mescobar996/Healify/tree/archive/saas-full)
(`git checkout archive/saas-full` para verlo) — no es una carpeta de la rama `main`.

## Licencia

MIT. Ver [LICENSE](LICENSE). © 2026 Matías Escobar

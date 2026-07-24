<div align="center">
  <h1>Healify</h1>
  <p><strong>Cuando un selector se rompe, Healify te dice cómo arreglarlo, sin salir de tu máquina.</strong></p>

  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" />
  <img src="https://img.shields.io/badge/Cypress-15-green?logo=cypress" />
  <img src="https://img.shields.io/badge/Selenium-4-green?logo=selenium" />
  <img src="https://img.shields.io/badge/tests-238%20verdes-brightgreen" />
</div>

---

## Para quién es esto

**Si sos QA Manual, QA Automation o QC Engineer y se te rompe un test porque cambió un ID, una clase o un texto, esto es para vos.**

No necesitás saber programar, no necesitás cuenta, API key, ni internet. Healify corre 100% local.

- **QA Manual:** Te avisa qué selector se rompió y te propone uno más estable.
- **QA Automation:** Te genera un reporte HTML + JSON y te deja aplicar el fix con un comando.
- **QC Engineer:** Te asegura que los selectores que queden sean los más estables (`data-testid` > `id` > `name` > `aria` > texto).

> **Qué NO es:** No es IA, no es un servicio en la nube, no manda tu código a ningún lado. Es pattern-matching local sobre el DOM.

---

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

- Qué framework usás (Playwright / Cypress / Selenium)
- Si tenés instalado lo necesario
- Si tu config está lista
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
comando exacto para arreglar ese punto. Si usás Selenium en vez de Playwright/Cypress, el
check de `healify-report.json` no aparece (Selenium cura en vivo, no genera reporte).

**Paso 3: Arreglar la config automáticamente**

```bash
npx @healify/cli init
```

Esto:

- Te instala el paquete correcto (`test-runner` para Playwright, `cypress-plugin` para Cypress,
  `selenium-plugin` para Selenium)
- Te edita el `playwright.config.ts` o `cypress.config.ts` automáticamente (o te los crea de
  cero si todavía no existían)
- No duplica nada si ya lo tenías

> **¿Ni siquiera tenés Playwright/Cypress/Selenium instalado?** No hace falta el Paso 2:
> corré directamente `npx @healify/cli init`. Te pregunta qué framework armar, lo instala y
> te deja el config conectado. **No genera ningún test**: el primer selector roto que
> Healify cure tiene que ser uno de tu propia app, no uno inventado. Detalle de los 3 casos
> en el [README del CLI](cli/README.md).

**Paso 4: Levantá tu app y corré tu primer test real**

Un test e2e abre un navegador de verdad y navega a una URL real. Antes de escribir o
correr nada, levantá tu app en una terminal aparte y dejala corriendo:

```bash
npm run dev
```

Confirmá que responde abriendo esa URL a mano en el navegador. Recién ahí, si todavía no
tenés ningún test e2e, escribí uno simple contra una pantalla real de tu app (un login, un
botón que ya exista) en `e2e/` (Playwright) o `cypress/e2e/` (Cypress). El reporter ya está
conectado, no hace falta tocar nada más de la config.

```bash
npx playwright test
# o
npx cypress run
```

Al terminar, si algo falló por selector roto, se crea `healify-report.html` y `healify-report.json` en la raíz.

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

---

## Paquetes

| Paquete | Versión | Para qué | Comando |
|---|---|---|---|
| [`@healify/test-runner`](test-runner/README.md) | 0.7.1 | Playwright - genera reporte al final | `npm i -D @healify/test-runner` |
| [`@healify/cypress-plugin`](cypress-plugin/README.md) | 0.7.0 | Cypress - mismo reporte | `npm i -D @healify/cypress-plugin` |
| [`@healify/selenium-plugin`](selenium-plugin/README.md) | 0.7.0 | Selenium - cura en vivo, `flush()` genera reporte JSON | `npm i -D @healify/selenium-plugin` |
| [`@healify/webdriverio-plugin`](webdriverio-plugin/README.md) | 0.6.0 | WebdriverIO - cura en vivo, `flush()` genera reporte JSON | `npm i -D @healify/webdriverio-plugin` |
| [`@healify/cli`](cli/README.md) | 0.8.0 | CLI - diagnostica, configura (sin generar tests), aplica fixes y guarda historial | `npm i -D @healify/cli` |
| `reporter-core` | 0.7.0 | Motor heurístico - privado, bundleado | — |

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

---

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
npx @healify/cli --help   # la primera línea de ayuda no dice versión; mirá node_modules
cat node_modules/@healify/cli/package.json | grep version
```

Todos los paquetes de Healify son `0.x`. Con semver, `^0.4.1` en tu `package.json`
significa "cualquier `0.4.x`", **no** te deja subir a `0.5.0` con un `npm install` sin
versión explícita. Si ya tenías Healify de una versión anterior, actualizalo pidiendo la
versión a mano:

```bash
npm install --save-dev @healify/cli@latest @healify/test-runner@latest
# o el paquete que uses: @healify/cypress-plugin@latest, @healify/selenium-plugin@latest
```

Esto no pasa la primera vez que instalás Healify en un proyecto nuevo (ahí no hay ningún
`^0.x.y` viejo frenándote), solo al actualizar una instalación existente.

---

## Cómo leer el reporte

`healify-report.html` tiene 3 estados:

- **Healed (Verde):** Encontró un selector estable y confiable. Ej: `data-testid="add-to-cart"`. `fix` lo puede aplicar solo.
- **Review (Amarillo):** Encontró algo, pero necesita que lo mires. Ej: propone cambiar de `.css-123` a texto `Add to cart`. Revisalo.
- **Unresolved (Rojo):** No encontró alternativa estable. Tenés que arreglarlo a mano.

El `printSummary` al final de la corrida en consola te muestra lo mismo: `Healed: 3 | Review: 1 | Unresolved: 0`

---

## Para devs y contribuidores

```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
npm run build
npm run verify   # 238 tests en verde
```

## Estructura

```
reporter-core/       # Motor heurístico (privado)
test-runner/         # @healify/test-runner 0.7.1
cypress-plugin/      # @healify/cypress-plugin 0.7.0
selenium-plugin/     # @healify/selenium-plugin 0.7.0
webdriverio-plugin/  # @healify/webdriverio-plugin 0.6.0
cli/                 # @healify/cli 0.8.0 - init, doctor, fix, history
gh-action/           # GitHub Action (privada, no es workspace de npm ni se publica)
docs/guide/          # Manual detallado
```

## Historia

Antes fue un SaaS completo con dashboard, auth, billing. Se recortó a solo paquetes locales porque el QA lo quiere en su PC. El código viejo está en `archive/saas-full`.

## License

MIT © 2026 Healify

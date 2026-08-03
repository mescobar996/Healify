<div align="center">
  <img src="logo-healify.png" alt="Healify" width="120" />
  <p><strong>Cuando un selector se rompe, Healify te dice cómo arreglarlo. Sin salir de tu máquina.</strong></p>

  <a href="https://www.npmjs.com/package/@healify/cli"><img src="https://img.shields.io/npm/v/@healify/cli" alt="npm" /></a>
  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/tests-601%20passing-brightgreen" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/100%25%20local-true-blue" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" />
  <a href="https://healify-sigma.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-healify--sigma.vercel.app-blue" /></a>
</div>

---

## En 30 segundos

```console
$ npx @healify/cli@latest doctor   # diagnostica tu proyecto
$ npx @healify/cli@latest init     # detecta tu framework y configura
$ npx playwright test              # 1 failed -> selector roto
$ npx @healify/cli@latest fix      # aplica el fix en tus archivos de test
```

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Add' }).click()
```

Cada corrida genera `healify-report.html` (dark/light, interactivo, 100% offline).

---

## Qué es

**Healify** es un heal local de selectores rotos para **Playwright, Cypress, Selenium y WebdriverIO**. Cuando un test falla porque un selector ya no existe, Healify analiza tu DOM real y propone una alternativa verificada contra la página.

Sin IA, sin nube, sin cuenta, sin API key, sin tracking. El análisis corre 100% en tu máquina con heurística determinista.

---

## Por qué existe

Los selectores frágiles rompen CI sin razón. Un `#add-to-cart-btn` cambió de id y el build muere. Healify prioriza lo que ya es estable —roles ARIA, texto accesible, estructura semántica— en vez de posiciones o clases volátiles.

El motor rankea cada selector por estabilidad y te da el mejor alternativo posible, verificado contra tu DOM real.

---

## Cómo funciona

```
01 CAPTURA   Instalás el reporter de tu runner. Si un selector falla, captura DOM + metadata.
02 ANÁLISIS  100% offline. Analiza roles ARIA, texto y estructura en ~12ms para 1k+ nodos.
03 FIX       Abrís healify-report.html, ves el antes/después y aplicás el fix (o lo dejás correr).
```

---

## Ecosistema `@healify/*`

| Paquete | Runner | Descripción | Instalar |
|---|---|---|---|
| `@healify/reporter-core` | Core | Motor de healing + audit + browser-probe + role-locator. Base de todos los demás. | `npm i -D @healify/reporter-core` |
| `@healify/test-runner` | Playwright | Reporter que genera `healify-report.html` al fallar. | `npm i -D @healify/test-runner` |
| `@healify/cypress-plugin` | Cypress | Plugin + support para reportar selectores rotos. | `npm i -D @healify/cypress-plugin` |
| `@healify/selenium-plugin` | Selenium | Wrapper de WebDriver con cura en vivo. | `npm i -D @healify/selenium-plugin` |
| `@healify/webdriverio-plugin` | WebdriverIO | Wrapper v8+ con auto-heal opcional en dev. | `npm i -D @healify/webdriverio-plugin` |
| `@healify/ai-local` | AI Local | CLI local + `detect-ram` para IA opcional via Ollama. | `npm i -D @healify/ai-local` |
| `@healify/cli` | CLI | `doctor`, `init`, `fix`, `history`, `heal`, `explain`, `probe-script`. | `npx @healify/cli@latest` |

Todos dependen de `@healify/reporter-core`. Todos publicados con `publishConfig: { access: "public" }`.

---

## Quick Start

```bash
npm i -D @healify/cli
npx @healify/cli@latest doctor
npx @healify/cli@latest init
npx @healify/cli@latest fix --dry-run
```

### Playwright

```bash
npm i -D @healify/cli @healify/test-runner
```

En `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [['@healify/test-runner/reporter', {}]],
})
```

### Cypress

```bash
npm i -D @healify/cypress-plugin
```

En `cypress.config.ts`:

```typescript
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

### Selenium

```bash
npm i -D @healify/selenium-plugin
```

```typescript
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'
import { Builder } from 'selenium-webdriver'

const plugin = new HealifySeleniumPlugin()
const driver = await new Builder().forBrowser('chrome').build()
const wrappedDriver = plugin.wrap(driver)

// Usar wrappedDriver en vez de driver
await wrappedDriver.findElement(By.css('#submit'))
// Si #submit falla, Healify propone un alternativo

// Al final del test
plugin.flush() // escribe healify-report.json
```

### WebdriverIO

```bash
npm i -D @healify/webdriverio-plugin
```

```typescript
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'

const plugin = new HealifyWebdriverIOPlugin()
const wrappedBrowser = plugin.wrap(browser)

// Usar wrappedBrowser en vez de browser
await wrappedBrowser.$('#submit').click()

// Al final del test
plugin.flush()
```

---

## Comandos CLI

| Comando | Qué hace |
|---|---|
| `healify init` | Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte y configura el reporter/plugin. No genera tests. |
| `healify doctor` | Verifica que Healify esté instalado y bien configurado. |
| `healify fix [reporte.json]` | Aplica las sugerencias de mayor confianza directo en tus archivos de test. |
| `healify history` | Muestra selectores recurrentes y re-rotos de `.healify/history.jsonl`. |
| `healify heal` | Motor vía JSON por stdin/stdout, para usar desde Python/Java/C#/etc. |
| `healify probe-script` | Imprime el script para sondear el DOM con `execute_script()` (insumo de `heal`). |
| `healify explain [selector]` | Explica por qué un selector es frágil y qué propone el motor. |
| `healify ai <setup\|status\|explain\|chat\|models>` | IA local opcional via Ollama. |

### Flags de `healify fix`

| Flag | Efecto |
|---|---|
| `--dry-run` | Muestra qué se curaría sin modificar archivos. |
| `--force` | Aplica aunque el archivo tenga cambios sin commitear. |
| `--pr` | Crea branch + commit + PR automáticamente (requiere `gh` CLI). |
| `--no-ast` | Desactiva la reescritura de sugerencias `role(...)` (sustitución simple). |
| `--no-pom` | No busca el selector en los page objects cuando no está en el archivo de test. |
| `--interactive` | Pregunta caso por caso antes de aplicar. |

#### Page Object Model

Si el selector roto no está en el spec (lo normal con POM: vive en `pages/login.page.ts`), `fix`
lo busca en el resto del código del proyecto y aplica el cambio ahí, diciéndote en qué archivo lo
tocó. Conservador: solo aplica si hay **un único** archivo con **una única** ocurrencia; con dos
candidatos reporta ambiguo y no toca nada. Se apaga con `--no-pom`.

### `healify heal` (para adapters)

```bash
echo '{"testFile":"test.py","testName":"test_login","selector":"#old-btn","errorMessage":"..."}' | npx @healify/cli@latest heal
# -> {"fixedSelector":"[data-testid='login']","confidence":0.95,"verified":true,...}
```

---

## Configuración

Opcional. Healify funciona sin nada configurado. Se lee de `healify.config.js` → `healify.config.cjs` → `healify.config.json` → la key `healify` de `package.json` (gana el primero que exista).

```js
// healify.config.js  (CommonJS)
module.exports = {
  healEnabled: true,        // apagá el sanado sin desinstalar nada
  minConfidence: 0.90,      // confianza mínima para que un caso salga "healed" (lo que fix aplica)
  reviewConfidence: 0.80,   // debajo de esto, "unresolved"
  maxAlternatives: 3,       // cuántas alternativas guarda el motor
  customTestIds: ['data-qa-id'],
  customSynonyms: { actions: { comprar: 'Comprar ahora' } },
}
```

| Opción | Default | Qué hace |
|---|---|---|
| `healEnabled` | `true` | `false` reporta los fallos pero no propone correcciones. |
| `minConfidence` | `0.90` | Umbral de `healed`. Subilo para que `fix` sea más conservador. |
| `reviewConfidence` | `0.80` | Frontera `review` / `unresolved`. Nunca puede superar a `minConfidence`. |
| `maxAlternatives` | `3` | Alternativas además de la principal. |
| `customTestIds` | — | Atributos `data-*` propios del equipo, además de los 5 built-in. |
| `customSynonyms` | — | Acciones/campos propios, además de los diccionarios EN/ES. |

Las variables de entorno pisan el archivo — útil para un job de CI puntual, sin tocar el repo:

```bash
HEALIFY_HEAL_ENABLED=false npx playwright test
```

`HEALIFY_HEAL_ENABLED`, `HEALIFY_MIN_CONFIDENCE`, `HEALIFY_REVIEW_CONFIDENCE`, `HEALIFY_MAX_ALTERNATIVES`. Un valor que no parsea se ignora y queda lo del archivo.

---

## Reporte HTML

`healify-report.html` es un reporte visual interactivo (dark/light, 100% offline) con:

- Antes/después de cada selector curado
- Selector original vs sugerido con nivel de confianza
- Contexto del DOM y del fallo

También genera `healify-report.json` (datos estructurados), `healify-report.md` (para PRs) y `healify-audit.json` (trail completo de cada selector).

---

## 100% Local — Garantía

- Ningún dato sale de tu máquina: sin servidor, sin nube, sin tracking.
- Sin API key, sin cuenta, sin telemetría.
- La heurística es determinista: mismo input, mismo resultado.
- `healify ai` es opcional y también 100% local (Ollama corriendo en tu máquina).

---

## Stack

- **TypeScript 5** — todo el código.
- **Build**: `tsc` + `esbuild` (bundles por paquete).
- **Tests**: Vitest — 601 tests passing, 0 fails (43 archivos).
- **Lint/Format**: ESLint flat config + Prettier.
- **Node**: `>=18.0.0` (`.nvmrc` / `.node-version` = 20.18.0).
- **Monorepo**: pnpm/npm workspaces (7 paquetes).
- **Licencia**: MIT.

---

## Links

- Landing: https://healify-sigma.vercel.app
- npm: [`@healify/cli`](https://www.npmjs.com/package/@healify/cli), [`@healify/reporter-core`](https://www.npmjs.com/package/@healify/reporter-core), [`@healify/test-runner`](https://www.npmjs.com/package/@healify/test-runner), [`@healify/cypress-plugin`](https://www.npmjs.com/package/@healify/cypress-plugin), [`@healify/selenium-plugin`](https://www.npmjs.com/package/@healify/selenium-plugin), [`@healify/webdriverio-plugin`](https://www.npmjs.com/package/@healify/webdriverio-plugin), [`@healify/ai-local`](https://www.npmjs.com/package/@healify/ai-local)
- Release: [v1.5.0](https://github.com/mescobar996/Healify/releases)
- Repo: https://github.com/mescobar996/Healify

---

## Licencia

MIT. Ver [LICENSE](LICENSE). © 2026 Matías Escobar · Rosario, Argentina.

<div align="center">
  <img src="logo-healify.png" alt="Healify" width="120" />

  <h3>Un selector se rompe. Healify sabe por qué — y con qué reemplazarlo.<br/>Sin mandar una sola línea de tu código a ningún lado.</h3>

  <sub>601 tests · 0 dependencias en la GitHub Action · 0 bytes de tu DOM en un servidor ajeno</sub>

  <br/><br/>

  <a href="https://www.npmjs.com/package/@healify/cli"><img src="https://img.shields.io/npm/v/@healify/cli" alt="npm" /></a>
  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/tests-601%20passing-brightgreen" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/100%25%20local-true-blue" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" />
  <a href="https://healify-sigma.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-healify--sigma.vercel.app-blue" /></a>
</div>

---

## ¿Quién sos?

| | |
|---|---|
| **QA / Test Engineer** | Andá directo a [el reporte con evidencia](#reporte-html) — el que le mandás al equipo cuando algo se rompe. |
| **Dev integrando CI** | [30 segundos](#en-30-segundos) y listo, o la [GitHub Action](#github-action) si querés que comente solo en cada PR. |
| **Stakeholder evaluando esto** | [La comparación](#la-comparación) — por qué no hace falta pedirle presupuesto a nadie para usarlo. |
| **El que audita todo antes de aprobar una dependencia** | [Nada sale de tu máquina](#100-local--garantía) y la [firma verificable de cada release](#cadena-de-custodia). |

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

## El problema

Un botón cambió de `id` en el último deploy. No cambió nada del producto — cambió un atributo que nunca debió importar. Y aun así tu suite de 200 tests se pinta de rojo, alguien tiene que frenar lo que estaba haciendo, abrir el DOM a mano y encontrar la única línea que hay que tocar.

Eso no es un bug de tu app. Es un selector frágil. Y pasa todos los días.

**Healify** es un heal local de selectores rotos para **Playwright, Cypress, Selenium y WebdriverIO**. Cuando un test falla porque el selector ya no existe, Healify no adivina: mira el DOM real que capturó tu framework en el momento exacto del fallo, y te da el reemplazo estable, verificado contra esa evidencia — no contra lo que un modelo de lenguaje cree que probablemente esté ahí.

Sin IA generativa, sin nube, sin cuenta, sin API key, sin tracking. Heurística determinista, 100% en tu máquina: mismo input, mismo output, siempre.

---

## La comparación

Antes de escribir una línea, se investigaron 15 herramientas del rubro ([research completo acá](docs/research/competitive-gaps.md)). El patrón se repite: o pedís un backend, o pedís una cuenta en la nube, o le pedís a un LLM que adivine — y un LLM adivina distinto cada vez, aunque el input sea idéntico.

| | Healify | El resto del mercado |
|---|---|---|
| **Infraestructura** | Un `npx` | Docker + Postgres, o una cuenta en la nube |
| **Motor** | Heurística determinista — mismo input, mismo output | LLM (no determinista), o backend propietario que no podés auditar |
| **Qué sale de tu máquina** | Nada | El DOM de tu app, camino a un servidor de un tercero |
| **Código** | MIT, 100% open source, vive en tu repo | Cerrado, o SaaS con login |
| **Procedencia de cada release** | Firmada y trazable a un commit público ([Sigstore](https://search.sigstore.dev/?packageName=%40healify)) | — |
| **Costo** | Cero, para siempre | Backend a mantener, o suscripción |

No es que los demás estén mal hechos — Healenium, el referente del rubro, es sólido. Es que resuelve un problema distinto al que tenés vos: el tuyo no necesita una base de datos, necesita que alguien te diga "usá esto en vez de eso" antes de que termines el café.

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
| `healify report [reporte.json]` | Reporta los defectos de la corrida a tu Jira (o webhook). Dedupe por `defectId`, opt-in. |
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

## GitHub Action

Comenta los selectores rotos directo en la PR. Corre `doctor` + `fix --dry-run`: **nunca modifica archivos**.

```yaml
# .github/workflows/healify.yml
name: Healify
on: pull_request

permissions:
  contents: read
  pull-requests: write   # sin esto la API devuelve 403 al comentar

jobs:
  healify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright test
        continue-on-error: true   # queremos el reporte aunque la suite falle
      - uses: mescobar996/Healify@v1.6.0
```

Se referencia un tag exacto. `@v1` funciona como alias móvil de la última `1.x`, y ya está publicado.

| Input | Default | Qué hace |
|---|---|---|
| `github-token` | `${{ github.token }}` | Token para comentar. Necesita `pull-requests: write`. |
| `project-path` | `.` | Directorio donde correr Healify (monorepos). |

El comentario se **actualiza** en cada push en vez de apilar uno nuevo. Cero dependencias de runtime: la action habla con la API de GitHub por `fetch`, nada más.

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

## Reporte a herramientas ágiles

Cierra el loop "selector roto → ticket en Jira". Con la misma seriedad que **Cadena de custodia**, tres reglas que no se negocian:

1. **Opt-in, off por default.** Sin `agile.enabled: true` Healify nunca toca la red. El silencio no reporta nada.
2. **Tus credenciales contra TU instancia.** El token Jira lo ponés vos, se lee de config o de `JIRA_API_TOKEN` (para no commitearlo), y solo se usa para autenticarte contra **tu** Jira. Jamás se loguea, y nunca sale hacia ningún lado que no sea tu servidor.
3. **Cero datos fuera de tu máquina.** La única salida de datos cuando activás el reporte es el POST hacia **tu** Jira (o **tu** webhook). No hay nube de Healify, no hay API key nuestra, no hay tracking.

Config en `healify.config.js`:

```js
module.exports = {
  agile: {
    enabled: true,          // ← sin esto, nada se reporta
    provider: 'jira',       // 'jira' | 'webhook'
    baseUrl: 'https://tu-equipo.atlassian.net',
    email: 'qa@tu-equipo.com',
    apiToken: process.env.JIRA_API_TOKEN,   // o solo JIRA_API_TOKEN en el entorno
    project: 'QA',
    issueType: 'Bug',
    priorityBySeverity: { blocker: 'Highest', major: 'High', minor: 'Medium' },
    labels: ['healify'],
  },
}
```

| Opción | Default | Qué hace |
|---|---|---|
| `agile.enabled` | `false` | Activa el reporte. Sin esto, no-op. |
| `agile.provider` | `jira` | `jira` (REST Cloud) o `webhook` (Zapier/n8n/automatización Jira). |
| `agile.baseUrl` | — | Base de tu Jira Cloud, ej. `https://tu-equipo.atlassian.net`. |
| `agile.email` / `agile.apiToken` | — | Credenciales del usuario contra su instancia. |
| `agile.project` | — | Key del proyecto, ej. `QA`. |
| `agile.issueType` | `Bug` | Tipo de issue. |
| `agile.priorityBySeverity` | `blocker→Highest, major→High, minor→Medium` | Mapeo severidad→prioridad. |
| `agile.labels` | `[]` | Labels extra para el ticket. |
| `agile.webhookUrl` | — | URL del webhook (solo provider `webhook`). |

Env overrides para CI: `HEALIFY_AGILE_ENABLED`, `HEALIFY_AGILE_PROVIDER`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE`, `HEALIFY_WEBHOOK_URL`.

Reportá la última corrida:

```bash
healify report                 # reporta healify-report.json a tu Jira
healify report --dry-run       # qué se reportaría, sin tocar la red
```

**Cómo funciona y por qué no genera ruido.** Cada defecto lleva un `defectId` estable (`HLF-XXXXXXXX`, sha1 de archivo+selector): el mismo selector roto devuelve el mismo ID en cada corrida. Antes de crear un ticket, Healify pregunta a tu Jira (`text ~ "HLF-XXXXXXXX" AND project = QA`) si ese defecto ya existe: si existe, **no crea nada nuevo** (outcome `ya existía`); si no, crea el issue **y** agrega como comentario la sugerencia del selector. La sugerencia viaja como contexto del ticket — nunca reemplaza el hallazgo. Un 503 de tu Jira no pierde el reporte local: falla ese defecto, no la corrida.

Con `provider: 'webhook'`, Healify POSTea el payload JSON (defecto + sugerencia + entorno) a tu URL y es el receptor quien decide crear-o-actualizar — el patrón que la competencia ya estableció ("webhook → JQL lookup por clave estable → crear si no existe / comentar si existe").

---

## Reporte HTML

Esto es lo que un QA se lleva de acá: no un log de consola, un entregable.

`healify-report.html` es un reporte visual interactivo (dark/light, 100% offline) con:

- Antes/después de cada selector curado, con nivel de confianza
- **Verificado vs heurístico**: si la sugerencia se confrontó contra el DOM real de esa corrida (`verified: true`) o es una deducción sobre el texto del selector (`verified: false`) — nunca se presenta una adivinanza como un hecho
- Contexto del DOM y del mensaje de error original
- `defectId` estable (mismo selector roto, mismo archivo → mismo ID en cada corrida) y severidad, para cruzar contra tu tracker de bugs sin reinventar la rueda

También genera `healify-report.json` (datos estructurados para integrarlo a tu propio dashboard), `healify-report.md` (pegalo tal cual en una PR o un ticket) y `healify-audit.json` (el trail completo de cada selector, por si alguien pregunta "¿y esto de dónde salió?").

---

## 100% Local — Garantía

- Ningún dato sale de tu máquina: sin servidor, sin nube, sin tracking.
- Sin API key, sin cuenta, sin telemetría.
- La heurística es determinista: mismo input, mismo resultado.
- `healify ai` es opcional y también 100% local (Ollama corriendo en tu máquina).

---

## Cadena de custodia

Los 7 paquetes se publican con **[npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)**: no hay ningún token de por medio. npm autoriza cada `npm publish` verificando directamente contra el workflow de GitHub Actions que lo dispara — no hay secreto que se pueda filtrar, vencer, ni usar desde otro lado para publicar algo en nombre de `@healify`.

Cada versión queda firmada y anotada en el [transparency log público de Sigstore](https://search.sigstore.dev/?packageName=%40healify): podés verificar, para cualquier release, de qué commit exacto y de qué corrida de CI salió el tarball que estás instalando. Lo mismo que le pedís a Healify que haga con tus selectores — no confiar a ciegas, verificar contra la evidencia — se lo aplicamos a nosotros mismos.

---

## Stack

- **TypeScript 5** — todo el código.
- **Build**: `tsc` + `esbuild` (bundles por paquete).
- **Tests**: Vitest — 638 tests passing, 0 fails (46 archivos).
- **Lint/Format**: ESLint flat config + Prettier.
- **Node**: `>=18.0.0` para usar los paquetes (verificado en CI con un smoke que instala el tarball y corre el motor sobre Node 18). Para **desarrollar** hace falta `>=20`: Vitest 4 usa `styleText` de `node:util`, que no existe en 18.
- **Monorepo**: pnpm/npm workspaces (7 paquetes).
- **Licencia**: MIT.

---

## Links

- Landing: https://healify-sigma.vercel.app
- npm: [`@healify/cli`](https://www.npmjs.com/package/@healify/cli), [`@healify/reporter-core`](https://www.npmjs.com/package/@healify/reporter-core), [`@healify/test-runner`](https://www.npmjs.com/package/@healify/test-runner), [`@healify/cypress-plugin`](https://www.npmjs.com/package/@healify/cypress-plugin), [`@healify/selenium-plugin`](https://www.npmjs.com/package/@healify/selenium-plugin), [`@healify/webdriverio-plugin`](https://www.npmjs.com/package/@healify/webdriverio-plugin), [`@healify/ai-local`](https://www.npmjs.com/package/@healify/ai-local)
- Procedencia firmada de cada release: [Sigstore transparency log](https://search.sigstore.dev/?packageName=%40healify)
- Release: [v1.6.0](https://github.com/mescobar996/Healify/releases/tag/v1.6.0)
- Research de la competencia: [docs/research/competitive-gaps.md](docs/research/competitive-gaps.md)
- Repo: https://github.com/mescobar996/Healify

---

## Licencia

MIT. Ver [LICENSE](LICENSE). © 2026 Matías Escobar · Rosario, Argentina.

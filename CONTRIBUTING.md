# Contributing

Healify es un monorepo npm (workspaces) con motor heurístico, adaptadores por framework
y herramientas auxiliares. Esta guía cubre cómo instalar, desarrollar y añadir un nuevo
adaptador.

## Requisitos previos

- **Node.js 18+** (el monorepo declara `"node": ">=18.0.0"`).
- **npm** como gestor (es el que usa el repo; los locks son `package-lock.json`).

Instala todas las dependencias del monorepo desde la raíz:

```bash
npm install
```

> `node_modules` se resuelve de forma compartida gracias a los workspaces: no hace falta
> instalar nada por paquete.

## Comandos de desarrollo diarios

Desde la raíz del monorepo:

```bash
npm run build --workspaces   # compila todos los paquetes a dist/
npm test                     # ejecuta los tests unitarios de todos los workspaces
npm run coverage             # tests con cobertura y verificación de umbrales
npm run lint                 # ESLint sobre todo el repo
npm run format               # Prettier en modo escritura
```

### Coverage y umbrales anti-regresión

`npm run coverage` corre Vitest con el proveedor `v8` y falla si un paquete baja de su
umbral mínimo de líneas cubiertas. **Cada paquete tiene su propio umbral**, definido en
`scripts/coverage.sh` (Bash/CI) y su equivalente `scripts/coverage.ps1` (PowerShell/Windows):

- Los paquetes que ya superan el 80% exigen **80%**.
- Los que aún no llegan (cypress-plugin, cli, test-runner) quedan en **su nivel actual**:
  la regla es anti-regresión, no puede bajar de donde está hoy.

Si trabajás en un paquete, mantené su cobertura por encima del umbral. Si el paquete supera
el 80%, subí su umbral a 80 en ambos scripts.

> **Windows + WSL:** si `bash` del PATH resuelve a WSL (`C:\WINDOWS\system32\bash.exe`), los
> scripts detectan WSL en `/proc/version` y delegan automáticamente al equivalente
> PowerShell — mismos umbrales, mismo resumen. Con Git Bash corren el `.sh` directamente.

## Estructura del monorepo

El repo usa workspaces en la raíz (no hay carpeta `packages/`):

| Paquete | Rol |
|---|---|
| `reporter-core` | **El motor de healing**: heurística de selectores rotos, sondeo de DOM, repertorio y config compartida. Es privado (no se publica). |
| `cli` | **Interfaz de línea de comandos** (`healify fix`, `init`, `doctor`, `history`, `heal`, `probe-script`, `ai`). Expone el motor vía subproceso local. |
| `test-runner` | **Adapter para Playwright** (`@healify/test-runner`). |
| `cypress-plugin` | **Adapter para Cypress** (`@healify/cypress-plugin`). |
| `selenium-plugin` | **Adapter para Selenium** (`@healify/selenium-plugin`). |
| `webdriverio-plugin` | **Adapter para WebdriverIO** (`@healify/webdriverio-plugin`). |
| `ai-local` | IA local opcional vía Ollama (`@healify/ai-local`). |
| `mcp`, `dashboard-web` | Soporte: servidor MCP y dashboard de reportes. |

Los adaptadores se importan entre sí como `@healify/reporter-core`, que resuelve al `dist/`
del workspace — por eso **primero hay que buildear** (`npm run build`) antes de testear un
adapter desde cero. Para los adapters de referencia en Python/Java/C# ver `docs/adapters/`.

## Cómo añadir un nuevo adaptador

El contrato mínimo es integrar el motor de `reporter-core` con el framework objetivo:

1. **Convertir el selector del framework a algo que el motor entienda.** El motor de
   `reporter-core` entiende selectores CSS/XPath y la sintaxis de rol de Playwright
   (`role('button', { name: 'Comprar' })`). Tu adapter traduce su locator nativo
   (`By.id` → `#valor`, `cy.get` → CSS, `$` → CSS) antes de llamar al motor.
2. **Llamar al motor cuando un selector falle.** El punto de entrada es
   `analyzeAndHeal({ selector, htmlContext?, testName?, errorMessage?, testFile?, repertoire? })`
   en `reporter-core/src/healing-engine.ts`, que devuelve un `HealResponse` con el selector
   reparado (`fixedSelector`), la confianza (`confidence`) y si se verificó contra el DOM real
   (`verified`). Los adapters de runtime (Cypress, Selenium, WebdriverIO) además emiten
   eventos de tipo `PluginHealingEvent` y escriben `healify-report.json`/`healify-audit.json`
   con `buildAuditFromEvent`/`flushPlugin` de `reporter-core/src/plugin-helpers.ts`.
3. **Registrar el selector reparado en la forma nativa del framework.** El motor devuelve
   el selector en sintaxis estándar; tu adapter lo convierte de vuelta al locator del
   framework y lo usa para reintentar la acción.
4. **Exportar un reporter que se integre con el runner del framework.** P. ej. un
   `Reporter` de Playwright con `onTestEnd`, `afterEach` en Cypress, o un proxy sobre el
   driver en Selenium.

### Ejemplo basado en `test-runner` (el adapter de Playwright)

```ts
import { runLocalHealing, buildAuditEntry, type HealifyConfig } from '@healify/reporter-core'
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'

export default class HealifyReporter implements Reporter {
  private localResults = []

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return

    try {
      // El motor corrige el selector roto usando el DOM capturado en el fallo.
      const healResult = runLocalHealing({
        testName: test.titlePath().join(' > '),
        testFile: test.location.file,
        errorMessage: result.errors.map((e) => e.message).join('\n'),
      }, this.healifyConfig)
      this.localResults.push(healResult)

      if (healResult.healResponse) {
        this.auditEntries.push(buildAuditEntry(
          healResult.healResponse,
          { selector: healResult.selector, testName: test.title(), testFile: test.location.file },
          { errorMessage: result.error?.message }
        ))
      }
    } catch {
      // Nunca romper la corrida real por un fallo del healing local.
    }
  }

  onEnd(): void {
    // Escribe healify-report.html/json/md al final de la corrida.
  }
}
```

Patrones equivalentes a mirar antes de empezar: `test-runner/src/reporter.ts` (Playwright),
`cypress-plugin/src/plugin.ts` + `support.ts` (Cypress), `selenium-plugin/src/plugin.ts` y
`webdriverio-plugin/src/plugin.ts` (runtime con `PluginHealingEvent` + `flushPlugin`).

## Política de commits

Se usan **Conventional Commits**: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`,
`docs: ...`. El mensaje debe describir el cambio real, no el mecanismo.

El CI (`npm run build`, `npx tsc --noEmit` en los paquetes con tsconfig de type-check,
`npx eslint . --max-warnings=0` y `npm run coverage`) corre en cada PR y debe quedar en verde
antes de mergear.

## Enlaces útiles

- **Reportar vulnerabilidades**: ver [SECURITY.md](SECURITY.md) — no abras un issue público
  para fallos de seguridad.
- **Docs**: [`docs/`](docs/)
- **Adapters multi-lenguaje**: [`docs/adapters/`](docs/adapters/)

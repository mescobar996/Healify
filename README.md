<div align="center">
  <img src="logo-healify.png" alt="Healify" width="120" />
  <p><strong>Cuando un selector se rompe, Healify te dice cómo arreglarlo, sin salir de tu máquina.</strong></p>

  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Playwright-1.58-green?logo=playwright" />
  <img src="https://img.shields.io/badge/Cypress-15-green?logo=cypress" />
  <img src="https://img.shields.io/badge/Selenium-4-green?logo=selenium" />
  <img src="https://img.shields.io/badge/WebdriverIO-9-green?logo=webdriverio" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/tests-573%20passing-brightgreen" />
</div>

---

## En 30 segundos

```console
$ npx @healify/cli init          # detecta tu framework y configura
$ npx playwright test            # 1 failed — selector roto
$ npx @healify/cli fix           # aplica el fix
✓ e2e/checkout.spec.ts — #add-to-cart-btn → role('button', { name: 'Add' })
```

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Add' }).click()
```

Cada corrida genera `healify-report.html` (dark/light, interactivo, 100% offline).

---

## Qué es

**Healify** es un heal local y gratuito de selectores rotos para **Playwright, Cypress, Selenium y WebdriverIO**. Cuando un test falla porque un selector ya no existe, sondea el DOM real y propone un alternativo verificado contra la página.

| Feature | Detalle |
|---|---|
| **100% local** | Sin cuenta, API key, servidor ni internet |
| **Heurística + verificación** | No es IA, es determinista (la IA via Ollama es opcional) |
| **Multi-framework** | Playwright, Cypress, Selenium, WebdriverIO |
| **Multi-lenguaje** | Python/Java/C# via `healify heal` (JSON por stdin/stdout) |
| **Análisis de página real** | Verifica sugerencias contra DOM real cuando es posible |
| **Repertorio** | Recuerda curaciones exitosas entre corridas |
| **Auditoría** | Trail completo de cada selector curado |

---

## Quick Start

### Instalación

```bash
npm install --save-dev @healify/cli
```

### Configuración

```bash
npx @healify/cli doctor    # diagnostica tu proyecto
npx @healify/cli init      # instala y configura el paquete correcto
```

### Uso diario

```bash
# Correr tests normalmente (playwright, cypress, etc.)
npx playwright test

# Healify genera healify-report.json automáticamente
# Si hay selectores rotos, apply fixes:
npx @healify/cli fix

# Revisar qué se curó:
npx @healify/cli fix --dry-run
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `healify doctor` | Revisa tu proyecto y te dice qué falta (framework, config, paquetes) |
| `healify init` | Detecta tu framework e instala/configura todo automáticamente |
| `healify fix [--dry-run] [--force] [--pr] [--interactive]` | Aplica los selectores curados del reporte |
| `healify heal` | Motor de healing expuesto como JSON (para Python/Java/C# adapters) |
| `healify history` | Selectores recurrentes y selectores re-rotos |
| `healify ai setup/status/explain/chat/models` | IA local via Ollama (opcional) |

### Flags de `healify fix`

| Flag | Efecto |
|---|---|
| `--dry-run` | Muestra qué se curaría sin modificar archivos |
| `--force` | Aplica aunque el archivo tenga cambios sin commitear |
| `--pr` | Crea branch + commit + PR automáticamente (requiere `gh` CLI) |
| `--interactive` | Pregunta caso por caso antes de aplicar |
| `--no-ast` | No reescribe llamadas page.click → page.getByRole (sustitución simple) |

### Flags de `healify heal` (para adapters)

```bash
# Python
echo '{"testFile":"test.py","testName":"test_login","selector":"#old-btn","errorMessage":"..."}' | npx @healify/cli heal

# Respuesta JSON con el selector curado
{"fixedSelector":"[data-testid='login']","confidence":0.95,"verified":true,...}
```

---

## Frameworks

### Playwright (recomendado)

```bash
npm install --save-dev @healify/cli @healify/test-runner
npx @healify/cli init
```

Edita `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [['@healify/test-runner', {}]],
})
```

### Cypress

```bash
npm install --save-dev @healify/cypress-plugin
```

Edita `cypress.config.ts`:

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

```typescript
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'

const plugin = new HealifyWebdriverIOPlugin()
const wrappedBrowser = plugin.wrap(browser)

// Usar wrappedBrowser en vez de browser
await wrappedBrowser.$('#submit').click()
// Si #submit falla, Healify propone un alternativo

// Al final del test
plugin.flush()
```

---

## Arquitectura

```
Healify/
├── reporter-core/          # Core: healing engine, audit, reports
├── cli/                    # CLI: heal, fix, init, doctor, history
├── test-runner/            # Playwright reporter plugin
├── cypress-plugin/         # Cypress plugin
├── selenium-plugin/        # Selenium wrapper plugin
├── webdriverio-plugin/     # WebdriverIO wrapper plugin
├── ai-local/               # Ollama integration (optional)
├── integration-test/       # E2E tests
└── docs/                   # Documentation
```

### Flujo de Healing

```
1. Test falla con selector roto
   ↓
2. Framework reporta el error a Healify
   ↓
3. Healify extrae el selector del error
   ↓
4. Healify sondea el DOM real (si es posible)
   ↓
5. Motor heurístico analiza el selector:
   - Detecta tipo (TESTID, CSS, XPATH, ROLE, TEXT)
   - Evalúa robustez
   - Busca alternativas en el DOM
   - Verifica contra el árbol de accesibilidad
   ↓
6. Healify busca en el repertorio (curaciones previas verificadas)
   ↓
7. Genera sugerencia con confianza 0-1
   ↓
8. Aplica el fix (si --fix) o genera reporte
```

### Motor Heurístico

El motor analiza selectores usando:

| Tipo | Ejemplo | Detección |
|---|---|---|
| TESTID | `[data-testid="submit"]` | Alta confianza, estable |
| CSS con clase volátil | `.css-1x2y3z` | Frágil, propone alternativa |
| XPATH posicional | `/html/body/div[2]/div/button` | Frágil, propone role |
| ROLE | `getByRole('button', { name: 'Add' })` | Ya es moderno, preserva |
| TEXT | `getByText('Submit')` | Moderado, verificable |

### Personalización

Crea `healify.config.json` en la raíz de tu proyecto:

```json
{
  "customTestIds": ["data-cy", "data-e2e", "data-my-id"],
  "customSynonyms": {
    "actions": ["enviar", "publicar", "guardar"],
    "fields": ["correo", "contraseña"]
  }
}
```

---

## Multi-lenguaje

`healify heal` expone el motor como JSON por stdin/stdout. Cualquier lenguaje que pueda spawnear un subproceso puede usarlo.

### Python

```bash
pip install healify-selenium
```

```python
from healify_selenium import HealifySelenium

plugin = HealifySelenium(driver)
# Funciona igual que el wrapper nativo
```

### Java

```xml
<dependency>
    <groupId>io.github.mescobar996</groupId>
    <artifactId>healify-selenium</artifactId>
    <version>0.1.0</version>
</dependency>
```

### C#

Ver adapter de referencia en `docs/adapters/README.md`.

---

## IA Local (Opcional)

Healify soporta **IA local via Ollama** para explicaciones avanzadas:

```bash
cd docker && docker-compose up -d    # levanta Ollama + Open WebUI
npx @healify/cli ai setup            # detecta RAM, sugiere modelo
npx @healify/cli ai chat             # chat interactivo
npx @healify/cli ai explain "#btn"   # explica por qué es frágil
```

- 100% local, sin costo, auto-detección de RAM (deja 2GB de margen para el sistema)
- Modelos: phi3:mini (hasta 9GB), llama3.2:3b (10-17GB), llama3.1:8b (18GB+)
- Configuración: español/inglés

Docs: [docs/ai/README.md](docs/ai/README.md)

---

## Paquetes

| Paquete | Para qué | Instalar |
|---|---|---|
| `@healify/cli` | CLI — init, doctor, fix, heal, history | `npm i -D @healify/cli` |
| `@healify/test-runner` | Playwright — genera reporte al final | `npm i -D @healify/test-runner` |
| `@healify/cypress-plugin` | Cypress — reporte + `cy.healifyGet` en vivo | `npm i -D @healify/cypress-plugin` |
| `@healify/selenium-plugin` | Selenium — cura en vivo | `npm i -D @healify/selenium-plugin` |
| `@healify/webdriverio-plugin` | WebdriverIO — cura en vivo | `npm i -D @healify/webdriverio-plugin` |
| `@healify/ai-local` | IA local via Ollama | `npm i -D @healify/ai-local` |
| `healify-selenium` (PyPI) | Adapter Python | `pip install healify-selenium` |
| `healify-selenium` (Maven) | Adapter Java | `io.github.mescobar996:healify-selenium` |

---

## Desarrollo

### Requisitos

- Node.js >= 18
- npm >= 9

### Setup

```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
npm run build
```

### Tests

```bash
npx vitest run                               # Todos los tests (573)
npx vitest run --reporter=verbose            # Ver cada test individual
npx vitest run "cli/src/__tests__/"          # Tests de un paquete
```

### Build

```bash
npm run build                                # Build todos los paquetes
npm run build --workspace=reporter-core      # Build un paquete
```

### TypeScript Check

```bash
cd reporter-core && npx tsc --noEmit
cd cli && npx tsc --noEmit
cd selenium-plugin && npx tsc --noEmit
cd webdriverio-plugin && npx tsc --noEmit
```

---

## Reportes

Healify genera 3 tipos de reporte:

| Archivo | Contenido |
|---|---|
| `healify-report.html` | Reporte visual interactivo (dark/light mode) |
| `healify-report.json` | Datos estructurados para integración |
| `healify-report.md` | Reporte markdown para PRs/GitHub |
| `healify-audit.json` | Audit trail completo de cada selector |

---

## Seguridad

- **100% local** — Ningún dato sale de tu máquina
- **Sin secrets hardcodeados** — Validación en runtime via `scripts/validate-env.ts`
- **Path traversal protection** — `validatePath()` previene escritura fuera del proyecto
- **Targeted git add** — `healify fix --pr` solo commitea archivos modificados
- **.env en .gitignore** — Confirmado que nunca fue commiteado

### Rotación de Secrets

Si este proyecto tiene credenciales de producción, ver `ROTATE_SECRETS.md` para la guía completa de rotación de 18 credenciales.

---

## FAQ

### ¿Necesito internet para usar Healify?
No. Healify funciona 100% local. La única excepción es `healify ai` que necesita Ollama corriendo localmente.

### ¿Healify modifica mis tests?
Solo con `healify fix` (sin `--dry-run`). Con `--dry-run` solo muestra qué cambiaría. Healify nunca modifica tu código sin tu consentimiento.

### ¿Qué pasa si la sugerencia es mala?
El motor tiene un threshold de confianza (default 0.90). Selectores por debajo del threshold se marcan como "review" en vez de "applied". Si usás `--interactive`, Healify pregunta caso por caso.

### ¿Funciona con CI/CD?
Sí. `healify fix --pr` puede integrarse en pipelines para crear PRs automáticos. `healify heal` funciona como subproceso para cualquier lenguaje.

### ¿Soporta frameworks nuevos?
El motor es agnóstico. Agregar un nuevo framework requiere un adapter que capture los errores y los formatee como input para `healify heal`. Ver `docs/adapters/README.md`.

---

## Contributing

1. Fork el repo
2. Crear branch (`git checkout -b feature/nueva-feature`)
3. Hacer commit (`git commit -m 'feat: agregar nueva feature'`)
4. Push (`git push origin feature/nueva-feature`)
5. Abrir Pull Request

### Convenciones

- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`)
- **Tests**: Todo código nuevo debe tener tests. `npx vitest run` debe pasar.
- **TypeScript**: No usar `any`. Usar tipos explícitos.
- **Idioma**: Código y docs en español, tests en español.

---

## Licencia

MIT. Ver [LICENSE](LICENSE). © 2026 Matías Escobar

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
</div>

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

## Qué es

**Healify** es un heal local y gratuito de selectores rotos para **Playwright, Cypress, Selenium y WebdriverIO**. Cuando un test falla porque un selector ya no existe, sondea el DOM real y propone un alternativo verificado contra la página.

- **100% local** — sin cuenta, API key, servidor ni internet
- **Heurística + verificación** — no es IA, es determinista (la IA via Ollama es opcional)
- **Multi-lenguaje** — Python/Java vía `healify heal` (JSON por stdin/stdout)

## Empezar

```bash
npm install --save-dev @healify/cli
npx @healify/cli doctor    # diagnostica tu proyecto
npx @healify/cli init      # instala y configura el paquete correcto
# ... escribí tu primer test, corré tu framework ...
npx @healify/cli fix       # aplica los fixes de mayor confianza
```

Guía completa: [docs/guide/README.md](docs/guide/README.md)

## Comandos

| Comando | Qué hace |
|---|---|
| `healify doctor` | Revisa tu proyecto y te dice qué falta |
| `healify init` | Detecta tu framework e instala/configura todo |
| `healify fix [--dry-run\|--interactive]` | Aplica los selectores curados |
| `healify explain [selector] [--json]` | Explica por qué un selector es frágil |
| `healify history` | Selectores recurrentes y re-rotos |
| `healify heal` / `probe-script` | Puente JSON para Python/Java/C# |
| `healify ai setup\|status\|explain\|chat\|models` | IA local via Ollama (opcional) |

Detalle con ejemplos: [cli/README.md](cli/README.md)

## Frameworks

Playwright, Cypress, Selenium y WebdriverIO — todos sobre el mismo motor (`reporter-core`). Los cuatro verifican la sugerencia contra el DOM real; Cypress necesita `cy.healifyGet(selector)` (opt-in).

## Multi-lenguaje

`healify heal` expone el motor como JSON por stdin/stdout. **Python** (`pip install healify-selenium`) y **Java** (`io.github.mescobar996:healify-selenium:0.1.0`) son paquetes reales. **C#** es adapter de referencia. Contrato: [docs/adapters/README.md](docs/adapters/README.md).

## IA Local (Opcional)

Healify soporta **IA local via Ollama** para explicaciones en lenguaje natural:

```bash
cd docker && docker-compose up -d    # levanta Ollama + Open WebUI
npx @healify/cli ai setup            # detecta RAM, sugiere modelo
npx @healify/cli ai chat             # chat interactivo
```

- 100% local, sin costo, auto-detección de RAM (deja 2GB de margen para el sistema)
- Modelos: phi3:mini (hasta 9GB), llama3.2:3b (10-17GB), llama3.1:8b (18GB+)
- Configuración: español/inglés

Docs: [docs/ai/README.md](docs/ai/README.md)

## Paquetes

| Paquete | Para qué | Instalar |
|---|---|---|
| `@healify/cli` | CLI — init, doctor, fix, explain, history, heal, ai | `npm i -D @healify/cli` |
| `@healify/test-runner` | Playwright — genera reporte al final | `npm i -D @healify/test-runner` |
| `@healify/cypress-plugin` | Cypress — reporte + `cy.healifyGet` en vivo | `npm i -D @healify/cypress-plugin` |
| `@healify/selenium-plugin` | Selenium — cura en vivo | `npm i -D @healify/selenium-plugin` |
| `@healify/webdriverio-plugin` | WebdriverIO — cura en vivo | `npm i -D @healify/webdriverio-plugin` |
| `@healify/ai-local` | IA local via Ollama | `npm i -D @healify/ai-local` |
| `healify-selenium` (PyPI) | Adapter Python | `pip install healify-selenium` |
| `healify-ai` (PyPI) | IA local Python | `pip install healify-ai` |
| `healify-selenium` (Maven) | Adapter Java | `io.github.mescobar996:healify-selenium` |

## Estructura

```
reporter-core/        # Motor heurístico (privado)
test-runner/          # Playwright
cypress-plugin/       # Cypress
selenium-plugin/      # Selenium
webdriverio-plugin/   # WebdriverIO
cli/                  # CLI principal
ai-local/             # IA local via Ollama
docker/               # Ollama + Open WebUI
python/               # Paquetes Python
java/                 # Paquete Java
docs/                 # Guías y documentación
```

## Licencia

MIT. Ver [LICENSE](LICENSE). © 2026 Matías Escobar

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
  <img src="https://img.shields.io/badge/license-MIT-blue" />
</div>

## En 30 segundos (salida real, sin editar)

Tenés un test que hace `page.click('#add-to-cart-btn')`. Alguien renombró ese botón y el
test se rompe. Así se ve Healify curándolo, de punta a punta:

```console
$ npx @healify/cli init
✅ @healify/test-runner ya estaba instalado
✅ Config lista. Creá tu primer test con un selector de tu propia app.

$ npx playwright test
  1 failed
Healed: 1 | Review: 0 | Unresolved: 0        # ← Healify ya analizó el selector roto

$ npx @healify/cli fix
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

Cada corrida escribe `healify-report.html` (para vos), `.md` (para pegar en un ticket) y
`.json` (para otra herramienta o CI) — siempre, también cuando todos los tests pasan.
Cada uno arranca con veredicto **PASS/FAIL** y entorno (framework, navegador, sistema), y
cada defecto trae ID estable, severidad, resultado esperado/obtenido, pasos y evidencia —
solo lo que el framework realmente registró, nunca inventado. Detalle completo en la
[guía](docs/guide/README.md#el-reporte-html).

## Frameworks soportados

**Playwright, Cypress, Selenium y WebdriverIO**, todos sobre el mismo motor
(`reporter-core`). Los cuatro pueden **verificar la sugerencia contra el DOM real**, no
solo adivinar por texto — Playwright/Selenium/WebdriverIO lo hacen solos; Cypress necesita
`cy.healifyGet(selector)` (opt-in, ver [`cypress-plugin/README.md`](cypress-plugin/README.md))
porque no expone un gancho para envolver `cy.get()` sin pisar su retry-ability nativo.

## Y si tu equipo automatiza en otro lenguaje

`npx @healify/cli heal` expone el motor entero (heurística + verificación + repertorio)
como JSON por stdin/stdout — cualquier lenguaje que spawnee un subproceso lo usa.
**Python** (`pip install healify-selenium`) y **Java** (Maven,
`io.github.mescobar996:healify-selenium:0.1.0`) ya son paquetes reales y verificados.
**C#** es un adapter de referencia para copiar (sin paquete en NuGet todavía). Contrato
completo en [`docs/adapters/README.md`](docs/adapters/README.md).

## Para quién es esto

**Si sos QA Manual, QA Automation o QC Engineer y se te rompe un test porque cambió un ID, una clase o un texto, esto es para vos.** No necesitás saber programar, cuenta, API key, ni internet.

> **Qué NO es:** No es IA, no es un servicio en la nube, no manda tu código a ningún lado.
> Es heurística local — y, donde puede, la confronta contra el DOM real de la página en
> vez de solo adivinar por el texto del selector.

## Empezar

```bash
npm install --save-dev @healify/cli
npx @healify/cli doctor    # diagnostica tu proyecto
npx @healify/cli init      # instala y configura el paquete correcto
# ... escribí tu primer test, corré tu framework ...
npx @healify/cli fix       # aplica los fixes de mayor confianza
```

Guía completa paso a paso (con salida real de cada comando, cómo escribir el primer test,
instalación manual sin `init`, troubleshooting): **[docs/guide/README.md](docs/guide/README.md)**.

## Repertorio y modo interactivo

Cada curación **verificada contra la página real** se puede grabar en
`.healify/history.jsonl` y reusarse la próxima vez que ese selector se rompa, aunque esa
corrida no pueda verificar nada por su cuenta — es un respaldo, la verificación en vivo
siempre gana. Y en vez de aplicar todo automático, `npx @healify/cli fix --interactive`
te muestra cada sugerencia y te deja decidir caso por caso. Detalle en la
[guía](docs/guide/README.md#el-repertorio-memoria-entre-corridas).

## Paquetes

| Paquete | Versión | Para qué | Comando |
|---|---|---|---|
| [`@healify/test-runner`](test-runner/README.md) | 1.4.0 | Playwright - genera reporte al final | `npm i -D @healify/test-runner` |
| [`@healify/cypress-plugin`](cypress-plugin/README.md) | 1.4.0 | Cypress - reporte + `cy.healifyGet` opcional en vivo | `npm i -D @healify/cypress-plugin` |
| [`@healify/selenium-plugin`](selenium-plugin/README.md) | 1.4.0 | Selenium - cura en vivo, `flush()` genera reporte JSON | `npm i -D @healify/selenium-plugin` |
| [`@healify/webdriverio-plugin`](webdriverio-plugin/README.md) | 1.4.0 | WebdriverIO - cura en vivo, `flush()` genera reporte JSON | `npm i -D @healify/webdriverio-plugin` |
| [`@healify/cli`](cli/README.md) | 1.4.0 | CLI - diagnostica, configura, aplica fixes, guarda historial, y puentea `heal`/`probe-script` a otros lenguajes | `npm i -D @healify/cli` |
| `reporter-core` | 1.4.0 | Motor heurístico - privado, bundleado | — |
| [`healify-selenium`](python/healify-selenium/) (PyPI) | 0.1.0 | Adapter Python | `pip install healify-selenium` |
| [`healify-selenium`](java/healify-selenium/) (Maven Central) | 0.1.0 | Adapter Java | `io.github.mescobar996:healify-selenium` |

## Comandos del CLI

| Comando | Qué hace |
|---|---|
| `npx @healify/cli doctor` | Revisa tu proyecto y te dice qué falta |
| `npx @healify/cli init` | Detecta tu framework e instala/configura todo |
| `npx @healify/cli fix [--dry-run\|--interactive]` | Aplica (o simula, o te deja decidir) los selectores curados |
| `npx @healify/cli history` | Selectores recurrentes y re-rotos de tu historial local |
| `npx @healify/cli heal` / `probe-script` | Puente JSON para usar el motor desde otro lenguaje |

Detalle de cada uno, con ejemplos, en la [guía](docs/guide/README.md).

## Estructura

```
reporter-core/       # Motor heurístico (privado)
test-runner/         # @healify/test-runner
cypress-plugin/      # @healify/cypress-plugin - reporte + cy.healifyGet en vivo
selenium-plugin/     # @healify/selenium-plugin
webdriverio-plugin/  # @healify/webdriverio-plugin
cli/                 # @healify/cli - init, doctor, fix, history, heal, probe-script
gh-action/           # GitHub Action (privada, no es workspace de npm ni se publica)
python/healify-selenium/  # pip install healify-selenium — paquete real, verificado
java/healify-selenium/    # io.github.mescobar996:healify-selenium (Maven Central) — paquete real, verificado
docs/adapters/       # Solo C# como adapter de referencia (código para copiar, no paquete)
docs/guide/          # Manual completo: instalación paso a paso, cómo funciona el motor,
                      # repertorio, modo interactivo, troubleshooting, cobertura
```

## Historia

Antes fue un SaaS completo con dashboard, auth y billing. Se recortó a solo paquetes
locales porque el QA lo quiere en su PC, sin servidor ni cuenta. Ese código viejo vive en
la rama de git [`archive/saas-full`](https://github.com/mescobar996/Healify/tree/archive/saas-full)
(`git checkout archive/saas-full` para verlo) — no es una carpeta de la rama `main`.

## Licencia

MIT. Ver [LICENSE](LICENSE). © 2026 Matías Escobar

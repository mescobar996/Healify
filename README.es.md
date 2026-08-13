<div align="center">
  <img src="landing/public/logo-static.svg" alt="Logo de Healify" width="64" style="filter: drop-shadow(0 0 20px rgba(16,185,129,0.4))" />

  <h3>Healify repara selectores E2E rotos. Local y determinista.</h3>
  <p><strong>Playwright · Cypress · Selenium · WebdriverIO</strong></p>

  <img src="https://img.shields.io/badge/version-2.8.0-blue" alt="version 2.8.0" />
  <img src="https://img.shields.io/badge/tests-1164%20passing-brightgreen" alt="1164 tests passing" />
  <img src="https://img.shields.io/badge/coverage-93%25-brightgreen" alt="93% CLI coverage" />
  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" />

  <p>
    <a href="docs/"><strong>Docs</strong></a> ·
    <a href="examples/"><strong>Ejemplos</strong></a> ·
    <a href="https://healify-sigma.vercel.app"><strong>Demo</strong></a> ·
    <a href="README.md">English</a>
  </p>
</div>

---

## Qué hace

El `id` de un botón cambió en el último deploy. Tu suite queda en rojo. Healify lee la
evidencia de la página que tu framework de test ya capturó y te dice qué selector estable
usar en su lugar.

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Add to cart' }).click()
```

No adivina y no usa IA. Heurísticas deterministas, mismo input, mismo resultado, nada sale
de tu máquina. Cuando se niega a proponer un fix, lo dice y explica por qué.

El límite honesto, dicho de entrada: los selectores rotos explican más o menos un cuarto de
los fallos e2e. El resto es timing, datos de test y aserciones que fallan de verdad. Healify
los nombra en vez de "arreglarlos", porque una herramienta que cambia un selector para que
una aserción pase está escondiendo el bug que el test encontró. Eso es peor que un build rojo.

## Cómo se usa

Cinco pasos. La primera vez toma dos minutos.

**1. Instalalo una vez**

```bash
npm install -g @healify/cli
```

**2. Apuntalo a tu proyecto**

```bash
cd tu-proyecto
healify init
```

Detecta tu framework de tests (Playwright, Cypress, Selenium, WebdriverIO), instala el
adapter, conecta el config, agrega los scripts npm `healify` / `healify:dry` /
`healify:dashboard` y corre un chequeo con `healify doctor`. Nunca escribe tests.

**3. Corré tus tests**

```bash
npx playwright test   # Playwright
npx cypress run       # Cypress
npm test              # Selenium
npx wdio run          # WebdriverIO
```

No pasa nada hasta que un selector se rompe de verdad. Healify espera a que tu suite falle.

**4. Cuando un selector se rompa, sanalo**

```bash
npm run healify            # aplica el fix a tus archivos de test
npm run healify:dry        # muestra qué cambiaría, sin tocar nada
```

El reporte te dice qué selector se rompió, qué propone, con qué confianza, y si verificó el
fix contra la página real.

**5. Mirá lo que sanaste**

```bash
npm run healify:dashboard
```

Dashboard local con tu historial de curaciones, tasa de aceptación por framework y
selectores crónicos. Los datos no salen de tu máquina.

El recorrido completo, con cada comando explicado, está en la
[guía paso a paso](docs/guide/README.md).

## Qué incluye

- **CLI**: `fix`, `init`, `doctor`, `dashboard`, `history`, `heal`, `watch` → [docs/cli.es.md](docs/cli.es.md)
- **Adapters**: Playwright, Cypress, Selenium, WebdriverIO, más código de referencia para
  Python/Java/.NET → [docs/adapters](docs/adapters)
- **Dashboard**: estadísticas locales, eficacia, selectores crónicos → [docs/DASHBOARD.md](docs/DASHBOARD.md)
- **GitHub Action**: comenta PRs o abre PRs con fixes desde el log de tests → [docs/github-action.es.md](docs/github-action.es.md)
- **Tickets**: Jira, GitHub Issues y webhooks desde un selector roto → [docs/jira.es.md](docs/jira.es.md)
- **Servidor MCP**: responde preguntas de agentes de IA → [mcp/](mcp/)
- **Extensión de VS Code**: subraya selectores frágiles mientras escribís → [vscode-extension/](vscode-extension/)
- **IA local, opcional**: explicaciones en lenguaje natural vía Ollama → [docs/ai/](docs/ai/)

## Repositorio

Un monorepo npm con 9 workspaces `@healify/*`.

| Paquete | Rol |
|---|---|
| `reporter-core` | Motor de healing: heurísticas, sondeo DOM, repertorio. Privado, no se publica |
| `cli` | Interfaz de línea de comandos |
| `test-runner` | Adapter de Playwright |
| `cypress-plugin` | Adapter de Cypress |
| `selenium-plugin` | Adapter de Selenium |
| `webdriverio-plugin` | Adapter de WebdriverIO |
| `dashboard-web` | UI React del dashboard local |
| `ai-local` | IA local opcional vía Ollama |
| `mcp` | Servidor MCP para agentes de IA |

Calidad: 1,164 tests unitarios, todos en verde. El CI aplica umbrales de cobertura
anti-regresión: todo paquete arriba del 80% se queda ahí. Los números por paquete viven en
[docs/project-status.md](docs/project-status.md).

Un detalle antes de tocar código: los workspaces se importan como `@healify/reporter-core`,
que resuelve al `dist/` compilado. Corré `npm run build` primero después de un checkout.

## Por dónde empezar

- **[Documentación](docs/)** — instalación, comandos, configuración
- **[Ejemplos que corren](examples/)** — proyectos completos, verificados en CI con un browser real
- **[Contribuir](CONTRIBUTING.md)** — comandos de desarrollo, política de commits, cómo agregar un adapter
- **[Seguridad](SECURITY.md)** — cómo reportar una vulnerabilidad

---

<sub>
MIT · Cada release firmado y trazable a un commit público
(<a href="https://search.sigstore.dev/?packageName=%40healify">verificalo acá</a>) ·
© 2026 Matías Escobar, Rosario, Argentina
</sub>

<div align="center">
  <img src="public/logo-static.svg" alt="Logo de Healify" width="64" style="filter: drop-shadow(0 0 20px rgba(16,185,129,0.4))" />

  <h3>Repará tus tests E2E antes de que te enteres.</h3>
  <p><strong>Los tests E2E fallan por selectores rotos. Arreglarlos es tedioso y repetitivo.<br/>Healify lo hace por vos — local y determinista, sin que un solo dato salga de tu máquina.</strong></p>

  <img src="https://img.shields.io/badge/version-2.7.1-blue" alt="versión 2.7.1" />
  <img src="https://img.shields.io/badge/tests-1113%20passing-brightgreen" alt="1113 tests en verde" />
  <img src="https://img.shields.io/badge/coverage-91.8%25-brightgreen" alt="91.8% cobertura del CLI" />
  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/100%25%20local-true-blue" />

  <p>
    <a href="docs/"><strong>Documentación</strong></a> ·
    <a href="examples/"><strong>Ejemplos</strong></a> ·
    <a href="https://healify-sigma.vercel.app"><strong>Demo</strong></a> ·
    <a href="README.md">English</a>
  </p>
</div>

---

| 🧪 Tests | 📦 Paquetes | 🔒 Cobertura del CLI | ⚡ CI |
|---|---|---|---|
| **1,113** en verde | **9** workspaces `@healify/*` | **91.8%** de líneas | ✅ verde en main |

---

## Se arregla solo, antes de que lo mires

Un botón cambió de `id` en el último deploy. El producto no cambió — pero tu suite se pinta de
rojo y alguien frena lo que estaba haciendo para buscar a mano en el DOM. Ya no:

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Agregar al carrito' }).click()
```

Listo. Volvé a lo tuyo.

## Cinco razones para probarlo

| | Feature | Qué significa |
|---|---|---|
| 🔒 | **100% local** | Sin nube, sin cuenta, sin telemetría — nada sale de tu máquina |
| 🧠 | **Sin IA** | Heurística determinista: mismo input, mismo resultado, siempre |
| 🌐 | **Multi-framework** | Un motor para Playwright, Cypress, Selenium y WebdriverIO |
| 📊 | **Dashboard local** | Tus curaciones, historial y 🔥 selectores crónicos — `healify dashboard --serve` |
| ⚡ | **Listo para CI** | `healify fix --pr` abre un PR con los fixes ya aplicados |

## Probálo en 30 segundos

```bash
npm install -g @healify/cli
cd tu-proyecto
healify init     # detecta tu framework, configura todo y añade scripts npm
healify fix --pr
```

`healify init` añade tres scripts de conveniencia (`npm run healify`, `npm run healify:dry`,
`npm run healify:dashboard`), corre una verificación instantánea con `healify doctor` y
nunca genera tests — el primer selector que cura es uno de tu propia app. Para ver qué
haría sin tocar nada: `healify init --dry-run`.

---

## No adivina

Cuando tu test falla, tu framework ya guardó cómo estaba la página en ese momento exacto.
Healify lee **esa** evidencia: ahí había un botón cuyo nombre accesible era *"Agregar al
carrito"*. La sugerencia sale verificada contra lo que había de verdad en pantalla, no contra
lo que un modelo de lenguaje cree que probablemente estaba.

Por eso propone roles y nombres accesibles en vez de otro `id`: el `id` nuevo también va a
cambiar en el próximo deploy. El botón que dice "Agregar al carrito", no.

## Nada sale de tu máquina

Sin nube. Sin cuenta. Sin API key. Sin telemetría. Sin IA generativa.

El análisis corre entero donde vos estás, con heurística determinista: mismo input, mismo
resultado, siempre. Si trabajás con datos sensibles (banca, salud, gobierno) eso no es una
comodidad, es el único requisito que importa.

Por eso las únicas métricas que guarda Healify son **locales**: `heal --stats` acumula lo que
curó en `~/.healify/stats.json` e imprime un resumen — nada sale nunca de la máquina.

## Contra lo que hay hoy

Playwright ya trae su propio agente healer, y toda herramienta de testing vende "self-healing".
La etiqueta tapa cosas muy distintas, así que acá está dónde se para Healify:

| | Healify | El healer de Playwright | Healenium |
|---|---|---|---|
| **Cómo decide** | Heurística determinista, auditable | Un LLM, respuesta distinta cada vez | Similitud contra una base de datos |
| **Qué sale de tu máquina** | Nada | Tu DOM va a un modelo | Nada, pero necesita un servidor |
| **Para empezar** | Un `npx` | Una API key y presupuesto | Docker + Postgres |
| **Cuándo se niega** | Lo dice, y por qué | Casi nunca: va a proponer algo | Con score de similitud bajo |
| **Costo** | Cero, para siempre | Por token, para siempre | Infraestructura |

**El límite, dicho de frente:** los selectores rotos explican alrededor de un cuarto de los
fallos de un e2e. El resto es timing, datos de prueba, errores de runtime y aserciones que fallan
de verdad. Healify nombra ese cuarto y se niega con el resto en vez de adivinar — una herramienta
que "arregla" una aserción fallida cambiando el selector hace pasar el test tapando el bug que
acababa de encontrar. Eso es peor que un build en rojo.

Healenium está muy bien hecho y resuelve otro problema: el tuyo no necesita una base de datos,
necesita que alguien te diga "usá esto" antes de que se te enfríe el café.

<sub>Antes de escribir una línea se investigaron 15 herramientas del rubro
([el análisis completo](docs/research/competitive-gaps.md)).</sub>

## Funciona donde ya estás

**Playwright · Cypress · Selenium · WebdriverIO**

Incluso donde cuesta: dentro de web components con shadow DOM, en iframes, y cuando el selector
vive en un page object y no en el test.

## Te abre el ticket

Un build en rojo que nadie triangula es un build en rojo que nadie arregla. Healify convierte
cada selector roto en un **ticket de Jira o un issue de GitHub**, con la evidencia, los pasos,
el entorno, y el selector que propone en su lugar.

```bash
npx healify report --dry-run   # qué se reportaría exactamente, sin tocar la red
```

El mismo selector roto nunca abre dos tickets: cada defecto lleva un id estable, y Healify
comenta en el que ya existe en vez de crear otro. Opt-in y apagado por default: tus
credenciales, tu instancia, sin ninguna nube nuestra en el medio.

**[→ Jira, GitHub Issues y webhooks](docs/jira.es.md)**

## Y arregla la PR antes de que la mires

Hay una [GitHub Action](docs/github-action.es.md). En cada PR corre `doctor` y el fix en dry-run,
y deja un comentario con qué se rompió y qué cambiaría — sin permisos de bot, sin "all clear"
cuando en realidad no corrió nada.

Para `workflow_dispatch` (manual) y `schedule` (diario) va más lejos: lee el log de tus tests
fallidos, cura cada selector roto y abre una **PR con los fixes ya aplicados**. ¿Le preocupa no
poder parsear tu log? Lo dice y para — jamás inventa una curación que no pueda respaldar con
evidencia.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: mescobar996/Healify@v2
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      test-log-path: test-output.log   # workflow_dispatch/schedule: log -> PR
```

**[→ Referencia completa de la action](docs/github-action.es.md) · [→ ejemplo auto-PR](examples/github-action-auto-pr/)**

## Y funciona en tu editor

Hay una [extensión de VS Code](vscode-extension/). Los selectores frágiles quedan subrayados
mientras escribís. Los que se rompieron de verdad traen un fix verificado con `Ctrl+.`

Los dos niveles son distintos a propósito. Antes de correr nada, Healify puede decirte que un
selector es frágil, pero no te propone reemplazo: sin ver la página, cualquier nombre concreto
sería inventado. Después de una corrida sabe que el elemento existe y cómo se llama, así que el
fix es real y aplicarlo es una tecla.

## Y tu agente le puede preguntar

Hay un [servidor MCP](mcp/). Apuntá Claude, Cursor o cualquier cliente MCP a tu proyecto de tests
y puede preguntar si un selector es frágil, por qué falló un test, y cuáles se vienen rompiendo
siempre. Responde en la sintaxis del framework que estés usando (`framework: playwright | cypress
| selenium | webdriverio`), y `healify_batch_analyze_selectors` cura una página entera de
locators rotos de una vez — con resultados cacheados localmente por 5 minutos, para que un agente
que martilla sobre los mismos selectores no los recompute.

```json
{ "mcpServers": { "healify": { "command": "npx", "args": ["-y", "@healify/mcp"] } } }
```

Es el complemento del MCP de Playwright, no su reemplazo. Ese le da a un agente un browser real.
La falla documentada de los agentes haciendo eso es el exceso de confianza: clickear lo primero
que matchea, inventar lo que no pueden ver. Healify contesta determinista, desde evidencia que ya
está en disco, y dice cuándo no sabe — incluido negarse a nombrar un reemplazo que no verificó
contra una página real.

## Y ves el cuadro completo

`healify dashboard --serve` levanta un servidor local con el dashboard interactivo de Healify,
mostrando las estadísticas acumuladas y el historial de selectores rotos — todo con datos que
nunca salen de tu máquina.

```bash
healify dashboard --serve                 # puerto 5173 por defecto
healify dashboard --serve --port 8080     # otro puerto
healify dashboard --serve --open          # abre el navegador automáticamente
```

Lo que muestra:

- **Agregados de `~/.healify/stats.json`**: total analizados, curados, fallas, por tipo,
  tiempo medio.
- **Historial de `.healify/history.jsonl`**: selectores recurrentes, re-rotos, tendencia diaria.
  Una sección dedicada **🔥 Selectores Crónicos** lista cada selector que se rompió 3 o más veces,
  y una insignia roja **Crónico** los marca en la lista principal de selectores.
- **🎯 Eficacia** (nuevo): cuántos fixes se aceptan de verdad. Un donut de aceptados vs
  rechazados vs sin confirmar (`healify confirm`), la tasa de aceptación por framework
  (Playwright, Cypress, Selenium, WebdriverIO — las entradas viejas se agrupan en "unknown"),
  una tendencia de 7/30 días y el desglose por causa de fallo ("Selector roto", "Aserción",
  "Timing / espera", …).
- **API JSON**: (opcional) hay endpoints `GET /api/stats`, `GET /api/selectors`,
  `GET /api/selectors/:id`. `/api/stats` también acepta `?efficacy-window=7|30` para ajustar
  la ventana de la tendencia de eficacia.
- **UI React**: se sirve desde `dashboard-web/dist` si existe; si no, el servidor igual sirve
  la API y una página de fallback.

![Dashboard local de Healify — métricas y 🔥 Selectores Crónicos](landing/report-screenshot.png)

Requiere Node 20+.

**[→ Referencia completa del dashboard](docs/DASHBOARD.md)**

## El repositorio

Healify es un monorepo npm con 9 workspaces, cada uno un paquete `@healify/*`:

| Paquete | Rol |
|---|---|
| `reporter-core` | El motor de healing — heurística, sondeo de DOM, repertorio y config compartida (privado, no se publica) |
| `cli` | La interfaz de línea de comandos (`fix`, `init`, `doctor`, `history`, `heal`, `probe-script`, `ai`) |
| `test-runner` | Adapter de Playwright |
| `cypress-plugin` | Adapter de Cypress |
| `selenium-plugin` | Adapter de Selenium |
| `webdriverio-plugin` | Adapter de WebdriverIO |
| `dashboard-web` | UI React del dashboard local |
| `ai-local` | IA local opcional vía Ollama |
| `mcp` | Servidor MCP para agentes de IA |

**Madurez:** 1113 tests unitarios, todos pasando. El CI corre coverage con **umbrales
anti-regresión** definidos en `scripts/coverage.sh` (Bash) y `scripts/coverage.ps1`
(PowerShell): todo paquete que ya supera 80% exige 80% (test-runner conserva su piso en 79).
Cobertura de líneas actual por paquete: `reporter-core` 93.4%, `selenium-plugin` 98.8%,
`webdriverio-plugin` 87.6%, `cli` 91.8%, `cypress-plugin` 94.8%, `test-runner` 79.5%.

Un detalle a tener en cuenta antes de tocar código: los workspaces se importan entre sí como
`@healify/reporter-core`, que resuelve al `dist/` compilado — así que corré `npm run build`
antes de testear un adapter desde cero.

**[→ Guía para contribuir](CONTRIBUTING.md)** · instalación, comandos de desarrollo, política de commits y cómo añadir un adapter nuevo.

---

<div align="center">

### Empezá acá

**[Documentación](docs/)** · instalación, comandos, configuración

**[Ejemplos que se corren](examples/)** · proyectos completos, verificados en CI contra un browser real

**[Seguridad](SECURITY.md)** · cómo reportar una vulnerabilidad

**[Demo](https://healify-sigma.vercel.app)**

</div>

---

<sub>
MIT · Cada release firmado y trazable a un commit público
(<a href="https://search.sigstore.dev/?packageName=%40healify">verificalo acá</a>) ·
© 2026 Matías Escobar, Rosario, Argentina
</sub>

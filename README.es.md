<div align="center">
  <img src="logo-healify.png" alt="Healify" width="110" />

  <h3>Tus tests se rompieron. No cambió nada del producto.</h3>
  <p><strong>Healify encuentra el selector nuevo y te lo arregla.<br/>Sin mandar una sola línea de tu código a ningún lado.</strong></p>

  <a href="https://www.npmjs.com/package/@healify/cli"><img src="https://img.shields.io/npm/v/@healify/cli" alt="npm" /></a>
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

Un botón cambió de `id` en el último deploy. No cambió el producto, cambió un atributo que nunca
debió importar. Y aun así tu suite se pinta de rojo, alguien frena lo que estaba haciendo, abre
el DOM a mano y busca la única línea que hay que tocar.

Eso no es un bug. Es un selector frágil. Y pasa todos los días.

```bash
npx @healify/cli@latest fix
```

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Agregar al carrito' }).click()
```

Listo. Volvé a lo tuyo.

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
- **Historial de `.healify/history.jsonl`**: selectores recurrentes, re-rotos, crónicos
  (3+ roturas), tendencia diaria.
- **API JSON**: (opcional) hay endpoints `GET /api/stats`, `GET /api/selectors`,
  `GET /api/selectors/:id`.
- **UI React**: se sirve desde `dashboard-web/dist` si existe; si no, el servidor igual sirve
  la API y una página de fallback.

Requiere Node 20+.

**[→ Referencia completa del dashboard](docs/DASHBOARD.md)**

---

<div align="center">

### Empezá acá

**[Documentación](docs/)** · instalación, comandos, configuración

**[Ejemplos que se corren](examples/)** · proyectos completos, verificados en CI contra un browser real

**[Demo](https://healify-sigma.vercel.app)**

</div>

---

<sub>
MIT · Cada release firmado y trazable a un commit público
(<a href="https://search.sigstore.dev/?packageName=%40healify">verificalo acá</a>) ·
© 2026 Matías Escobar, Rosario, Argentina
</sub>

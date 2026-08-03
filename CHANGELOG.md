# Changelog

## Java en Maven Central (fuera del ciclo de versión npm)

> Tampoco toca ningún paquete npm — `io.github.mescobar996:healify-selenium` tiene su propio
> versionado en Maven Central (`0.1.0`), independiente de Healify.

- **`healify-selenium` publicado en Maven Central** (`java/healify-selenium/`), coordenadas
  `io.github.mescobar996:healify-selenium:0.1.0`. El adapter Java deja de ser solo un
  archivo de referencia para copiar y pasa a ser una dependencia real de Maven.
- Camino completo hecho de cero, sin nada preexistente: cuenta en el Central Publisher
  Portal, namespace `io.github.mescobar996` verificado (repo público en GitHub con el
  Verification Key como nombre), clave GPG 4096-bit generada y publicada a un keyserver,
  `pom.xml` con jars de sources/javadoc/firma GPG/`central-publishing-maven-plugin`, Maven
  instalado de forma permanente (Chocolatey) para que el usuario pueda repetir el proceso a
  futuro.
- **Dos bugs reales encontrados y arreglados en el camino** (ninguno del código de Healify,
  ambos de la herramienta): el GPG que trae Git para Windows depende de un demonio
  (`keyboxd`) pensado para correr dentro de git-bash — desde PowerShell nativo fallaba con
  `No Keybox daemon running`; se resolvió instalando Gpg4win (el GPG estándar de Windows,
  con `gpg-agent` propio). El plugin `central-publishing-maven-plugin` 0.7.0 no reconoce un
  campo nuevo (`warnings`) que la API de Sonatype ahora devuelve al consultar el estado del
  deployment — el `mvn deploy` fallaba en ese paso, pero el upload en sí ya había terminado
  bien; se resolvió publicando manualmente desde la web del Central Portal.
- Verificado real contra el registro: `repo1.maven.org` devuelve `200` para el `.pom` y el
  `.jar` del paquete publicado.
- **`healify-selenium` en PyPI** (`python/healify-selenium/`): el adapter de Python deja de
  ser solo un archivo de referencia para copiar y pasa a ser un paquete instalable
  (`pip install healify-selenium`), con `pyproject.toml`, licencia MIT y README propios.
  Verificado de punta a punta con el wheel real: construido (`python -m build`, pasa
  `twine check`), instalado en un venv limpio, y corrido contra Chrome real con Selenium
  4.46 — mismo resultado que el adapter de referencia (`verified: true`, click ejecutado).
  C# sigue siendo adapter de referencia (código para copiar), no paquete en NuGet — eso
  sigue siendo un compromiso de mantenimiento aparte, no asumido.
- **Adapter C# verificado de punta a punta, por primera vez**: con un .NET 8 SDK portable
  (zip, sin instalar nada en el sistema) + Selenium.WebDriver 4.27 vía NuGet + Chrome real.
  Un selector roto a propósito se curó en vivo y se verificó contra la página
  (`verified: true`, `confidence: 0.97`).
- **Bug real encontrado y arreglado en esa verificación**: `RunProcess` invocaba `npx.cmd`
  directo como `FileName` con `UseShellExecute=false` — a diferencia de una terminal real,
  `Process.Start` de .NET en Windows no lo asocia con un intérprete solo, y termina en un
  `MODULE_NOT_FOUND` interno de npm apenas se corre así. Arreglado invocando `cmd.exe /c npx
  ...` explícito, el patrón estándar de .NET para lanzar batch scripts sin una shell real.

## 1.7.0 — 2026-08-03

Cierra el gap G18 del análisis competitivo (`docs/research/competitive-gaps.md`): el loop
"selector roto → ticket en Jira". 638 tests (46 archivos), 0 warnings de lint.

### Reporte a herramientas ágiles

- **feat(core): `reportDefects`** — orquestador en `reporter-core/src/agile.ts` que traduce cada
  `LocalCaseResult` a un defecto y lo reporta a Jira o a un webhook. **Opt-in, off por default**:
  sin `agile.enabled: true` no hace ningún fetch. Mismo estándar que "Cadena de custodia": las
  credenciales son del usuario contra su instancia, la única salida de datos es el POST hacia su
  Jira/webhook, y el token jamás se loguea.
- **feat(core): dedupe por `defectId`.** Cada defecto lleva el `defectId` estable de Healify
  (`HLF-XXXXXXXX`, sha1 de archivo+selector) en el título y la descripción. Antes de crear,
  Healify pregunta a tu Jira (`text ~ "HLF-XXXXXXXX" AND project = QA`); si el defecto ya existe,
  no crea nada (`existing`), que es lo que elimina el ruido de tickets duplicados que la
  investigación de campo encontró en todos los equipos QA.
- **feat(core): la sugerencia viaja como comentario del ticket, nunca reemplaza el hallazgo.** El
  issue se crea con expected/actual/pasos/selector/evidencia/entorno, y la sugerencia
  (fixedSelector + confidence + verified + explanation + alternativas) se agrega como comentario
  — contexto, no reemplazo. Un 503 de tu Jira falla ese defecto, no la corrida: el reporte local
  nunca se pierde por un error de red.
- **feat(core): `createJiraClient`** (`reporter-core/src/jira.ts`) — cliente mínimo de la API
  Cloud v3 con `fetch` puro (cero deps, patrón `gh-action/github-api.js`): Basic auth
  `base64(email:token)`, `searchByDefectId` con JQL escapado, `createIssue`, `addComment`. Un
  no-2xx tira error con status + snippet del cuerpo (el de Jira explica permisos).
- **feat(core): provider `webhook`** (`reporter-core/src/webhook.ts`) — `postJson` POSTea el
  payload JSON y el receptor decide crear-o-actualizar, el patrón que la competencia ya
  estableció ("webhook → JQL lookup por clave estable → crear si no existe / comentar si existe").
- **feat(config): bloque `agile`** — `enabled`, `provider` (`jira`|`webhook`), `baseUrl`,
  `email`, `apiToken`, `project`, `issueType`, `priorityBySeverity` (blocker→Highest, major→High,
  minor→Medium, pisable), `labels`, `webhookUrl`. Env overrides para CI sin commitear secretos:
  `HEALIFY_AGILE_ENABLED`, `HEALIFY_AGILE_PROVIDER`, `JIRA_BASE_URL`, `JIRA_EMAIL`,
  `JIRA_API_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE`, `HEALIFY_WEBHOOK_URL`.
- **feat(cli): `healify report [reporte.json] [--dry-run]`** — cierra el loop desde la terminal.
  `--dry-run` imprime qué se reportaría sin tocar la red. Sin config `agile`, avisa que está
  desactivado y no hace nada.

## 1.6.0 — 2026-08-03

Tres features nuevas salidas de un gap analysis contra 15 proyectos del rubro
(`docs/research/competitive-gaps.md`), más el hardening de release. 601 tests (43 archivos),
0 warnings de lint.

### Motor

- **feat(probe): shadow DOM abierto e iframes same-origin.** `BROWSER_PROBE_SCRIPT` hacía un
  `document.querySelectorAll` plano, que no ve nada dentro de un `shadowRoot` ni de un iframe.
  En una app hecha con web components (Salesforce Lightning, Ionic, Lit, Vaadin) devolvía lista
  vacía y el motor degradaba **en silencio** a la heurística a ciegas: toda sugerencia salía
  `verified: false` justo donde más falta hacía la evidencia. Afectaba a 3 de los 4 adapters
  (Selenium, WebdriverIO, Cypress); Playwright no lo sufre porque su snapshot ya pierce shadow
  DOM. Ahora el scan es recursivo, con topes duros (`MAX_DEPTH=12`, `MAX_NODES=3000`) y los
  iframes cross-origin envueltos en `try/catch` para que uno de ads no mate el scan entero.
- **feat(core): `PageElement.frame`.** Lo que vive dentro de un iframe se marca como tal: un
  locator a nivel top no lo encuentra, hay que entrar al frame primero. La sugerencia sigue
  saliendo (es la mejor pista que hay) pero con confianza 0.88 y diciendo explícitamente que
  falta el `frameLocator()` / `switchTo().frame()`. El shadow DOM **no** se marca: es el mismo
  contexto de locator. `bestElementFor`/`bestNameFor` hacen dos pasadas — el documento principal
  siempre le gana al iframe.

### CLI

- **feat(fix): fallback a page objects.** `fix()` buscaba el selector solo en `case.testFile`.
  En cualquier proyecto con Page Object Model —la arquitectura estándar de e2e— el selector vive
  en `pages/login.page.ts`, así que el **100%** de las curaciones se reportaba como
  `saltado: ya no se encontró en el archivo`. Ahora, cuando no está en el spec, se busca en el
  resto del código del proyecto con un walker propio (sin `glob`, sin dependencias nuevas),
  determinista y con topes duros. Conservador con el mismo criterio de siempre: aplica solo si
  hay **un** archivo con **una** ocurrencia; con dos candidatos reporta ambiguo. `outcome.appliedIn`
  dice en qué archivo se tocó. Flag `--no-pom` para el comportamiento anterior.
  - Limitación conocida: `fix-ast` (la reescritura `page.click` → `page.getByRole`) sigue mirando
    solo el spec, porque el call site vive ahí aunque el string esté en el page object.

### Configuración

- **feat(config): umbrales configurables.** `healEnabled`, `minConfidence`, `reviewConfidence` y
  `maxAlternatives` — los equivalentes de `heal-enabled`, `score-cap` y `recovery-tries` de
  `healenium.properties`. Antes el 0.90 que decide si `fix` puede tocar un archivo era una
  constante de módulo.
- **feat(config): `healify.config.js` / `.cjs`** (CommonJS, carga síncrona con `createRequire`
  para que sirva igual en el bundle ESM y en el CJS). Un `.js` que resulte ser ESM se captura y
  cae al siguiente candidato en vez de romper la corrida de tests.
- **feat(config): overrides por entorno.** `HEALIFY_HEAL_ENABLED`, `HEALIFY_MIN_CONFIDENCE`,
  `HEALIFY_REVIEW_CONFIDENCE`, `HEALIFY_MAX_ALTERNATIVES` pisan el archivo — el análogo del
  `-Dheal-enabled=false` de Healenium para un job de CI puntual. Un valor que no parsea se ignora.
- **fix(core): la config del proyecto ahora llega al reporte.** `loadConfig()` solo lo llamaba
  `explain`; los adapters usan `runLocalHealing()`, que nunca la recibía. O sea que
  `customTestIds` y `customSynonyms`, documentados como config del proyecto, **no tenían ningún
  efecto sobre el reporte real**. Bug silencioso, no feature faltante. Playwright y Cypress ahora
  la cargan una vez por corrida y se la pasan al motor.

### GitHub Action

- **fix(gh-action): la action nunca podía arrancar.** `run.js` hacía
  `await import('@octokit/action')` con un comentario que decía "bundled with the action runtime",
  pero no estaba bundleada ni `gh-action/node_modules` versionado — y una action `node20` ejecuta
  `main` directo, GitHub no corre `npm install`. La primera PR real que la usara moría con
  `ERR_MODULE_NOT_FOUND`. Se reemplazó por un cliente de ~60 líneas sobre `fetch`: la action pasa
  a tener **cero dependencias de runtime**, en línea con el resto del proyecto.
- **fix(gh-action): paginación de comentarios.** Se leía solo la primera página (100): en una PR
  larga no encontraba su propio comentario y publicaba uno nuevo en cada push.
- **feat(gh-action): publicable en el Marketplace.** `action.yml` se movió a la raíz del repo
  (requisito de GitHub para publicar; el código sigue en `gh-action/`). Se documentó el uso y el
  permiso `pull-requests: write` en el README.
- Errores de la API ahora incluyen el detalle que devuelve GitHub — sin eso, un permiso faltante
  se veía como un 403 pelado.

### CI / release

- **CI: matriz de Node 18/20/22** en Ubuntu y Windows. `engines` prometía `>=18` sin que nadie lo
  corriera; 22 además es donde cambia el `require()` de ESM, que es justo lo que hace el loader de
  `healify.config.js`.
- **CI: job de lint** con `--max-warnings=0`. "0 warnings" era una propiedad prometida sin nada que
  la sostuviera en CI.
- **Release con npm provenance** (`.github/workflows/release.yml`): npm firma de forma verificable
  desde qué commit y qué workflow salió cada tarball. Requiere `repository.url` en cada
  `package.json` — agregado en los 7 paquetes, junto con `homepage` y `bugs`.

## 1.5.0 — 2026-07-31

- **feat(cli): `healify explain <selector>`** — explica por qué un selector es frágil, su
  clasificación (TESTID/ROLE/CSS/XPATH), confidence, issue detectado y fix propuesto. Reusa
  100% `analyzeAndHeal()` de `healing-engine.ts`. Sin args, lee el último caso de
  `healify-report.json`. Flag `--json` para output machine-readable (puente Python/Java/C#).
- **feat(core): `customTestIds` configurable** — via `healify.config.json`
  (`{ "customTestIds": ["data-cy-custom"] }`) o `package.json` (`{ "healify": { ... } }`).
  Se mergea con los 5 defaults (`data-testid`, `data-cy`, `data-qa`, `data-test`,
  `data-e2e`). Solo acepta atributos que empiecen con `data-`; los demás se descartan
  silenciosamente. Disponible también vía el puente `healify heal` (JSON stdin).
- **nuevo: `reporter-core/src/config.ts`** — `loadConfig(cwd)` lee `healify.config.json` o
  `package.json → healify`, valida y retorna `HealifyConfig`.
- **tests: 475 (+16)** — 6 en `healing-engine.test.ts` (customTestIds), 2 en
  `heal-command.test.ts` (paso de customTestIds), 8 en `explain-command.test.ts` (nuevo).

## 1.4.0 — combinadores CSS compuestos

Último hueco documentado como "fuera de alcance a propósito": el motor no reconocía
selectores con combinador (`.padre > .hijo`, `.card .title`, `div + span`) como un patrón
propio — dependen de la relación exacta entre dos elementos en el DOM, no solo del elemento
buscado, y se rompen con un wrapper nuevo o un reordenamiento de hermanos aunque el elemento
buscado no haya cambiado en nada.

- **Detección** (`hasCompoundCombinator`): marca el selector como frágil y explica por qué —
  antes, un selector así sin keyword de acción reconocible (`.card .price`) quedaba con
  `detectedIssue: "Selector pattern analysis"`, un placeholder sin información real.
- **Bug real arreglado — el fallback roto para selectores compuestos sin keyword**: sin
  ninguna estrategia aplicable, el motor caía a `visible=${selector.replace(/[.#]/, '')}` —
  sin flag `/g`, solo recorta el PRIMER `.`/`#` de todo el selector. Para `.card .price` eso
  daba `visible=card .price`, ni CSS válido. Ahora se propone conservar solo el elemento
  objetivo (`extractCombinatorTarget`, el último segmento después del combinador más a la
  derecha): `.card .price` → `.price`, `.sidebar > .username` → `.username`.
- **Bug real arreglado — testid del ancestro en vez del objetivo**: con dos testids
  compuestos (`[data-testid="product-card"] [data-testid="add-to-cart-btn"]`),
  `extractTestid()` (sin `/g`) tomaba el primer match de todo el string — el del ancestro,
  no el del elemento que el selector busca en definitiva. Ahora extrae el testid del target.
- **Sin falsos positivos**: un espacio adentro de `has-text('Add to cart')` o del valor de un
  atributo (`[aria-label="Cerrar sesión"]`) no se confunde con un combinador descendiente
  (`maskQuotedContent` enmascara el contenido entre comillas antes de buscar el combinador,
  preservando índices para no perder el segmento objetivo real).
- **Sin cambio de comportamiento donde ya andaba bien**: selectores compuestos con un keyword
  de acción reconocible (`form.checkout > button.submit` → sigue proponiendo
  `role('button', { name: 'Submit' })`) o con posición (`nth-child`/`nth-of-type`, que ya
  tenía su propio fallback) no cambian de resultado — verificado con el snapshot de 37
  selectores (antes 34) del corpus de heurística.
- 12 tests nuevos (3 snapshot + 9 unitarios), **203 tests** en `reporter-core` (antes 191),
  **459 en total** en los 6 workspaces.

## 1.3.0 — Cypress en vivo + multi-lenguaje

### Cypress: curado en vivo contra el DOM real

Cypress era el único de los cuatro frameworks soportados sin verificación contra el DOM real:
solo un reporter pasivo, heurística sobre el texto del error, post-hoc. La razón: Cypress no
expone un gancho para envolver `cy.get()` sin pisar su propio motor de retry-ability, a
diferencia de Selenium/WebdriverIO (que exponen `findElement`/`$` directo) — hacía falta un
comando nuevo, no un wrap del existente.

- **`cy.healifyGet(selector, options?)`** (`@healify/cypress-plugin/support`, nuevo entry
  point): como `cy.get()`, pero si el selector no aparece dentro del timeout, sondea el DOM
  real vía `BROWSER_PROBE_SCRIPT` (mismo script que Selenium/WebdriverIO, corrido en la
  ventana de la app bajo test, no en la del test-runner de Cypress — un error real encontrado
  en la verificación: `new Function()` a secas corre en el scope global equivocado), pide una
  curación verificada a Healify y reintenta con la sugerencia (CSS o XPath) antes de fallar.
  Opciones: `timeout` (default: `defaultCommandTimeout`), `confidenceThreshold` (default 0.9,
  igual que selenium-plugin/webdriverio-plugin).
- **Puente browser↔Node vía `cy.task`**: Cypress corre el spec en el browser y el motor
  (`analyzeAndHeal`, repertorio) en Node — dos procesos separados, a diferencia de
  Selenium/WebdriverIO donde ambos viven en el mismo proceso. `plugin.ts` registra
  `healify:probe-script` (devuelve el script), `healify:heal` (corre el motor, consulta) y
  `healify:record-event` (recibe el resultado del retry ya resuelto en el browser). El caso
  vivo se suma al mismo `healify-report.json` que el modo reporte, aunque el test haya
  **pasado** (Cypress nunca lo ve como fallido: se curó antes de llegar a fallar).
- Verificado real: Cypress 15 + Chrome headless contra una página HTML servida en local — un
  selector roto a propósito curado y clickeado de punta a punta (`verified: true` en el
  reporte), y un selector genuinamente irrecuperable fallando limpio sin romper la corrida.

### Multi-lenguaje: `healify heal`

Hasta acá Healify era JS/TS puro. Un equipo que automatiza con pytest+Selenium (Python) o
JUnit+Selenium (Java) no podía usarlo. El motor mismo es agnóstico (recibe un string, devuelve
un string) — lo único atado a Node era cómo se lo invocaba.

- **`healify heal`** (nuevo comando): el motor entero — heurística, verificación contra la
  página, repertorio — expuesto como JSON por stdin/stdout. Cualquier lenguaje que pueda
  spawnear un subproceso lo usa, sin reescribir nada. Devuelve un `locator` ya resuelto
  (`{ strategy: 'css'|'xpath'|'unsupported', value }`) — el cliente no necesita entender la
  sintaxis `role(...)` de Playwright.
- **`healify probe-script`** (nuevo comando): imprime el script JS que hay que correr con el
  `execute_script`/equivalente de cualquier driver para sondear el DOM — el mismo que ya usan
  los plugins de Selenium/WebdriverIO en JS, reusado tal cual.
- **El repertorio se consulta del lado del servidor**: `heal` lee `.healify/history.jsonl` en
  cada invocación. Si dos lenguajes corren contra el mismo repo (ej. Playwright en JS y
  pytest en Python), comparten repertorio — una curación verificada en un lenguaje resuelve
  un selector roto en el otro, verificado real con el binario: una entrada grabada a mano
  (simulando un adapter de Python) fue reusada por una segunda llamada a `heal` sin DOM,
  marcando `fromRepertoire: true`, y una tercera llamada con `testFile` distinto correctamente
  NO la reusó.
- **Adapters de referencia** (no paquetes publicados — código para copiar y adaptar, ver
  `docs/adapters/`):
  - **Python** (`docs/adapters/python/healify_selenium.py`): verificado de punta a punta con
    Selenium 4.46 y Chrome real (Selenium Manager). Encontró y corrigió un bug real de
    portabilidad: `subprocess.run(["npx", ...])` sin `shell=True` no resuelve `npx.cmd` en
    Windows (`[WinError 2]`) — se resuelve con `shutil.which`.
  - **Java** (`docs/adapters/java/HealifySeleniumWrapper.java`): compila real contra
    selenium-java 4.27 (resuelto con una Maven portable, sin instalar nada). El puente a
    `healify heal` (subproceso + parseo del JSON real) se verificó de punta a punta. El
    `ChromeDriver` en vivo no se pudo correr en esta sesión por un bug de red del JDK 17 de
    esta máquina (`java.net.http` roto para cualquier uso, confirmado con un repro de 4
    líneas sin Selenium de por medio) — no es un defecto de Selenium ni de Healify.
  - **C#** (`docs/adapters/csharp/HealifySeleniumWrapper.cs`): **sin verificar** — no hay SDK
    de .NET en esta máquina. Marcado explícito en el propio archivo.
- Dedup: `resolveLocatorStrategy` (reporter-core) reemplaza la lógica que vivía duplicada e
  inline en `selenium-plugin`/`webdriverio-plugin` para convertir `role(...)` a XPath — ahora
  la comparten esos dos plugins JS y el comando `heal`. Cero cambio de comportamiento
  (verificado: sus 39 + 28 tests no se movieron).

## 1.2.0 — repertorio consultable + modo interactivo

Los dos huecos que quedaban del pedido original: memoria entre corridas, y que el
desarrollador pueda decidir caso por caso en vez de todo-o-nada.

- **Repertorio**: `.healify/history.jsonl` ahora se **consulta**, no solo se escribe. Cuando
  una corrida no puede verificar nada por su cuenta (Cypress, siempre; o cualquier adapter si
  el snapshot/sondeo no estuvo disponible esa vez), el motor busca si ese mismo selector, en
  el mismo archivo, ya se curó y **se confirmó contra la página real** en una corrida
  anterior — y reusa esa corrección en vez de volver a adivinar a ciegas.
  - Solo cuentan las entradas `verified: true`. Reusar una curación a ciegas no aporta nada
    (la heurística es determinística, recalcularla da lo mismo) — el valor real está en
    cargar hacia adelante una confirmación que sí costó algo conseguir.
  - La verificación en vivo de la corrida actual **siempre gana** sobre el repertorio: la
    página de ahora es más confiable que la memoria de una corrida vieja.
  - Verificado con Playwright real: un selector se curó y verificó, quedó en el historial con
    `verified: true`; en una segunda corrida **sin** snapshot (`PLAYWRIGHT_NO_COPY_PROMPT=1`),
    el motor reusó esa misma corrección marcando `fromRepertoire: true`.
- **`fix --interactive`**: en vez de aplicar todo lo que supera el umbral automático, muestra
  cada sugerencia (selector, propuesta, confianza, si está verificada o viene del repertorio)
  y pregunta. Ofrece también los casos `review` (80-89%, hoy invisibles para `fix`) — el
  desarrollador puede aplicar algo de menor confianza si decide que tiene sentido, cosa que
  antes no existía en ningún lado. `a` aplica el resto sin seguir preguntando, `q` corta y deja
  el resto sin tocar. Sin terminal real (CI, pipe) avisa y sigue en modo automático — nunca se
  cuelga esperando un input que no puede llegar.
- Dedup: el parseo de `.healify/history.jsonl` vivía duplicado en el motor conceptualmente —
  ahora `parseHistoryLines`/`readRepertoire` viven en `reporter-core` y `cli` los reusa.

### Selenium y WebdriverIO también verifican contra la página real

El bloque anterior le dio a Playwright acceso al árbol de accesibilidad real (el archivo que
Playwright ya escribe al fallar un test). Selenium y WebdriverIO se quedaron afuera porque no
tienen ese archivo — pero tienen algo mejor: el browser vivo en la mano, en el momento exacto
del fallo. `driver.executeScript()`/`browser.execute()` permiten consultar el DOM real ahí
mismo, sin depender de que ningún framework les regale nada.

- **Sondeo del DOM en vivo** (`reporter-core/src/browser-probe.ts`): script JS plano que corre
  dentro del browser, recorre los elementos interactivos y calcula rol + nombre accesible con
  el mismo criterio en toda la escalera (aria-label → texto visible → placeholder → value).
- **Las sugerencias de rol ahora se pueden aplicar**: Selenium/WebdriverIO no interpretan
  `role('button', { name: 'Comprar' })` (es sintaxis de Playwright), así que antes se
  descartaban siempre. Ahora se convierten a un XPath real
  (`reporter-core/src/role-locator.ts`) que busca por el mismo criterio de nombre — el mismo
  elemento que originó la sugerencia.
- **Verificado con Chrome real, no solo con mocks**: usando `selenium-webdriver` con Selenium
  Manager (detecta el Chrome instalado solo, sin configuración) y `webdriverio` conectado
  directo al chromedriver que Selenium Manager resolvió. Los tres roles principales (botón,
  link, campo de texto) curados de punta a punta contra un browser de verdad.
- **Bug real encontrado en esa verificación — WebdriverIO 9.x nunca curaba en la práctica**:
  el detector de "elemento no encontrado" buscaba el wording viejo (`"element not found"`);
  el mensaje real de wdio 9.x es `"...because element wasn't found"` (distinto), así que el
  healing nunca se disparaba con esta versión, aunque los tests con mocks (que usaban el
  wording viejo) pasaran igual. No es algo que este bloque haya introducido — estaba roto
  desde antes y solo se vio al probar contra un driver real.
- Dedup: `parseRoleSuggestion` (antes duplicado dentro de `healing-engine.ts`) ahora vive en
  `role-locator.ts` y lo comparten el motor y los dos plugins.

### El motor mira la página real

Hasta acá el motor recibía un string y devolvía otro, adivinando nombres por diccionario: de
ahí salían sugerencias como `role('link', { name: 'Submit' })` para un `<a>` cualquiera, sin
ninguna evidencia de que ese texto existiera. Sobre un corpus de 34 selectores realistas, los
únicos arreglos que `fix` llegaba a aplicar eran casos que ya estaban bien.

Playwright, resulta, ya guarda el árbol de accesibilidad de la página cada vez que un test
falla (`error-context.md`). Estaba ahí, en disco, sin usar.

- **Las sugerencias se confrontan contra la página**: si el motor propone un rol y un nombre
  que no existen en pantalla, la sugerencia se descarta en vez de ofrecerse.
- **Los nombres se leen de la página, no se deducen**: un `#comprar-ahora-a1b2c3` roto ahora
  resuelve a `role('button', { name: 'Comprar' })` con el texto real del botón. La confianza
  sube a 97% y, a diferencia de antes, está justificada.
- **Marca `verificada` en los tres formatos**: el reporte distingue lo comprobado contra la
  página de lo deducido del texto del selector. El usuario tiene derecho a saber cuál está
  leyendo.
- **Si nada coincide, se dice**: cuando ninguna sugerencia sobrevive el contraste, el reporte
  avisa que el elemento puede haber desaparecido — el defecto no es el selector, es la
  funcionalidad. Para un QA eso vale más que un candidato inventado.
- **`fix` reescribe `role(...)` por defecto**: `page.click('#x')` pasa a
  `page.getByRole('button', { name: 'Comprar' }).click()`. La reescritura ya existía pero
  estaba detrás de `--ast`, marcada como experimental, así que en la práctica casi nada se
  aplicaba. Se puede desactivar con `--no-ast`; `--ast` se sigue aceptando y no hace nada.
- Sin dependencias nuevas y sin cambiar cómo se escriben los tests: el dato ya estaba, solo
  había que leerlo. Sigue sin haber IA, red ni servidor.

**Verificado de punta a punta, por primera vez**: un test que fallaba por un selector roto,
arreglado solo por `fix`, vuelve a correr y **pasa**. Hasta ahora nunca se había comprobado
que un arreglo aplicado por Healify dejara el test en verde.

Por ahora solo Playwright. Cypress, Selenium y WebdriverIO siguen con la heurística a ciegas
y lo dicen en el reporte.

### El reporte pasa a ser un entregable de QA

El reporte servía para ver selectores rotos, pero no como entregable: no tenía veredicto, ni
severidad, ni entorno, ni evidencia. Y había un agujero — si todos los tests pasaban no se
generaba ningún archivo, así que no había forma de distinguir "salió todo bien" de "no se
corrió nada".

- **Veredicto PASS/FAIL** y **el reporte se escribe siempre**, también con la suite entera en
  verde. Sale del resultado real de la corrida, no de cuántos selectores curó Healify.
- **`healify-report.md` nuevo**: reporte de defectos en Markdown, listo para pegar en un
  ticket o en un informe, con un bloque por defecto ordenado de más grave a menos grave.
- **ID de defecto estable** (`HLF-A1B2C3`): el mismo selector roto en el mismo archivo da
  siempre el mismo ID, en cualquier máquina. Es el cimiento para reconocer defectos repetidos
  contra el historial más adelante.
- **Severidad** derivada del estado con una regla fija: sin sugerencia es bloqueante, a
  revisar es mayor, sanado es menor.
- **Resultado esperado vs. obtenido, pasos para reproducir y evidencia**: los pasos salen de
  los que Playwright registró de verdad y la evidencia enlaza al screenshot que el framework
  ya escribió en disco. Nada se inventa: el adapter que no tiene un dato lo omite.
- **Entorno** en el reporte: framework y versión, navegador, URL base, sistema, Node y
  duración.
- **Bug encontrado verificando con Playwright real**: la ubicación del test se guardaba como
  ruta absoluta, así que el reporte filtraba la estructura de carpetas de quien lo corría y
  —peor— el ID de defecto no coincidía entre dos personas del mismo equipo. Ahora es relativa
  al proyecto.
- **Bug en el plugin de Cypress**: `after:run` no siempre recibe resultados; leerlos sin
  chequear hacía que el reporte no se escribiera nunca en esos modos.
- `fix` sobre una corrida limpia ahora dice "ningún selector roto en la última corrida" en vez
  de un escueto "0 aplicados · 0 salteados".

### `init` te muestra cómo escribir el primer test

Después de `init`, correr `npx playwright test` daba `No tests found`: correcto (Healify
nunca genera tests), pero el mensaje decía "escribí tu primer test en `e2e/`" sin mostrar
cómo, asumiendo una sintaxis que el público objetivo declarado del proyecto no tiene por
qué saber.

- **`init` ahora imprime un snippet mínimo y real**, ajustado al proyecto: `.ts` o `.js`
  según tengas TypeScript, y `require` en vez de `import` si tu `package.json` es CommonJS
  — antes el mensaje pedía un archivo `.ts` incluso en proyectos donde acababa de
  scaffoldear un `playwright.config.js`. Sigue sin escribir ningún archivo: el selector es
  un placeholder explícito (`#reemplazar-por-tu-selector-real`) que el usuario tiene que
  cambiar por uno de su propia app.
- **`FrameworkInitResult` expone `ext` y `moduleType`**, la misma forma del proyecto que se
  usó para scaffoldear, para que el mensaje final no pueda contradecir lo que se escribió.
- **READMEs**: sección "Tu primer test, paso a paso" con el snippet, qué hace cada línea,
  cómo sacar un selector real con DevTools, y la aclaración de correr el framework que ya
  se detectó (probar Cypress en un proyecto Playwright-only falla por falta de Cypress, no
  por Healify).

## 1.1.1 — red de seguridad de tests + fix de tipos en WebdriverIO

> Solo `@healify/webdriverio-plugin` sube a 1.1.1: es el único paquete cuyo código cambió.
> Los otros cuatro siguen en 1.1.0 — `reporter-core` (que se bundlea dentro de todos) no se
> tocó, así que republicarlos no cambiaría un solo byte.

- **Snapshot de la heurística** (`reporter-core/src/__tests__/heuristic-corpus.test.ts`): 34
  selectores reales (IDs generados por frameworks, clases hasheadas de CSS-in-JS, XPath de
  grabadores, los cinco atributos testid, posicionales, locators modernos de Playwright)
  congelan la salida completa de `analyzeAndHeal()`. Cualquier retoque de estrategias o
  prioridades rompe el snapshot y obliga a revisar el diff antes de aceptarlo, en vez de
  cambiar el comportamiento del motor sin que nadie lo note.
- **Los scaffolds ahora se compilan de verdad**
  (`cli/src/__tests__/scaffold-compiles.test.ts`): cada archivo que `init` escribe en el
  proyecto del usuario se vuelca a un directorio temporal y pasa por `tsc --noEmit` contra
  las dependencias reales. Antes solo se comparaban strings, así que un import roto o un
  tipo inválido pasaba desapercibido.
- **Bug real que encontró ese test — `HealifyWebdriverIOPlugin.wrap()` no aceptaba un
  browser de WebdriverIO**: `wrap(browser: Record<string, unknown>)` rechazaba
  `WebdriverIO.Browser` (interfaz sin index signature), o sea que el ejemplo generado por
  `init` no compilaba en un proyecto real. Ahora la firma es genérica
  (`wrap<T extends object>(browser: T): T`), que además le conserva al usuario el tipado y
  el autocompletado de su propio browser.

## 1.1.0 — auditoría Tech Lead (correcciones + deuda técnica)

Ronda de correcciones sobre el código real tras una auditoría tipo Tech Lead (revisión de
`reporter-core`, adapters, CLI y el spec de historial). Nada de esto es feature nueva:
son bugs reales, deduplicación y ampliación de cobertura sobre lo que ya existía.

- **Bug real arreglado — `init` scaffoldeaba Selenium para proyectos WebdriverIO**:
  `cli/src/scaffold.ts` no tenía un scaffold propio para WebdriverIO; `scaffoldFilesFor()`
  caía por fallback implícito al ejemplo de Selenium (imports de `selenium-webdriver` en un
  proyecto que usa `webdriverio`). Ahora `scaffoldWebdriverio()` genera su propio archivo de
  referencia (`healify.wdio.example.ts`), `init.ts` distingue explícitamente cada framework
  sin fallback implícito, y el prompt interactivo (`prompt.ts`) ya ofrece `webdriverio` como
  opción.
- **Deduplicación en `reporter-core`**: `buildLocalRunFromEvents()` e
  `isPlaywrightOnlySelector()` (antes duplicadas casi 1:1 en `selenium-plugin` y
  `webdriverio-plugin`) se movieron a `reporter-core` y ambos adapters las reusan. Sin
  cambio de comportamiento observable — refactor puro, mismos tests en verde.
- **Heurística ampliada**: `analyzeAndHeal()` reconoce ahora las convenciones de testid
  `data-qa`/`data-test`/`data-e2e` (antes solo `data-testid`/`data-cy`), y detecta
  selectores basados en posición (`nth-child`/`nth-of-type`) como frágiles, proponiendo un
  `role()` genérico en vez de dejarlos caer al fallback ciego — sigue siendo pattern-matching
  sobre el texto del selector, sin tocar DOM real.
- **UX del CLI mejorada**: `doctor` explica el gotcha de semver caret con un ejemplo
  numérico concreto; `fix` distingue `EACCES`/`EPERM` (permisos denegados, archivo abierto
  en otro proceso) del error técnico genérico; `init` ya no confunde "no pude verificar el
  puerto en este entorno" con "puerto libre" al no tener PowerShell disponible.
- **Feature #8 (reporte histórico) documentada como IMPLEMENTADA**: el spec quedó
  desactualizado como "pendiente" cuando el código (`cli/src/history.ts`,
  `cli/src/commands/history.ts`, `appendHistory()` en `runFix()`) ya estaba en el repo.
  Riesgos de concurrencia (escritura simultánea al `.jsonl`) y de línea corrupta por
  escritura interrumpida quedan documentados y asumidos por diseño MVP — sin locks, hasta
  que haya evidencia real de que hace falta.

Verificado con `npm run verify`: 258 tests en verde en los 6 workspaces.

**Limpieza documental**: se borraron 13 archivos `.md` de planes/specs/logs de auditoría
de features ya implementadas (`docs/superpowers/plans/`, `docs/superpowers/specs/`,
`docs/audit-0.4.1.md`, `docs/audit-0.5.0.md`) y el `HANDOFF.md` de la raíz (duplicaba
`CONTEXT_HANDOFF.md`). Solo quedan README/CHANGELOG/CONTEXT_HANDOFF/CLAUDE.md y el manual
de usuario en `docs/guide/`.

## 1.0.0 — Primera versión estable

Los 6 paquetes (`reporter-core`, `test-runner`, `cypress-plugin`, `selenium-plugin`,
`webdriverio-plugin`, `cli`) pasan a 1.0.0 juntos. No es una feature nueva: es la
declaración de que la superficie pública está estable y el producto es presentable de
punta a punta. Lo que entró en esta versión, todo encontrado o pulido probando la
herramienta como la usaría un tercero:

**Arreglos de UX (evitan la mala primera impresión):**
- `healify --version` / `-v`: antes no había forma de que un usuario chequee qué versión
  tiene. Es justo el gap que hace que alguien con una versión vieja instalada (el pozo del
  caret `^0.x`, que no sube de minor con un `npm install` a secas) no se dé cuenta y vea
  comportamiento viejo. Ahora `healify --version` lo dice.
- `fix` sin `healify-report.json`: antes tiraba el `ENOENT` crudo de Node + exit 1. Pero un
  `fix` sin reporte no es un error: es lo normal cuando los tests pasaron (ningún selector
  roto). Ahora da un mensaje que explica qué hacer y sale con exit 0 (no rompe pipelines).
  JSON corrupto sigue siendo error real (exit 1).

**Presentación (lo que ve alguien que evalúa el repo):**
- Badge de tests estático "238 verdes" (mentía si un test fallaba) reemplazado por el badge
  real de GitHub Actions. Badges de WebdriverIO, coverage (~85% real) y MIT agregados.
- Demo "En 30 segundos" en el README con salida REAL capturada (init → test rompe →
  `fix --ast` reescribe el archivo), no inventada. Reporte HTML real navegable en
  `docs/ejemplos/`.
- Coverage medido de verdad (`@vitest/coverage-v8` + `npm run coverage`), con tabla honesta
  por paquete en el README (motor `reporter-core` ~90%; adapters más finos).

**Rigor de CI:**
- Tests corren en Ubuntu Y Windows (Healify es sensible a Windows: puertos, PowerShell,
  `.cmd` de npm). `typecheck` cubre `webdriverio-plugin`. Nuevos jobs: `gh-action` (sus
  tests no corrían en CI por no ser workspace) y `coverage`.

**Higiene de release público:**
- Archivo `LICENSE` MIT real (antes el README lo declaraba pero el archivo no existía).
- README: la mención a `archive/saas-full` ahora aclara que es una RAMA de git, no una
  carpeta de `main` (un evaluador buscaba la carpeta y no la encontraba).

Verificado con `npm run verify` (los 6 workspaces en verde), `npm audit` (0
vulnerabilidades) y un smoke real instalando desde npm contra un browser real.

## 0.7.1 (test-runner) — bug crítico real: Playwright timeouts nunca curaban

Encontrado probando de verdad contra el paquete publicado (`@healify/test-runner@0.7.0`
instalado desde npm, no desde el workspace local), con un test real que rompe un botón
real en un navegador real. No es un caso hipotético: es el fallo más común en cualquier
suite de Playwright real (un `click()`/`fill()` que nunca encuentra el elemento y hace
timeoutear el test entero).

**El bug**: cuando el test entero timeoutea (no una excepción explícita del propio
`click()`), Playwright reporta el fallo en DOS entradas de `result.errors`: la primera es
el mensaje genérico `"Test timeout of 30000ms exceeded."` (sin selector), y la segunda
tiene el detalle real (`page.click: ... Call log: - waiting for locator('#x')`).
`test-runner/src/reporter.ts` solo miraba `result.error`/`result.errors[0]`, que en este
caso concreto (probablemente el más frecuente en la práctica) es siempre el mensaje corto
sin selector. Resultado: el caso quedaba `unresolved` con `"Unknown selector"`, aunque el
motor heurístico hubiera podido curarlo sin problema si hubiera recibido el mensaje
correcto.

Ninguno de los tests existentes lo detectó porque todos fabricaban un `result` sintético
donde el mensaje útil ya estaba en el primer lugar que el código miraba, nunca
reproduciendo la forma real del objeto que devuelve Playwright.

**Fix**: `reporter.ts` ahora concatena todos los mensajes de `result.errors[]` (no solo
el primero) antes de pasarlos a `extractSelectorFromError`, así encuentra el selector sin
importar en cuál entrada esté. +1 test que reproduce el shape real (dos errores, selector
en el segundo) → 9 tests en test-runner. Verificado con una corrida real de Playwright
contra un selector roto de verdad, antes y después del fix.

Cypress-plugin se probó en paralelo con el mismo método (instalación real desde npm,
selector roto real, navegador real) y no tiene este problema: `test.displayError` de
Cypress ya trae el mensaje completo en un solo campo, así que la extracción funciona
desde la primera versión. `selenium-plugin`/`webdriverio-plugin`/`cli` no se probaron con
este mismo nivel de rigor en esta pasada (sí tienen sus propios tests unitarios y, en el
caso de `cli`, verificación con el binario real compilado, pero no una instalación real
desde npm contra un browser real como se hizo acá).

## 0.8.0 — Feature #8: historial de curaciones (MVP)

`healify fix` (sin `--dry-run`) ahora graba cada caso de la corrida en
`.healify/history.jsonl`. Nuevo comando `healify history` muestra en terminal los
selectores más recurrentes y los que se rompieron de nuevo después de haber sido curados.

Sin sistema de config, sin export HTML/JSON, sin retención automática — MVP acotado tras
corregir el spec original contra el código real (asumía `cli/src/commands/fix.ts` y
`cli/src/config.ts`, que no existen). Detalle completo en
`docs/superpowers/specs/2026-07-23-feature8-historical-report-design.md`, plan de
implementación en `docs/superpowers/plans/2026-07-23-feature8-history-mvp-plan.md`
(ejecutado con subagent-driven development: implementador + 2 revisores por task).

`--dry-run` nunca graba (evita ensuciar el historial con las corridas del gh-action en
cada PR). "Re-roto" es una aproximación documentada: se basa en si la primera aparición
del selector fue `status: 'healed'` Y hubo al menos una aparición posterior no-healed —
un bug real de esta última condición (dos curaciones seguidas del mismo selector se
contaban como re-roto) se encontró y arregló durante la implementación, no en el diseño.

+14 tests (5 storage, 7 trends, 2 comando combinado) → 121 en `cli`. `cli` bump a 0.8.0.

## Sin publicar (post-0.7.0, incluida en 0.8.0)

Auditoría de lectura de las features #1-#6 (documentadas en 0.7.0 más abajo) — no
confiar en que "tests en verde" significa "comportamiento real correcto" cuando los
tests solo ejercitan el camino inyectado/mockeado. Se encontraron y arreglaron 4 huecos
reales, ninguno cubierto por los tests originales:

- **`cli/src/commands/init.ts` — `defaultCheckPort` estaba efectivamente invertido.**
  Corría `Test-NetConnection` por PowerShell pero nunca parseaba el stdout ("True"/
  "False"), solo miraba si el comando tiraba excepción — cosa que casi nunca pasa. En la
  práctica esto devolvía "puerto ocupado" en la gran mayoría de los casos, exista o no
  algo corriendo ahí. Arreglado parseando el stdout real. +2 tests que mockean
  `execSync` con "True"/"False" y verifican `portWarning` en consecuencia (→ 106 tests
  en cli). También se sacó un import muerto (`createConnection` de `node:net`, resto de
  una implementación anterior nunca usada).
- **`webdriverio-plugin/src/wrap.ts` — `getEvents()` era un stub que siempre devolvía
  `[]`.** No estaba exportado desde `index.ts`, no lo usaba `plugin.ts` (que ya captura
  eventos correctamente vía `onEvent`), y no tenía test. Eliminado por ser código muerto
  que podía confundir a quien lo llamara esperando eventos reales.
- **`gh-action/` — `@octokit/action` se importaba dinámicamente sin estar declarado
  como dependency.** En un run real de GitHub Actions esto rompía con "Cannot find
  module". Agregado a `package.json` y verificado que resuelve en runtime.
- **`gh-action/` — el input `project-path` no tenía ningún efecto.** Se leía de
  `INPUT_PROJECT_PATH` pero nunca se pasaba como `cwd` a los comandos de Healify, ni
  estaba declarado en `action.yml`. Arreglado: `run()` ahora acepta `cwd` y lo usa de
  verdad al correr `doctor`/`fix --dry-run`; `project-path` se declaró como input en
  `action.yml`. +2 tests que verifican que `run()` pasa el `cwd` correcto (→ 22 tests en
  gh-action).

Verificación real tras los 4 fixes: `npm run verify` completo (231 tests en los 6
workspaces del monorepo en ese momento, antes de la Feature #8 — 238 con Feature #8 ya
incluida, ver sección de arriba)
workspaces del monorepo) + `npm test` en `gh-action` (22, standalone) + `npm audit` (0
vulnerabilidades). Nota de entorno: `npm run verify` vía PowerShell en Windows resuelve
`bash` a WSL (`C:\WINDOWS\system32\bash.exe`), un filesystem distinto al del repo —
correr con Git Bash real, no con el `bash` que resuelve PowerShell por defecto.

## 0.7.0 - 2026-07-23

Features #1 a #7 del `ROADMAP.md`, en dos sesiones. #1-#6 se implementaron primero (231
tests); #7 se agregó después, con 2 correcciones reales al diseño original antes de
implementar (ver detalle abajo). #9 (extensión de VSCode) quedó cancelada por decisión
del usuario, marcada así en el `ROADMAP.md`, no se tocó código.

**#1 — `doctor` detecta el gotcha de semver caret.** Compara la versión instalada contra
el rango declarado en `package.json` y avisa si un `^0.x.y` viejo va a bloquear que
`npm install` sin versión explícita traiga una versión nueva (el mismo problema real que
mordió al usuario dos veces en sesiones anteriores).

**#2 — `flush()` en `@healify/selenium-plugin`.** Selenium ahora puede generar
`healify-report.html`/`.json` acumulando los eventos de cura en vivo, igual que
Playwright/Cypress — antes solo curaba sin dejar reporte.

**#3 — `init` detecta conflictos de puerto antes de escribir el config.** Chequeo liviano
del `baseURL` detectado antes de confirmar la config, para adelantarse a casos como el de
Obsidian compitiendo por el puerto 3000 en `sgo-pzbp`.

**#4 — diccionario de sinónimos configurable (`customSynonyms`).** `healing-engine.ts`
ahora acepta sinónimos adicionales sin tener que tocar los `dictionaries/*.json` del
propio paquete — útil para vocabulario propio de cada proyecto.

**#5 — paquete nuevo `@healify/webdriverio-plugin`.** Mismo patrón que
`selenium-plugin` (wrap del driver real, cura en vivo), para WebdriverIO.

**#6 — `gh-action/`.** GitHub Action empaquetada que corre `doctor` + `fix --dry-run` en
cada PR y comenta el resultado. Paquete privado (no se publica a npm, se usa directo del
repo).

**#7 — `healify fix --ast` (experimental).** Las sugerencias `role('button', { name: 'X'
})` no son un valor de selector pegable — antes se saltaban siempre como
`not-substitutable`. `--ast` usa `ts-morph` para reescribir la llamada completa
(`page.click('#x')` → `page.getByRole('button', { name: 'X' }).click()`), un cambio
estructural real, no reemplazo de texto. Es aditivo: primero corre el `fix` normal
(TESTID/CSS/TEXT, que ya son pegables tal cual), y solo reintenta con AST lo que quedó
sin aplicar. El plan original de esta feature tenía 2 errores reales corregidos antes de
implementar:
- Asumía que las sugerencias TEXT usaban el formato `text('X')` — el motor real nunca
  genera eso, usa `button:has-text('X')` (confirmado leyendo `healing-engine.ts`), que
  además **ya es un selector CSS válido** que el `fix` normal aplica bien tal cual sin
  necesitar AST — se sacó ese camino entero en vez de dejar código muerto.
- Estaba escrito asumiendo `commander.js` y un archivo `cli/src/commands/fix.ts` que no
  existen en este código — se adaptó al dispatch real (`cli/src/index.ts` + `cli/src/fix.ts`).

Bug real encontrado en la primera build: `ts-morph` (que carga el compilador de
TypeScript completo) quedó bundleado dentro de `dist/index.js`, inflándolo de 25kb a
**12MB**. Arreglado externalizándolo del bundle (`--external:ts-morph`, mismo patrón que
`@playwright/test`/`cypress`/`selenium-webdriver` en los otros paquetes) — queda en
31.4kb. Verificado real con el binario compilado: `fix --ast` reescribió
`page.click('#btn-submit')` a `page.getByRole('button', { name: 'Submit' }).click()`
de verdad, sin y con `--force`/`--dry-run`.

241 tests (antes 164): 44 reporter-core + 8 test-runner + 7 cypress-plugin + 104 cli + 35
selenium-plugin + 23 webdriverio-plugin + 20 gh-action. `npm audit` → 0 vulnerabilidades.

`reporter-core`/`test-runner`/`cypress-plugin`/`selenium-plugin`/`cli` a `0.7.0` (todos
bundlean o son afectados por `reporter-core`, que cambió con `customSynonyms`).
`@healify/webdriverio-plugin` nace en `0.6.0` (primera versión, no publicada todavía).
`gh-action` es privado, no se publica.

## 0.6.0 - 2026-07-23

**Cambio de comportamiento pedido explícitamente por el usuario, probando 0.5.1 en
producción real:** `init` ya NO genera ningún archivo de test. En 0.5.0/0.5.1, para cada
framework `init` creaba un test con un selector inventado a propósito
(`demo-boton-roto-healify`, `boton-viejo-12345678`) solo para mostrar un primer
`healify-report.html`. Probándolo en un proyecto real, sintió que se le mostraba algo
falso como si fuera una prueba genuina de la herramienta. Decisión: nada de demos, nunca
más — `init` deja la config real conectada y nada más; el primer selector roto que
Healify cure tiene que ser uno de verdad, escrito por el QA sobre su propia app.

- `cli/src/scaffold.ts`: sacadas las constantes `DEMO_*` y las funciones que generaban
  `e2e/healify.demo.spec.*`, `cypress/e2e/healify.demo.cy.*` y `healify.selenium.demo.*`.
  `scaffoldPlaywright` ahora devuelve solo `playwright.config.*`. `scaffoldCypress`
  devuelve config + `cypress/support/e2e.*` (ese sí es real: Cypress lo exige para e2e
  testing, no es un extra de Healify). `scaffoldSelenium` devuelve solo
  `healify.selenium.example.ts` (documentación de referencia que nunca se ejecuta, se
  mantiene sin cambios).
- `cli/src/index.ts`: el mensaje final de `init` ya no dice "Corré `npx playwright test`"
  (implicaba que ya había algo armado para correr) — ahora dice honestamente que hay que
  escribir el primer test real. Sacados `RUN_COMMAND`/`runCommandFor`.
- `cli/README.md` y `README.md` raíz actualizados: sin ningún bloque mostrando un demo,
  con la aclaración explícita de que `init` no genera tests.
- 2 bugs reales encontrados en una auditoría completa del motor, no relacionados con los
  demos — ver detalle abajo.

**Bug real — `healing-engine.ts`: selectores CSS-in-JS compuestos no se detectaban como
volátiles.** `analyzeSelector` solo entraba a la rama de clase volátil si el selector
completo empezaba con `.` — un selector real como `.btn.css-1a2b3c4d5e` (clase semántica +
hash de CSS-in-JS pegados, muy común con styled-components) o con combinador
(`.container > .css-1a2b3c4d`) nunca se detectaba como dinámico, y caía al fallback
genérico en vez de proponer una alternativa estable. Arreglado: la detección ahora busca
el patrón volátil en cualquier posición del selector, no solo desde el inicio del string.

**Bug real — `cli/src/fix.ts`: podía reemplazar un selector dentro de un comentario en vez
del código real.** El conteo de ocurrencias no distinguía código de comentarios — si el
selector roto quedaba mencionado solo en un comentario (`// TODO: reemplazar '#btn-x'`) y
ya no existía en el código real, `fix` lo reemplazaba ahí igual y reportaba `applied` con
confianza total, sin cambiar nada funcional. Arreglado: las líneas de comentario se
filtran antes de contar ocurrencias; si la única mención real está en un comentario, se
trata como `not-found`.

`reporter-core`/`test-runner`/`cypress-plugin`/`cli`/`selenium-plugin` a `0.6.0` — los 4
paquetes publicables bundlean `reporter-core`, así que el fix de `healing-engine.ts`
necesita republicar los 5, no solo `cli`.

## 0.5.1 - 2026-07-23

**Fix crítico encontrado probando 0.5.0 en producción real (`sgo-pzbp`), no en tests:**
un `npx playwright test` (sin especificar archivo) escaneó todo `e2e/` y encontró
`e2e/selenium.demo.test.ts` — matchea el patrón de descubrimiento de tests por defecto de
Playwright (`*.test.ts` dentro del `testDir`). Playwright lo cargó como si fuera un test
suyo y, como el script corre `main()` apenas se importa (no espera a que lo invoquen),
se disparó como efecto secundario: abrió una sesión de Chrome de más (vía ChromeDriver) y
mezcló su log de curado con la salida del test real de Playwright. Confirmado real,
copia exacta del output del usuario.

**Fix:** el demo de Selenium (`scaffoldSelenium` en `cli/src/scaffold.ts`) ya no vive en
`e2e/` ni usa sufijo `.spec.`/`.test.` — se mueve a la raíz como `healify.selenium.demo.ts`
(al lado de `healify.selenium.example.ts`). `cli/src/index.ts` ajustado para armar el
comando de "Listo. Corré..." leyendo el nombre real generado (TS o JS) en vez de asumir
`.ts` a mano. Verificado real: `npx playwright test` en `sgo-pzbp` ya no dispara Chrome de
más, y `npx tsx healify.selenium.demo.ts` sigue curando y clickeando bien por separado.

**Bug secundario encontrado en el propio mensaje del demo:** el comentario JSDoc explicando
por qué el archivo no debía llamarse `.test.ts` contenía literalmente `*.spec.*/*.test.*`
— ese `*/` cerraba el comentario `/** ... */` antes de tiempo, dejando el resto del texto
como código real y rompiendo el parseo (`esbuild` tiraba `Unexpected "*"` al intentar
correr el demo con `npx tsx`). Reescrito sin la secuencia `*/` literal. Test de regresión
nuevo: los 3 templates (Playwright/Cypress/Selenium) ahora se validan parseando con
`esbuild.transformSync` en vez de solo revisar substrings — así un futuro comentario mal
escrito rompe el test en vez de llegar a producción.

162 tests (antes 160). `cli` a `0.5.1` — único paquete tocado, `test-runner`/
`cypress-plugin`/`reporter-core` sin cambios desde 0.5.0.

## 0.5.0 - 2026-07-23

**Fix crítico (`reporter-core`, republicado vía `test-runner`/`cypress-plugin`):**
`extractSelectorFromError()` usaba un patrón `["']([^"']+)["']` que EXCLUÍA ambos tipos de
comilla del contenido capturado. El selector de mayor confianza del motor —
`[data-testid="x"]`, comillas dobles adentro de las comillas simples que pone Playwright
alrededor de `locator('...')` — nunca se extraía completo: el regex cortaba en la primera
comilla interna y no volvía a matchear nunca. Resultado real, confirmado corriendo
`npx playwright test` contra un selector `data-testid` roto de verdad: `status: 'unresolved'`
siempre, para el caso más común y de mayor confianza del motor (TESTID, 0.95). Arreglado con
un backreference de comilla (`(["'])((?:(?!\1).)+)\1`, grupo 2 = contenido) que permite
comillas del otro tipo adentro. Verificado real: mismo test, mismo selector, ahora
`Healed: 1 | Review: 0 | Unresolved: 0`. Afecta a cualquier proyecto Playwright real que use
`data-testid`/`data-cy` — que es la recomendación estándar de selector estable. 6 tests de
regresión nuevos en `reporter-core` (`selector-extractor.test.ts`).

**Feature (`@healify/cli`): `init` universal — funciona en cualquier proyecto, no solo en uno
que ya tiene el framework instalado.**

- Si no detecta ningún framework de e2e, pregunta cuál armar (Playwright/Cypress/Selenium,
  default Playwright) y scaffoldea todo desde cero: config con el reporter/plugin ya
  wireado, un test demo con selector roto a propósito, y (Playwright/Cypress) los archivos
  de soporte necesarios
- Si el framework ya está instalado pero sin archivo de config (bug real encontrado en un
  proyecto Vite-only: `@playwright/test` instalado, `playwright.config.*` nunca creado) —
  scaffoldea el config automáticamente en vez de solo avisar
- Si ya hay config sin Healify, sigue igual que antes (inyecta el marcador, idempotente)
- baseURL automático: primero el script `"dev"` de `package.json` (`vite --port=3000` — el
  caso real más común, confirmado auditando un proyecto Vite donde el puerto nunca está en
  `vite.config.*`), después `server.port` de `vite.config.*`/`next.config.*`, si no 5173/3000
- TS vs JS y ESM vs CJS detectados solos (`tsconfig.json`, `package.json` `"type"`)
- Prompt interactivo sin dependencias nuevas (`fs.readSync` sobre el fd 0), con fallback
  determinístico al framework default si stdin no es TTY (nunca cuelga en CI)
- Selenium: el demo (`e2e/selenium.demo.test.ts`) navega a una página HTML autocontenida
  (`data:` URL) en vez de depender del DOM real del proyecto — no necesitás tu app corriendo.
  Usa un selector de ID dinámico (no testid) a propósito: la estrategia de "cura" de testid
  solo normaliza comillas, que para el navegador es el MISMO selector — así que si el
  original no encuentra nada, el reintento con el "fix" tampoco encontraría nada nunca
  (confirmado corriendo el demo real antes del cambio: la cura se detecta, confidence 0.93,
  pero el reintento vuelve a tirar `NoSuchElementError`). Con la estrategia de ID
  dinámico → clase estable (`#boton-viejo-12345678` → `.boton-viejo`, confidence 0.82) y un
  botón real con esa clase en la página autocontenida, el reintento sí encuentra un elemento
  distinto y el click funciona de verdad. `confidenceThreshold` bajado a 0.75 solo en el
  demo (0.82 < el default de producción 0.9) — comentado en el propio archivo generado.

**Fix (`doctor`):** mensaje de "no detectamos framework" ahora manda a `npx @healify/cli init`
en vez de "instalá Playwright/Cypress/Selenium primero" — con `init` universal ya no hace
falta instalar nada a mano antes.

**Tests:** 22 tests nuevos (`init.test.ts` ampliado + `scaffold.test.ts` nuevo + 6 de
regresión en `reporter-core`) — 160 tests en verde (36+8+7+80+29), antes 138.

**Validación real (no solo tests) contra `sgo-pzbp` (proyecto Vite real, sin ningún e2e
armado todavía):**

- **Playwright** (bug real de CASO B: `@playwright/test`+`@healify/test-runner` ya
  instalados, `playwright.config.ts` nunca existió) → `init` lo creó con
  `baseURL: 'http://localhost:3000'` (correcto — el puerto real vive en el script `dev`, no
  en `vite.config.ts`, que en este proyecto no lo menciona) → `npx playwright test` con la
  app corriendo → `Healed: 1 | Review: 0 | Unresolved: 0` real → `doctor` 100% verde
- **Cypress** (`cypress` no es dependency declarada en `sgo-pzbp` — validado en un proyecto
  descartable aparte para no forzar una dependencia nueva en un repo de producción real, sin
  tocar `sgo-pzbp`) → mismo resultado: `npx cypress run` → `Healed: 1 | Review: 0 |
  Unresolved: 0` real → `doctor` 100% verde
- **Selenium** (`selenium-webdriver`+`@healify/selenium-plugin` ya instalados) → `init`
  scaffoldeó el ejemplo + el demo → `npx tsx e2e/selenium.demo.test.ts` con ChromeDriver real
  → evento `healed` real (confidence 0.82, `.boton-viejo`) y el `.click()` final funcionó de
  verdad → `doctor` 100% verde

Todo lo agregado a `sgo-pzbp` para las pruebas (`playwright.config.ts`, `e2e/`,
`healify.selenium.example.ts`, `healify-report.html/json`) se borró al terminar — el repo
real queda exactamente como estaba (Vite-only), según lo pedido. Detalle completo en
`docs/audit-0.5.0.md`.

`reporter-core`/`test-runner`/`cypress-plugin`/`cli` a `0.5.0`. `selenium-plugin` sin
cambios de código, queda en `0.1.0`.

**chore:** `npm audit fix --force` — `esbuild` 0.27.7 → 0.28.1 (bump breaking, quedaba
pendiente desde 0.4.1). Verificado real: build de los 5 workspaces sin cambios de
comportamiento (tamaños de bundle casi idénticos), 160 tests siguen verdes, `cli/dist/index.js`
probado a mano (`--help`, `doctor`) sin diferencias. `npm audit` → 0 vulnerabilidades.

## 0.4.1 - 2026-07-23

- fix: `doctor` marcaba `❌ healify-report.json existe` en proyectos Selenium-only como si fuera un error — Selenium cura en vivo y nunca genera ese archivo, así que ese check nunca podía pasar. Ahora, si Selenium es el único framework, se reemplaza por un check informativo (`ℹ️ Selenium cura en vivo, no genera reporte`). Si convive con Playwright/Cypress, el check de reporte se mantiene (`cli/src/commands/doctor.ts`)
- fix: `--help`/`-h` ejecutaba el comando de verdad en vez de mostrar ayuda — confirmado corriendo el binario real: `healify init --help` instalaba paquetes y editaba configs. Ahora `--help` en cualquier posición corta antes de despachar a `init`/`doctor`/`fix` (`cli/src/index.ts`)
- docs: alineados `README.md` raíz y `cli/README.md` a `npx @healify/cli <comando>` en vez de `npx healify <comando>` (ambas formas funcionan una vez instalado, pero eran inconsistentes entre sí)
- docs: corregido el ejemplo de `doctor` en el README raíz — mostraba un flujo interactivo `[y/n]` que no existe; reemplazado por el output real del comando
- docs: badge y menciones de cantidad de tests actualizadas de 135 a 138 (64 tests en `cli`, +3 por el fix de `doctor`)
- chore: `npm audit fix` (sin `--force`) resolvió 5 de 6 vulnerabilidades de devDependencies (lodash, picomatch, postcss, vite, vitest — todas vía `cypress`/`vitest`, no llegan al tarball publicado). Queda `esbuild` (requiere bump breaking 0.27→0.28, usado en el build de los 4 paquetes) — no forzado, ver `docs/audit-0.4.1.md`
- `@healify/cli` a `0.4.1` (único paquete con cambios de comportamiento reales). `test-runner`/`cypress-plugin`/`reporter-core` quedan en `0.4.0`, `selenium-plugin` en `0.1.0`
- 138 tests en verde (`npm run verify`), verificado con el binario real contra un proyecto Playwright, uno Cypress y contra `sgo-pzbp` (Selenium real, ChromeDriver real)

## 0.4.0 - 2026-07-22

- feat: `@healify/cli init` — detecta el framework (Playwright/Cypress/Selenium) por `package.json` y archivos de config, instala el paquete de Healify que falte y wirea el `reporter`/plugin en el config automáticamente. Idempotente: no duplica si ya está instalado o configurado
- feat: `@healify/cli doctor` — checklist con ✅/❌ y fix sugerido: framework detectado, paquete instalado, config wireado, `healify-report.json` generado. No modifica nada
- feat: `healify` sin argumentos o con comando desconocido imprime help listando `init`/`doctor`/`fix`
- fix: instalación en Windows fallaba silenciosamente (`ENOENT`/`EINVAL` con `execFileSync` + `npm`/`.cmd`) — encontrado corriendo el binario real, corregido con `execSync`
- docs: sección "Para QA sin experiencia" en `cli/README.md` con los 3 comandos
- 61 tests nuevos en `cli` (135 totales en el monorepo)

## 0.3.1 - 2026-07-22

- fix: filtro de atributos volátiles (`css-`, `sc-`, hash largo) — el motor ya no propone una `.class` inestable como alternativa cuando el candidato sigue viéndose volátil o el selector original tiene más de 3 fragmentos tipo hash/número (`1998642`)
- fix: `healing-engine` ordena candidatos por escalera de prioridad de atributo estable (testid > id > name > aria-label/role > texto > clase) en vez de solo por confidence — ningún número de confianza cambió, solo qué candidato gana cuando compiten varios (`b41e0be`)
- docs: tabla de versiones, sección `npm run verify` y mención del `printSummary` nuevo en los READMEs de `test-runner`/`cypress-plugin`/raíz (`b657c39`)

## 0.3.0 - 2026-07-22

- feat: `printSummary()` en `local-report.ts` -> stdout `Healed | Review | Unresolved` en `onEnd()` de `test-runner` y `cypress-plugin`
- feat: `npm run verify` script de 33 líneas, resumen de 5 paquetes con dot reporter
- feat: diccionarios extraídos a `dictionaries/en.json` y `es.json` con `resolveJsonModule`
- breaking: eliminado modo nube completo (`http-client.ts`, `HEALIFY_API_KEY`, `config.ts`, `fake-server.mjs` y verifies). Main ahora 100% local sin red.
- chore: `.claudeignore` y `CLAUDE.md` para reducir consumo de tokens de Claude Code

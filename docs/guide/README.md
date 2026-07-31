# Manual de Healify

Guía de punta a punta: qué es, cómo instalarlo paso a paso, cómo funciona el motor por
dentro, y cómo resolver los problemas más comunes. Para referencia rápida de API de cada
paquete, ver su propio README (linkeados abajo): esta guía es el recorrido completo, no un
índice de API. El [README raíz](../../README.md) es el pitch corto — si buscás algo que no
está ahí, es porque vive acá.

## Índice

1. [Qué es y qué no es Healify](#qué-es-y-qué-no-es-healify)
2. [Instalación por paquete](#instalación-por-paquete)
3. [Empezar de cero, paso a paso](#empezar-de-cero-paso-a-paso)
4. [Instalación manual (sin `init`)](#instalación-manual-sin-init)
5. [Cómo funciona el motor heurístico](#cómo-funciona-el-motor-heurístico)
6. [Verificación contra la página real](#verificación-contra-la-página-real)
7. [El repertorio: memoria entre corridas](#el-repertorio-memoria-entre-corridas)
8. [Modo interactivo](#modo-interactivo)
9. [Multi-lenguaje: Python, Java, C#](#multi-lenguaje-python-java-c)
10. [El reporte HTML](#el-reporte-html)
11. [Cerrar el loop: aplicar sugerencias con `cli`](#cerrar-el-loop-aplicar-sugerencias-con-cli)
12. [Arquitectura del monorepo](#arquitectura-del-monorepo)
13. [Cobertura de tests](#cobertura-de-tests)
14. [Troubleshooting](#troubleshooting)

---

## Qué es y qué no es Healify

Healify corre junto a tus tests de Playwright, Cypress, Selenium o WebdriverIO. Cuando un
test falla porque un selector ya no encuentra el elemento en la página, Healify:

1. Extrae el selector que falló del mensaje de error.
2. Le aplica una heurística de pattern-matching sobre el texto del selector: reconoce
   IDs/clases generadas dinámicamente, atributos estables (`data-testid`, `aria-label`,
   `name`), locators modernos de Playwright, combinadores CSS (`.padre > .hijo`), y
   diccionarios de acciones/campos en español e inglés.
3. **Cuando puede, confronta la sugerencia contra el DOM real** de la página (ver
   [Verificación contra la página real](#verificación-contra-la-página-real)) — no siempre
   puede, y el reporte siempre dice si lo hizo o no.
4. Propone un selector alternativo con un puntaje de confianza (0–100%).

Lo que no es: no es IA. No hay modelo, no hay inferencia, no hay llamada a ningún
servicio de lenguaje. La heurística de texto es una función determinística, el mismo
selector de entrada da siempre la misma sugerencia base. La parte de verificación contra
la página es real (Selenium, WebdriverIO, Playwright, y Cypress si usás
`cy.healifyGet`) — Healify no adivina si tiene el dato real disponible, lo consulta.

No tiene memoria más allá de lo que vos le pedís guardar: el repertorio
(`.healify/history.jsonl`) es opt-in, no un tracking oculto.

Y no hay servidor, cuenta ni red. Todo corre en el mismo proceso que tus tests (o en un
subproceso local para el puente multi-lenguaje, nunca por internet). El código del motor
está en
[`reporter-core/src/healing-engine.ts`](../../reporter-core/src/healing-engine.ts),
auditable, no es una caja negra.

Si un selector no tiene ningún patrón reconocible y tampoco se pudo confirmar contra la
página, la heurística no inventa una respuesta: el reporte lo marca `unresolved` y lo
dice honestamente.

## Instalación por paquete

| Framework | Paquete | Instalación | Guía completa |
|---|---|---|---|
| Playwright | `@healify/test-runner` | `npm install --save-dev @healify/test-runner` | [README](../../test-runner/README.md) |
| Cypress | `@healify/cypress-plugin` | `npm install --save-dev @healify/cypress-plugin` | [README](../../cypress-plugin/README.md) |
| Selenium | `@healify/selenium-plugin` | `npm install --save-dev @healify/selenium-plugin selenium-webdriver` | [README](../../selenium-plugin/README.md) |
| WebdriverIO | `@healify/webdriverio-plugin` | `npm install --save-dev @healify/webdriverio-plugin` | [README](../../webdriverio-plugin/README.md) |
| — | `@healify/cli` | `npm install --save-dev @healify/cli` | [README](../../cli/README.md) |

Playwright y Cypress generan un reporte (`healify-report.html`/`.json`/`.md`) al final de
la corrida automáticamente. Selenium y WebdriverIO no tienen un hook de "fin de corrida"
nativo, así que esos dos plugins curan selectores en vivo y solo generan
`healify-report.json` (sin HTML) si llamás `flush()` vos mismo al final de tu suite. Ver
sus READMEs para el detalle y las limitaciones específicas de ese modo.

## Empezar de cero, paso a paso

Si nunca usaste Healify, esto te toma 2 minutos.

**Paso 1: Instalar la herramienta de diagnóstico**

```bash
npm install --save-dev @healify/cli
```

**Paso 2: Diagnosticar tu proyecto**

```bash
npx @healify/cli doctor
```

Te va a decir qué framework usás, si tenés instalado lo necesario, si tu config está
lista, y si ya generaste un reporte. Ejemplo real (sin nada instalado todavía):

```
Healify doctor

✅ Framework detectado: playwright
❌ @healify/test-runner instalado
   fix: npm install --save-dev @healify/test-runner
❌ playwright.config.ts tiene Healify configurado
   fix: npx @healify/cli init
❌ healify-report.json existe
   fix: Corré tus tests al menos una vez con algún selector roto para generar el reporte.
```

`doctor` no te pregunta nada ni instala nada por vos: solo diagnostica. Cada `fix:` es el
comando exacto para arreglar ese punto. Si usás Selenium o WebdriverIO en vez de
Playwright/Cypress, el check de `healify-report.json` no aparece (curan en vivo, no
generan ese reporte solos).

**Paso 3: Arreglar la config automáticamente**

```bash
npx @healify/cli init
```

Esto te instala el paquete correcto, te edita el config del framework (o lo crea de
cero), y para Selenium/WebdriverIO te deja un archivo de referencia documental (nunca se
ejecuta) mostrando cómo envolver tu driver/browser. No duplica nada si ya lo tenías.

> **¿Ni siquiera tenés el framework instalado?** No hace falta el Paso 2: corré
> directamente `npx @healify/cli init`. Te pregunta qué framework armar, lo instala y te
> deja el config conectado. **No genera ningún test**: el primer selector roto que
> Healify cure tiene que ser uno de tu propia app, no uno inventado. Detalle de los 3
> casos en el [README del CLI](../../cli/README.md).

**Paso 4: Levantá tu app y corré tu primer test real**

Un test e2e abre un navegador de verdad y navega a una URL real. Antes de escribir o
correr nada, levantá tu app en una terminal aparte y dejala corriendo (`npm run dev`), y
confirmá que responde abriendo esa URL a mano en el navegador.

Recién ahí escribí tu primer test. Healify no te lo genera: el primer selector que cure
tiene que ser uno de tu propia app.

**Si usás Playwright**, creá `e2e/mi-primer-test.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('mi primer test', async ({ page }) => {
  await page.goto('/')
  await page.click('#reemplazar-por-tu-selector-real')
})
```

**Si usás Cypress**, creá `cypress/e2e/mi-primer-test.cy.ts`:

```ts
it('mi primer test', () => {
  cy.visit('/')
  cy.get('#reemplazar-por-tu-selector-real').click()
})
```

- `goto('/')` / `visit('/')` abre el navegador en tu `baseURL`. La barra sola es la home;
  podés poner `/login` o cualquier otra ruta.
- `click(...)` busca un elemento y le hace click. **Ese es el selector que Healify va a
  curar cuando se rompa** — el resto del test es andamiaje.
- `#reemplazar-por-tu-selector-real` es un placeholder. Cambialo por uno real de tu app o
  el test va a fallar por el motivo equivocado.

`init` te imprime este mismo snippet al terminar, ya ajustado a tu proyecto: en `.js` si
no usás TypeScript, y con `require` en vez de `import` si tu `package.json` es CommonJS.

Para sacar un selector real: abrí tu app en el navegador, click derecho sobre el elemento
→ *Inspeccionar*. Buscá un `id` (`#mi-id`) o un `data-testid` (`[data-testid="mi-id"]`).
Si no tiene ninguno, sirve una clase (`.mi-clase`), aunque son más frágiles — justamente
el tipo de fragilidad que Healify detecta.

> **Usá el framework que ya te detectó `doctor`.** Correr `npx cypress run` en un
> proyecto que solo tiene Playwright configurado falla por falta de Cypress, no por
> Healify.

Con el archivo creado y tu app levantada:

```bash
npx playwright test
# o, si tu proyecto usa Cypress
npx cypress run
```

Al terminar se crean `healify-report.html`, `healify-report.md` y `healify-report.json`
en la raíz — siempre, hayan fallado tests o no. Si la corrida salió limpia, el reporte lo
dice con un **PASS** en vez de quedar vacío.

**Paso 5: Ver el reporte y aplicar el fix**

```bash
npx @healify/cli fix --dry-run       # ver qué haría, sin tocar nada
npx @healify/cli fix                 # aplicar los fixes de mayor confianza
npx @healify/cli fix --interactive   # o decidir vos, caso por caso
```

Abrí `healify-report.html` para ver algo como `Healed: 1 | Review: 1 | Unresolved: 2`.
Listo.

## Instalación manual (sin `init`)

<details>
<summary><strong>Playwright</strong></summary>

```bash
npm install --save-dev @healify/test-runner
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  reporter: [['list'], ['@healify/test-runner/reporter']],
})
```

</details>

<details>
<summary><strong>Cypress</strong></summary>

```bash
npm install --save-dev @healify/cypress-plugin
```

`cypress.config.ts`:

```ts
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'
export default defineConfig({
  e2e: { setupNodeEvents: (on, config) => HealifyCypressPlugin(on, config) },
})
```

Opcional, para curado en vivo (`cy.healifyGet`): agregá
`import '@healify/cypress-plugin/support'` en tu support file.

</details>

<details>
<summary><strong>Selenium</strong></summary>

```bash
npm install --save-dev @healify/selenium-plugin selenium-webdriver
```

```ts
import { Builder, By } from 'selenium-webdriver'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'
const raw = await new Builder().forBrowser('chrome').build()
const healify = new HealifySeleniumPlugin({ onEvent: console.log })
const driver = healify.wrap(raw)
await driver.findElement(By.css('#add-to-cart-btn')).click()
// al final de la suite, si querés un healify-report.json:
healify.flush()
```

Cura en vivo, verificado contra el DOM real. `flush()` genera `healify-report.json` (sin
HTML). Ver su README para limitaciones.
</details>

<details>
<summary><strong>WebdriverIO</strong></summary>

```bash
npm install --save-dev @healify/webdriverio-plugin
```

```ts
import { remote } from 'webdriverio'
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'
const raw = await remote({ capabilities: { browserName: 'chrome' } })
const healify = new HealifyWebdriverIOPlugin({ onEvent: console.log })
const browser = healify.wrap(raw)
await browser.$('#add-to-cart-btn').click()
// al final de la suite, si querés un healify-report.json:
healify.flush()
```

Cura en vivo, verificado contra el DOM real. `flush()` genera `healify-report.json` (sin
HTML). Ver su README para limitaciones.
</details>

## Cómo funciona el motor heurístico

Todo vive en `reporter-core/src/healing-engine.ts`, compartido por los cinco paquetes.
Reglas principales:

| Patrón detectado | Ejemplo | Sugerencia |
|---|---|---|
| ID con dígitos o sufijo hexadecimal | `#user-a1b2c3` | Clase derivada del mismo nombre, sin el sufijo dinámico |
| Clase de CSS-modules o styled-components | `.btn_a1b2`, `.sc-x7f2` | Selector semántico alternativo (rol, texto, `data-testid`) |
| `data-testid` / `data-cy` / `data-qa` / `data-test` / `data-e2e` | `[data-testid="x"]` | Se conserva y normaliza, el candidato de mayor confianza |
| XPath | `//div[3]/button` | Reemplazado por un selector de rol ARIA (XPath es el tipo más frágil) |
| `[name=]` / `[aria-label=]` | `[name="email"]` | Se conserva tal cual, ya son atributos razonablemente estables |
| Locator moderno de Playwright | `getByRole(...)`, `getByText(...)` | No se toca, se marca para revisión manual |
| Posicional | `li:nth-child(3) > a` | Se marca frágil, se propone un selector de rol |
| Combinador CSS compuesto | `.card .title`, `.padre > .hijo` | Se conserva solo el elemento objetivo (el último segmento), sin la ruta de ancestros |

Para botones/inputs/links detectados por patrones en el texto del selector (`button`,
`input`, `login`, etc.), el motor arma la sugerencia con diccionarios bilingües
(`ACTIONS`/`FIELDS` en `healing-engine.ts`): `login`→`Login`/`Iniciar Sesión`,
`email`→`Email`/`Correo`, `guardar`→`Guardar`, etc.

Confianza: cada estrategia tiene un puntaje base. Sin verificación contra la página, se
ajusta de forma determinística (no aleatoria) por un hash del selector, así que el mismo
input sin DOM da siempre el mismo resultado, acotado entre 75% y 98%. Con verificación,
la confianza real reemplaza el ajuste por hash.

Umbrales (definidos en `reporter-core/src/local-mode.ts`):

| Confianza | Estado | Qué significa |
|---|---|---|
| ≥ 90% | `healed` | Auto-aplicable sin revisión, es lo que usa `@healify/cli fix` |
| 80–90% | `review` | Se muestra en el reporte, pero requiere que lo confirmes vos |
| < 80% | `unresolved` | Sin sugerencia, el motor prefiere no arriesgarse |

## Verificación contra la página real

El motor trabaja de dos maneras, y la diferencia es grande. El reporte siempre te dice
cuál de las dos usó en cada caso (`verified: true/false`).

**Verificado contra la página (Playwright, Selenium, WebdriverIO, y Cypress vía
`cy.healifyGet`).** Cada camino llega ahí distinto:

- **Playwright** guarda el árbol de accesibilidad de la pantalla cuando un test falla.
  Healify lo lee del archivo que Playwright ya escribió.
- **Selenium y WebdriverIO** curan en vivo: en el momento exacto en que un
  `findElement`/`$()` falla, todavía tienen el browser abierto en la mano. Healify
  consulta el DOM real ahí mismo (`executeScript`/`execute`).
- **Cypress** es pasivo por defecto (`after:spec`/`after:run`, sin acceso al DOM real, ya
  que el spec y el motor corren en procesos separados). `cy.healifyGet(selector)` — opt-in,
  `import '@healify/cypress-plugin/support'` — reemplaza `cy.get()` puntualmente donde ya
  sabés que un selector es frágil: sondea el DOM real vía `cy.task` y verifica antes de
  reintentar. Lo que no pase por `healifyGet` sigue sin la marca de verificado.

En todos los casos verificados, el resultado es el mismo: Healify confronta sus
sugerencias contra lo que había de verdad en pantalla — descarta lo que no existe y toma
los nombres de la página en lugar de deducirlos. Un `#comprar-ahora-a1b2c3` roto resuelve
a `role('button', { name: 'Comprar' })` con el texto real del botón, y el fix se aplica
reescribiendo la llamada (`page.click(...)` → `page.getByRole(...)`, o el XPath
equivalente para Selenium/WebdriverIO, que no interpretan la sintaxis de Playwright).

Si nada coincide, el reporte lo dice: puede que el elemento ya no exista, y entonces el
problema no es el selector sino que la funcionalidad no está.

En todos los casos es comparación de strings/DOM contra datos que ya están en tu máquina:
no hay IA, ni red, ni servidor.

## El repertorio: memoria entre corridas

Cada curación **verificada contra la página real** se puede grabar en
`.healify/history.jsonl` — un JSONL local del proyecto, con el mismo formato en todos los
adapters (JS, Python, Java, C#).

La próxima vez que ese mismo selector se rompa en el mismo archivo, si esa corrida **no**
puede verificar nada por su cuenta (Cypress sin `cy.healifyGet`, o cualquier framework en
un entorno donde el sondeo no estuvo disponible esa vez), Healify no vuelve a adivinar a
ciegas: reusa la corrección que ya se confirmó antes.

La verificación en vivo de la corrida actual siempre gana — si la página cambió, lo que
ves ahora es más confiable que lo que se grabó la última vez. El repertorio es un
respaldo, no un reemplazo. Y es compartido entre lenguajes: una curación verificada desde
Playwright (JS) puede resolver un selector roto en un test de Python, si corren contra el
mismo repo.

`npx @healify/cli history` te muestra qué selectores se rompen más seguido y cuáles
volvieron a romperse después de haber sido curados — útil para priorizar qué elementos
merecen un `data-testid` estable.

## Modo interactivo

```bash
npx @healify/cli fix --interactive
```

En vez de aplicar todo lo que supera el umbral automático, Healify te muestra cada
sugerencia — selector, propuesta, confianza, si está verificada contra la página o viene
del repertorio — y te pregunta. También te ofrece los casos "a revisar" (80–89% de
confianza), que `fix` normal nunca toca: si vos decidís que tiene sentido, se aplica
igual. `a` aplica el resto sin más preguntas, `q` corta y deja el resto sin tocar. Necesita
una terminal real — en CI o detrás de un pipe, avisa y sigue en modo automático en vez de
colgarse.

## Multi-lenguaje: Python, Java, C#

El motor no está atado a JS: `npx @healify/cli heal` lo expone como un comando que recibe
JSON por stdin y devuelve JSON por stdout — heurística, verificación contra la página y
repertorio incluidos. `npx @healify/cli probe-script` imprime el script de sondeo que
corre en el browser. Cualquier lenguaje que pueda spawnear un subproceso lo usa.

- **Python**: `pip install healify-selenium` — paquete real, verificado de punta a punta.
- **Java**: Maven, `io.github.mescobar996:healify-selenium:0.1.0` — paquete real,
  publicado en Maven Central, verificado de punta a punta.
- **C#**: adapter de referencia (código para copiar y adaptar, no hay paquete en NuGet
  todavía), verificado de punta a punta con .NET 8 + Chrome real.

Contrato completo del puente JSON en [`docs/adapters/README.md`](../adapters/README.md)
por si tu lenguaje no tiene un adapter todavía.

## El reporte HTML

`healify-report.html` (generado por `test-runner`/`cypress-plugin`) tiene dos secciones:

- **"Necesita tu atención"**: casos `review` y `unresolved`, ordenados por gravedad (sin
  sugerencia primero, después por confianza ascendente). Expandida por default.
- **"Sanados automáticamente"**: casos `healed`, colapsada por default.

Podés marcar casos como "arreglado" (persiste en `localStorage`, escopeado por proyecto y
corrida), copiar la sugerencia con un click, y cambiar entre tema claro/oscuro. Todo
corre en el HTML mismo, sin servidor. El archivo es 100% autocontenido.

Los tres formatos (`html`/`md`/`json`) arrancan con un veredicto **PASS/FAIL** de la
corrida y el entorno donde se ejecutó (framework, versión, navegador, URL base, sistema,
Node, duración). Cada defecto trae un ID estable (`HLF-A1B2C3`, mismo selector + mismo
archivo → mismo ID siempre), severidad, resultado esperado vs. obtenido, pasos para
reproducir (los que el framework registró de verdad) y evidencia (link al screenshot que
el framework ya guardó, si lo tenés activado). Lo que un adapter no puede saber, no
aparece — Selenium y WebdriverIO no tienen concepto de "suite", así que su reporte no
inventa un total de tests.

## Cerrar el loop: aplicar sugerencias con `cli`

```bash
npx @healify/cli fix                # aplica los casos "healed" de ./healify-report.json
npx @healify/cli fix --dry-run       # muestra qué haría, sin escribir nada
```

Solo toca casos con ≥90% de confianza, nunca adivina en selectores ambiguos (2+
ocurrencias en el mismo archivo) ni toca archivos con cambios de git sin commitear (salvo
`--force`). Ver [`cli/README.md`](../../cli/README.md) para el detalle completo.

## Arquitectura del monorepo

```
reporter-core/     # Motor heurístico + tipos compartidos (privado)
  ├─ healing-engine.ts       # Las reglas de la tabla de arriba
  ├─ browser-probe.ts        # Script de sondeo del DOM (Selenium/WebdriverIO/Cypress)
  ├─ repertoire.ts           # Parseo/match de .healify/history.jsonl
  ├─ local-mode.ts           # Umbrales + runLocalHealing()
  ├─ local-report.ts         # Genera el HTML/JSON
  └─ selector-extractor.ts   # Parsea el selector desde el mensaje de error

test-runner/         # Adapter de Playwright (Reporter + fixture opcional)
cypress-plugin/      # Adapter de Cypress (setupNodeEvents + cy.healifyGet opcional)
selenium-plugin/     # Wrapper de Selenium WebDriver (Proxy sobre findElement)
webdriverio-plugin/  # Wrapper de WebdriverIO
cli/                  # init/doctor/fix/history + heal/probe-script (puente multi-lenguaje)
python/healify-selenium/  # Paquete PyPI
java/healify-selenium/    # Paquete Maven Central
docs/adapters/        # Adapter de referencia C#, contrato del puente
```

Los paquetes de framework dependen de `reporter-core` pero nunca reimplementan sus
reglas: si un selector cura mal en un framework, el fix va en `healing-engine.ts`, no en
el adapter.

npm workspaces, TypeScript estricto, Vitest para tests unitarios, `esbuild` para
bundlear `reporter-core` inline en cada paquete publicable (es privado, nunca se instala
solo).

## Cobertura de tests

```bash
git clone https://github.com/mescobar996/Healify.git
cd Healify
npm install
npm run build
npm run verify     # build + todos los tests, resumen por paquete
npm run coverage   # cobertura de líneas por paquete (v8)
```

| Paquete | Líneas |
|---|---|
| reporter-core (el motor) | ~90% |
| cypress-plugin | 100% |
| selenium-plugin | 100% |
| webdriverio-plugin | ~87% |
| cli | ~72% |
| test-runner | ~62% |

Reproducible en tu máquina con `npm run coverage`. El motor de heurística
(`reporter-core`), que es donde vive toda la lógica real, es el más cubierto; los
adapters de framework son más finos y algunos caminos solo se ejercitan contra un browser
real.

## Troubleshooting

**"El reporte dice `unresolved` en casi todos mis casos."** Si tu framework no verifica
contra el DOM real (Cypress sin `cy.healifyGet`) y tus selectores no tienen ningún patrón
reconocible (sin `data-testid`, sin `name`, sin texto claro de acción), el motor no tiene
de dónde sacar una sugerencia confiable. Esto es esperado, no un bug. Agregar
`data-testid` a los elementos que testeás es la forma más confiable de subir la tasa de
curado.

**"`@healify/cli fix` saltó un caso con `role(...)`."** Es esperado. Esas sugerencias son
texto legible para el reporte, no un selector pegable (`role('button', { name: 'X' })` no
es código válido de Playwright/Selenium). Aplicarlo tal cual corrompería el archivo, así
que se salta con aviso en vez de romper nada.

**"`ENOENT: healify-report.json`."** No corriste los tests todavía. Corré `doctor`
primero, después tus tests, recién después `fix`.

**"El test falla apenas arranca, con algo que no tiene nada que ver con mi app (una
página en blanco, contenido de otra herramienta)."** Puede que otro programa esté usando
el mismo puerto que tu `baseURL`. Confirmá quién responde ahí antes de sospechar de
Healify o de tu selector:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress, OwningProcess
```

Si aparece un proceso que no es el de tu app, corré tu `dev` en otro puerto (ajustando
`baseURL` en `playwright.config.ts`/`cypress.config.*` a mano, o cambiando el puerto en
tu script `dev` de forma permanente si el conflicto se repite siempre).

**"`init`/`doctor` no muestran lo nuevo de esta versión."** Revisá qué versión tenés
instalada de verdad (`npx @healify/cli --version`). Si venís de una instalación anterior
a la 1.0.0, `doctor` te avisa si tu `package.json` todavía tiene un rango `^0.x.y` viejo
(el gotcha de semver: `^0.4.1` significa "cualquier `0.4.x`", no te sube solo a `0.5.0`,
y mucho menos a `1.x.x`). Actualizalo pidiendo la versión a mano:

```bash
npm install --save-dev @healify/cli@latest @healify/test-runner@latest
```

Esto no pasa la primera vez que instalás Healify en un proyecto nuevo (ahí ya te queda
`^1.0.0`, que sí sube de minor con un `npm install` normal).

**"El reporte menciona `Modo nube` / `HEALIFY_API_KEY` en versiones viejas de un
README."** Ese modo existió, pero el servidor que recibía esos reportes ya no existe en
este repo (se sacó junto con el SaaS completo, ver la sección "Historia" del README
raíz). Healify hoy es 100% local.

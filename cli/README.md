# @healify/cli

Aplica las sugerencias de un `healify-report.json` (generado por `@healify/test-runner`,
`@healify/cypress-plugin`, o por `flush()` de `@healify/selenium-plugin`/
`@healify/webdriverio-plugin`) directo en tus archivos de test. Cierra el loop entre
"Healify te sugirió un fix" y "el fix ya está en tu código", sin copiar y pegar a mano.

## Instalación

```bash
npm install --save-dev @healify/cli
```

## Para QA sin experiencia

Si nunca tocaste la configuración de Playwright/Cypress/Selenium/WebdriverIO, no hace
falta editar nada a mano. Tres comandos:

```bash
npx @healify/cli init     # detecta tu framework, instala lo que falta, configura y añade scripts npm
npx @healify/cli doctor   # revisa que esté todo bien instalado y configurado, con ✅/❌
npx @healify/cli fix      # corré esto después de tus tests, para aplicar los fixes sugeridos
```

**`npx @healify/cli init`** funciona en cualquier estado de tu proyecto y **no genera
ningún test**, nunca. Solo deja la config real conectada:

- **No tenés ningún framework de e2e todavía** → te pregunta cuál armar (Playwright,
  Cypress, Selenium o WebdriverIO, default Playwright si apretás Enter), instala el
  paquete y crea el config con el reporter/plugin de Healify ya wireado.
- **Ya tenés el framework instalado pero sin config** (típico en un proyecto Vite/Next que
  nunca llegó a tener `playwright.config.*`) → lo crea igual que en el caso anterior, sin
  preguntarte nada: el framework ya está decidido.
- **Ya tenés config pero sin Healify** → solo inyecta el reporter/plugin, no toca el resto
  de tu config.

Al terminar, `init` **añade scripts de conveniencia a tu `package.json`** (sin pisar los
que ya existen) y corre una **verificación instantánea** (`healify doctor`):

| Script | Comando | Para qué |
|---|---|---|
| `npm run healify` | `healify fix` | aplicar los fixes cuando un selector se rompa |
| `npm run healify:dry` | `healify fix --dry-run` | ver sugerencias sin tocar archivos (CI) |
| `npm run healify:dashboard` | `healify dashboard --serve` | ver tu histórico de curaciones |

Para ver qué haría sin ejecutar nada: `npx @healify/cli init --dry-run`.

Es seguro correrlo más de una vez: si algo ya está instalado o configurado, no lo toca de
nuevo (nunca pisa un archivo que ya generaste vos).

<details>
<summary><b>Playwright, de cero</b></summary>

```
$ npx @healify/cli init
Healify init — dejemos todo listo para tu primera curación.

1/4 Detectando tu framework de tests…
   ℹ No detectamos ningún framework de e2e — armamos playwright desde cero.

2/4 Instalando lo que falta…
   ✔ @healify/test-runner instalado

3/4 Conectando Healify…
   ✔ archivos creados:
     - playwright.config.ts

4/4 Scripts en tu package.json…
   ✔ "healify": healify fix
   ✔ "healify:dry": healify fix --dry-run
   ✔ "healify:dashboard": healify dashboard --serve

Verificación instantánea — healify doctor:
✔ Framework detectado: playwright
✔ @healify/test-runner instalado
✔ playwright.config.ts tiene Healify configurado

🎉 Listo. Tu primer "momento Healify" es así:
   1. Corré tus tests (los tuyos — Healify no te genera tests).
   2. Cuando un selector se rompa:  npm run healify
   3. Mirá lo que pasó:             npm run healify:dashboard

✅ Config lista. Healify no te genera tests: el primer selector que cure tiene que ser
   uno de tu propia app. Creá este archivo y editalo:

   e2e/mi-primer-test.spec.ts

   import { test, expect } from '@playwright/test'

   test('mi primer test', async ({ page }) => {
     await page.goto('/')
     await page.click('#reemplazar-por-tu-selector-real')
   })

   Reemplazá '#reemplazar-por-tu-selector-real' por un selector de tu app (un botón, un
   link, cualquier elemento que ya exista). Corré tus tests y, cuando ese selector se
   rompa, vas a tener healify-report.html.
```

`init` no crea ese archivo: te muestra qué escribir. El primer selector roto que Healify
cura tiene que ser uno de tu propia app, no uno inventado. El reporter ya está conectado,
no hace falta tocar nada más de la config.
</details>

<details>
<summary><b>Cypress, de cero</b></summary>

```
$ npx @healify/cli init
Healify init — dejemos todo listo para tu primera curación.

1/4 Detectando tu framework de tests…
   ℹ No detectamos ningún framework de e2e — armamos cypress desde cero.

2/4 Instalando lo que falta…
   ✔ @healify/cypress-plugin instalado

3/4 Conectando Healify…
   ✔ archivos creados:
     - cypress.config.ts
     - cypress/support/e2e.ts

4/4 Scripts en tu package.json…
   ✔ "healify": healify fix
   ✔ "healify:dry": healify fix --dry-run
   ✔ "healify:dashboard": healify dashboard --serve

Verificación instantánea — healify doctor:
✔ Framework detectado: cypress
✔ @healify/cypress-plugin instalado
✔ cypress.config.ts tiene Healify configurado

🎉 Listo. Tu primer "momento Healify" es así:
   1. Corré tus tests (los tuyos — Healify no te genera tests).
   2. Cuando un selector se rompa:  npm run healify
   3. Mirá lo que pasó:             npm run healify:dashboard

✅ Config lista. Healify no te genera tests: el primer selector que cure tiene que ser
   uno de tu propia app. Creá este archivo y editalo:

   cypress/e2e/mi-primer-test.cy.ts

   it('mi primer test', () => {
     cy.visit('/')
     cy.get('#reemplazar-por-tu-selector-real').click()
   })

   Reemplazá '#reemplazar-por-tu-selector-real' por un selector de tu app (un botón, un
   link, cualquier elemento que ya exista). Corré tus tests y, cuando ese selector se
   rompa, vas a tener healify-report.html.
```

`cypress/support/e2e.ts` es el archivo de soporte que Cypress exige para e2e testing (no
es nada de Healify). Queda vacío, listo para lo que necesites. Ningún test se genera acá
tampoco.
</details>

<details>
<summary><b>Selenium, de cero</b></summary>

```
$ npx @healify/cli init
Healify init — dejemos todo listo para tu primera curación.

1/4 Detectando tu framework de tests…
   ℹ No detectamos ningún framework de e2e — armamos selenium desde cero.

2/4 Instalando lo que falta…
   ✔ @healify/selenium-plugin instalado

3/4 Conectando Healify…
   ✔ archivos creados:
     - healify.selenium.example.ts

4/4 Scripts en tu package.json…
   ✔ "healify": healify fix
   ✔ "healify:dry": healify fix --dry-run
   ✔ "healify:dashboard": healify dashboard --serve

✅ Instalado. Ver healify.selenium.example.ts para el patrón de wrap() — copialo a tu
   código real, no hay nada que ejecutar acá.
```

Selenium no tiene config para wirear (se envuelve el `WebDriver` a mano). El archivo que
`init` deja es solo documentación de referencia, nunca se ejecuta ni simula ningún
resultado: muestra cómo envolver tu `WebDriver` real con `HealifySeleniumPlugin`.
</details>

<details>
<summary><b>WebdriverIO, de cero</b></summary>

```
$ npx @healify/cli init
Healify init — dejemos todo listo para tu primera curación.

1/4 Detectando tu framework de tests…
   ℹ No detectamos ningún framework de e2e — armamos webdriverio desde cero.

2/4 Instalando lo que falta…
   ✔ @healify/webdriverio-plugin instalado

3/4 Conectando Healify…
   ✔ archivos creados:
     - healify.wdio.example.ts

4/4 Scripts en tu package.json…
   ✔ "healify": healify fix
   ✔ "healify:dry": healify fix --dry-run
   ✔ "healify:dashboard": healify dashboard --serve

✅ Instalado. Ver healify.wdio.example.ts para el patrón de wrap() — copialo a tu código
   real, no hay nada que ejecutar acá.
```

Igual que Selenium, WebdriverIO no tiene config ni hook de "fin de corrida" que Healify
pueda usar (se envuelve el `browser` a mano). El archivo que `init` deja es solo
documentación de referencia, nunca se ejecuta ni simula ningún resultado.
</details>

**baseURL automático (Playwright/Cypress):** `init` busca el puerto real de tu app en este
orden: primero el script `"dev"` de tu `package.json` (ej. `vite --port=3000` da
`http://localhost:3000`, el caso más común en proyectos Vite reales, donde el puerto casi
nunca está en `vite.config.*`), después `server.port` dentro de `vite.config.*`/
`next.config.*` si existe, y si no encuentra ninguna pista: `5173` (default de Vite) o
`3000` (default de Next). TS o JS también se detecta solo (según haya `tsconfig.json`).

**`npx @healify/cli doctor`** no modifica nada, solo revisa: ¿hay un framework soportado?,
¿está instalado el paquete de Healify?, ¿el config lo tiene wireado?, ¿ya generaste un
`healify-report.json` corriendo tus tests? Cada check en rojo viene con la línea exacta
para arreglarlo.

**`npx @healify/cli fix`**, una vez que corriste tus tests y tenés `healify-report.json`,
aplica las sugerencias de mayor confianza directo en tus archivos (ver detalle abajo).

## Tu primer test, paso a paso

Healify no genera tests, así que después de `init` no hay nada para correr todavía: si
hacés `npx playwright test` en ese momento vas a ver `No tests found`, y está bien. Falta
que escribas el primero. Este es el mínimo.

**Playwright** — creá `e2e/mi-primer-test.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('mi primer test', async ({ page }) => {
  await page.goto('/')
  await page.click('#reemplazar-por-tu-selector-real')
})
```

**Cypress** — creá `cypress/e2e/mi-primer-test.cy.ts`:

```ts
it('mi primer test', () => {
  cy.visit('/')
  cy.get('#reemplazar-por-tu-selector-real').click()
})
```

Qué hace cada línea:

- `goto('/')` / `visit('/')` abre el navegador en la `baseURL` que `init` dejó en tu config.
  `/` es la home; podés poner `/login` o la ruta que quieras probar.
- `click(...)` busca un elemento y le hace click. **Ese selector es el que Healify va a
  curar cuando se rompa**; el resto del test es andamiaje.
- `#reemplazar-por-tu-selector-real` es un placeholder: no existe en ninguna app. Cambialo
  por uno tuyo o el test falla por el motivo equivocado.

`init` te imprime este mismo snippet al terminar, ya ajustado a tu proyecto: si no tenés
TypeScript te lo da en `.js`, y si además tu `package.json` es CommonJS te cambia el
`import` por `const { test, expect } = require('@playwright/test')`. Copiá el que te
imprimió a vos.

Para sacar un selector real de tu app: abrila en el navegador, click derecho sobre el
elemento → *Inspeccionar*, y en el HTML buscá un `id` (`#mi-id`) o un `data-testid`
(`[data-testid="mi-id"]`). Si no hay ninguno, sirve una clase (`.mi-clase`) — más frágil,
que es justamente lo que Healify detecta y mejora.

Antes de correr nada, levantá tu app (`npm run dev`) y confirmá que responde en esa URL: un
test e2e abre un navegador de verdad contra un servidor de verdad.

> **Corré el framework que ya tenés.** Si `doctor` te detectó Playwright, usá
> `npx playwright test`. Correr `npx cypress run` en un proyecto que solo tiene Playwright
> configurado falla por falta de Cypress, no por Healify — no hace falta instalar los dos.

## Uso

```bash
npx @healify/cli fix                       # busca ./healify-report.json
npx @healify/cli fix ruta/al/reporte.json   # ruta explícita
npx @healify/cli fix --dry-run              # muestra qué haría, no escribe nada
npx @healify/cli fix --force                # ignora el chequeo de git working tree sucio
npx @healify/cli fix --interactive          # pregunta caso por caso, en vez de aplicar todo solo
npx @healify/cli --version                  # (o -v) muestra qué versión tenés instalada
```

> **¿`fix` te dice "No encontré healify-report.json"?** No es un error: es lo normal si
> todavía no corriste tus tests, o si pasaron todos (no hubo selectores rotos que
> reportar). Corré tus tests; cuando alguno falle por un selector, se genera el reporte y
> `fix` va a tener algo que aplicar. (Sale con código 0, no rompe pipelines.)
>
> **¿Sospechás tener una versión vieja?** Los paquetes de Healify están en `1.0.0`. Si tu
> `package.json` todavía tiene un rango `^0.x.y` de antes de la 1.0.0, un `npm install` a
> secas NO te sube de minor (gotcha de semver en versiones `0.x`, `doctor` te lo detecta).
> Chequeá con `npx @healify/cli --version` y actualizá con `@latest` si hace falta.

Salida típica:

```
Healify fix — healify-report.json

✓ e2e/checkout.spec.ts — #add-to-cart-btn → [data-testid="add-to-cart"]
⚠ e2e/login.spec.ts — saltado: 'button.submit' aparece más de una vez, ambiguo
⚠ e2e/cart.spec.ts — saltado: cambios sin commitear (usá --force para ignorar)

1 selector aplicado · 2 salteados · 1 caso "review" sin tocar (ver healify-report.html)
```

## Qué toca y qué no

Por default, solo aplica casos con confianza ≥90% (`status: 'healed'` en el reporte). Es el
mismo umbral que ya usa `reporter-core` para decidir si algo es lo bastante confiable como
para no pedir revisión. Los casos `review`/`unresolved` no se tocan solos: quedan para que
los revises a mano en `healify-report.html`, o con `--interactive` (ver abajo).

## Modo interactivo

```bash
npx @healify/cli fix --interactive
```

```
[1/2] e2e/checkout.spec.ts
  #comprar-ahora-a1b2c3
  → role('button', { name: 'Comprar' })
  97% · verificado en la página
  Aplicar? [S/n/a/q]
```

En vez de aplicar todo lo que supera el umbral solo, te muestra cada sugerencia — selector
original, propuesta, confianza, y de dónde sale (verificada en esta corrida, del repertorio
de una corrida anterior, o heurística sin comprobar) — y te pregunta.

También ofrece los casos `review` (80-89%), que `fix` normal nunca toca: el default al tocar
Enter es **No** para esos (el motor mismo no está seguro), pero si vos decidís que tiene
sentido, se aplica igual. `healed` tiene default **Sí**.

Comandos, además de `s`/`n`: `a` aplica el resto sin seguir preguntando, `q` deja el resto
sin tocar (se cuenta como salteado, no como "sin revisar"). Necesita una terminal real — si
`fix --interactive` corre en CI o detrás de un pipe, avisa que no hay cómo preguntar y sigue
en modo automático en vez de colgarse esperando un input que nunca va a llegar.

Conservador a propósito, nunca adivina:

| Situación | Qué hace |
|---|---|
| El selector aparece 0 veces en el archivo | Salta, avisa "ya no se encontró" |
| El selector aparece 2+ veces | Salta, avisa "ambiguo", no elige cuál |
| El archivo tiene cambios sin commitear en git | Salta, avisa (a menos que uses `--force` o `--dry-run`) |
| La sugerencia es tipo `role('button', { name: 'X' })` y usaste `--no-ast` | Salta: es texto legible para el reporte, no un valor de selector pegable, y aplicarlo tal cual corrompería el archivo. Sin `--no-ast` se reescribe la llamada completa (ver abajo) |

## Reescritura de sugerencias por rol

Las sugerencias `role('button', { name: 'X' })` no son un valor de selector pegable: hace
falta reescribir la llamada completa.

```diff
- await page.click('#comprar-ahora-a1b2c3')
+ await page.getByRole('button', { name: 'Comprar' }).click()
```

Eso es un cambio estructural, no textual, así que `fix` usa [`ts-morph`](https://ts-morph.com/)
para hacerlo de verdad sobre el AST del archivo. Viene activado por defecto; se apaga con
`--no-ast`.

Es aditivo: primero aplica todo lo que se puede reemplazar como texto (TESTID/CSS/TEXT, que ya
son selectores pegables), y solo para lo que quedó como "no sustituible" intenta la
reescritura. Métodos de Playwright soportados hoy: `click`, `fill`, `type`, `check`,
`uncheck`, `selectOption`, `hover`, `focus`, `blur`, `tap`, `dblclick`, `press`, y
`locator(...)` dentro de un `expect(...)`. Mismas reglas conservadoras que el resto de `fix`:
git limpio (salvo `--force`), selector único en el archivo, nunca adivina.

## Historial de curaciones (el repertorio)

Cada `healify fix` (sin `--dry-run`) graba todos los casos de esa corrida
(healed/review/unresolved, no solo lo que `fix` pudo aplicar) en `.healify/history.jsonl`
(append-only, un archivo local por proyecto). `--dry-run` nunca graba, para no ensuciar el
historial con corridas de CI (ej. el gh-action, que corre `fix --dry-run` en cada PR).

Este archivo no es solo un log: el motor lo **consulta**. Las entradas que se confirmaron
contra la página real (Playwright, Selenium o WebdriverIO cuando pudieron verificar) quedan
disponibles para corridas futuras que no puedan verificar nada por su cuenta — típicamente
Cypress, que nunca tiene ese dato. Si el mismo selector, en el mismo archivo, ya se curó y se
confirmó antes, se reusa esa corrección en vez de adivinar de nuevo a ciegas. La verificación
en vivo de la corrida actual siempre gana por sobre el repertorio.

```bash
npx @healify/cli history
```

Muestra los selectores que más se repiten rotos, y los que se curaron con confianza antes
y volvieron a aparecer rotos después (aproximado: no distingue si `fix` realmente aplicó
el cambio al archivo o lo salteó por ambiguo/git sucio, solo si el motor lo curó con
confianza la primera vez). Si todavía no corriste `fix` sin `--dry-run`, te lo dice en vez
de fallar.

Se recomienda agregar `.healify/` al `.gitignore` de tu proyecto: es historial local de
esa máquina, no algo para versionar (mismo criterio que `test-results/`).

## `heal`/`probe-script`: el motor para otros lenguajes

```bash
echo '{"selector": "#comprar-ahora-a1b2c3"}' | npx @healify/cli heal
npx @healify/cli probe-script
```

Pensados para invocarse desde un subproceso, no a mano: son el puente que usan los adapters
de referencia de Python/Java/C# en [`docs/adapters/`](../docs/adapters/) para que equipos que
no automatizan en JS también puedan usar el motor. `heal` recibe JSON por stdin (selector,
opcionalmente el DOM sondeado y el archivo del test) y devuelve JSON con la sugerencia y un
`locator` ya resuelto a CSS o XPath, listo para reintentar con cualquier driver. El contrato
completo está en [`docs/adapters/README.md`](../docs/adapters/README.md).

## Licencia

MIT

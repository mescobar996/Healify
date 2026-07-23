# @healify/cli

Aplica las sugerencias de un `healify-report.json` (generado por `@healify/test-runner` o
`@healify/cypress-plugin`) directo en tus archivos de test. Cierra el loop entre
"Healify te sugirió un fix" y "el fix ya está en tu código", sin copiar y pegar a mano.

## Instalación

```bash
npm install --save-dev @healify/cli
```

## Para QA sin experiencia

Si nunca tocaste la configuración de Playwright/Cypress/Selenium, no hace falta editar
nada a mano. Tres comandos:

```bash
npx @healify/cli init     # detecta tu framework, instala el paquete correcto y configura todo
npx @healify/cli doctor   # revisa que esté todo bien instalado y configurado, con ✅/❌
npx @healify/cli fix      # corré esto después de tus tests, para aplicar los fixes sugeridos
```

**`npx @healify/cli init`** funciona en cualquier estado de tu proyecto:

- **No tenés ningún framework de e2e todavía** → te pregunta cuál armar (Playwright,
  Cypress o Selenium — default Playwright si apretás Enter) y arma todo desde cero: instala
  el paquete, crea el config con el reporter/plugin de Healify ya wireado, y un test demo
  con un selector roto a propósito para que veas el primer `healify-report.html` sin
  escribir nada a mano.
- **Ya tenés el framework instalado pero sin config** (típico en un proyecto Vite/Next que
  nunca llegó a tener `playwright.config.*`) → lo scaffoldea igual que en el caso anterior,
  sin preguntarte nada — el framework ya está decidido.
- **Ya tenés config pero sin Healify** → solo inyecta el reporter/plugin, no toca el resto
  de tu config.

Es seguro correrlo más de una vez: si algo ya está instalado o configurado, no lo toca de
nuevo (nunca pisa un archivo que ya generaste vos).

<details>
<summary><b>Playwright — de cero</b></summary>

```
$ npx @healify/cli init
Healify init

ℹ No detectamos ningún framework de e2e — armamos playwright desde cero.

✅ @healify/test-runner instalado
✅ archivos creados:
   - playwright.config.ts
   - e2e/healify.demo.spec.ts
   - e2e/.gitkeep

✅ Listo. Corré npx playwright test
```

`e2e/healify.demo.spec.ts` falla a propósito (selector `[data-testid="demo-boton-roto-healify"]`
que no existe) — corré `npx playwright test` con tu app levantada (`npm run dev`) y vas a ver
`healify-report.html` con esa cura ya clasificada como `healed`. Borrá el demo cuando lo viste.
</details>

<details>
<summary><b>Cypress — de cero</b></summary>

```
$ npx @healify/cli init
Healify init

ℹ No detectamos ningún framework de e2e — armamos cypress desde cero.

✅ @healify/cypress-plugin instalado
✅ archivos creados:
   - cypress.config.ts
   - cypress/e2e/healify.demo.cy.ts
   - cypress/support/e2e.ts

✅ Listo. Corré npx cypress open
```

Mismo selector demo, mismo resultado: corré `npx cypress run` (o `open`) con tu app
levantada y vas a ver el mismo `healed` en el reporte.
</details>

<details>
<summary><b>Selenium — de cero</b></summary>

```
$ npx @healify/cli init
Healify init

ℹ No detectamos ningún framework de e2e — armamos selenium desde cero.

✅ @healify/selenium-plugin instalado
✅ archivos creados:
   - healify.selenium.example.ts
   - e2e/selenium.demo.test.ts

✅ Listo. Corré npx tsx e2e/selenium.demo.test.ts
```

Selenium no tiene config para wirear (se envuelve el `WebDriver` a mano, ver
`healify.selenium.example.ts`). El demo (`e2e/selenium.demo.test.ts`) es un script
ejecutable que no depende de tu app — navega a una página mínima autocontenida, así que
podés correrlo sin levantar nada. Requiere ChromeDriver instalado.
</details>

**baseURL automático (Playwright/Cypress):** `init` busca el puerto real de tu app en este
orden — script `"dev"` de tu `package.json` (ej. `vite --port=3000` → `http://localhost:3000`,
el caso más común en proyectos Vite reales, donde el puerto casi nunca está en
`vite.config.*`), después `server.port` dentro de `vite.config.*`/`next.config.*` si existe,
y si no encuentra ninguna pista: `5173` (default de Vite) o `3000` (default de Next). TS o
JS también se detecta solo (según haya `tsconfig.json`).

**`npx @healify/cli doctor`** — no modifica nada, solo revisa: ¿hay un framework soportado?,
¿está instalado el paquete de Healify?, ¿el config lo tiene wireado?, ¿ya generaste un
`healify-report.json` corriendo tus tests? Cada check en rojo viene con la línea exacta
para arreglarlo.

**`npx @healify/cli fix`** — una vez que corriste tus tests y tenés `healify-report.json`,
aplica las sugerencias de mayor confianza directo en tus archivos (ver detalle abajo).

## Uso

```bash
npx @healify/cli fix                       # busca ./healify-report.json
npx @healify/cli fix ruta/al/reporte.json   # ruta explícita
npx @healify/cli fix --dry-run              # muestra qué haría, no escribe nada
npx @healify/cli fix --force                # ignora el chequeo de git working tree sucio
```

Salida típica:

```
Healify fix — healify-report.json

✓ e2e/checkout.spec.ts — #add-to-cart-btn → [data-testid="add-to-cart"]
⚠ e2e/login.spec.ts — saltado: 'button.submit' aparece más de una vez, ambiguo
⚠ e2e/cart.spec.ts — saltado: cambios sin commitear (usá --force para ignorar)

1 selector aplicado · 2 salteados · 1 caso "review" sin tocar (ver healify-report.html)
```

## Qué toca y qué no

Solo aplica casos con confianza ≥90% (`status: 'healed'` en el reporte). Es el mismo
umbral que ya usa `reporter-core` para decidir si algo es lo bastante confiable como para
no pedir revisión. Los casos `review`/`unresolved` nunca se tocan: quedan para que los
revises a mano en `healify-report.html`.

Conservador a propósito, nunca adivina:

| Situación | Qué hace |
|---|---|
| El selector aparece 0 veces en el archivo | Salta, avisa "ya no se encontró" |
| El selector aparece 2+ veces | Salta, avisa "ambiguo", no elige cuál |
| El archivo tiene cambios sin commitear en git | Salta, avisa (a menos que uses `--force` o `--dry-run`) |
| La sugerencia es tipo `role('button', { name: 'X' })` | Salta: es texto legible para el reporte, no un valor de selector pegable; aplicarlo tal cual corrompería el archivo |

## Licencia

MIT

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

**`npx @healify/cli init`** — lee tu `package.json` y tus archivos de config para detectar si
usás Playwright, Cypress o Selenium (podés tener más de uno). Instala automáticamente el
paquete de Healify que corresponda (`@healify/test-runner`, `@healify/cypress-plugin` o
`@healify/selenium-plugin`) si todavía no lo tenés, y edita tu `playwright.config.*` o
`cypress.config.*` para dejarlo wireado. Es seguro correrlo más de una vez: si algo ya
está instalado o configurado, no lo toca de nuevo. Si no detecta ningún framework
soportado, te lo dice en vez de romper algo.

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

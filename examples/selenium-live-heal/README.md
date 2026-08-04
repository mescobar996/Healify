# Ejemplo: Selenium + cura en vivo

Lo que hace distinto a Selenium: **no cambiás una sola línea de tu test.**

```js
const driver = await new Builder().forBrowser('chrome').build()
const healed = plugin.wrap(driver)   // ← esto es todo
```

`healed` es el mismo driver de siempre. La diferencia aparece únicamente cuando un
`findElement` no encuentra nada: ahí Healify sondea el DOM real, encuentra el elemento por rol
y nombre accesible, y devuelve ese, en vez de tirar `NoSuchElementError`.

## Corrélo

```bash
npm install
node serve.mjs &
npm test
```

El test **pasa**. Y busca un selector que no existe:

```js
await (await healed.findElement(By.css('#save-btn-a1b2c3'))).click()
```

El id real es `#save-btn-4f2a9c`. Y el botón está dentro del shadow root de `<save-panel>`, así
que `document.querySelector` no lo encuentra ni con el id correcto.

## Qué pasó adentro

1. `findElement` falla con `NoSuchElementError`
2. Healify le pregunta al browser qué hay en la página, **atravesando shadow roots abiertos**
3. Encuentra un `button` cuyo nombre accesible es *"Guardar cambios"*
4. Lo busca de nuevo con ese criterio y devuelve el elemento

Al terminar, `plugin.flush()` deja `healify-report.json` con lo que se curó y por qué. En este
caso: `verified: true`, porque la sugerencia se confrontó contra el DOM real de esa corrida.

## Dos bugs que encontró este ejemplo

Vale la pena contarlos porque explican por qué los ejemplos viven acá adentro y corren en CI.

**El reintento no podía volver al shadow root.** El sondeo entraba y proponía bien, pero el
reintento resolvía con `By.xpath()`, y XPath no atraviesa shadow DOM. La sugerencia era
correcta e inalcanzable. El mismo bug que ya se había arreglado en Cypress, presente también
acá y en WebdriverIO.

**Y uno peor: el adapter no curaba nunca.** La guarda de entrada era
`err instanceof error.NoSuchElementError`. Basta con que haya dos instancias del módulo
`selenium-webdriver` en el árbol (un monorepo, un install de pnpm, dos versiones) para que eso
dé `false` sobre un error que sí lo es. El wrapper salía por ahí antes de sondear nada.

Ninguno de los dos aparecía en los tests unitarios: ahí el mock y el plugin comparten instancia,
así que `instanceof` funciona siempre y el shadow DOM nunca entra en juego.

## Notas

`plugin.wrap()` intercepta `findElement`. El resto de los métodos del driver pasan sin tocarse.

Healify no reintenta cualquier cosa: solo actúa si la confianza de la sugerencia supera el
umbral (0.9 por default, configurable). Si no llega, deja pasar el error original en lugar de
mandarte a un elemento equivocado.

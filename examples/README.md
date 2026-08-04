[← Volver a Healify](../README.md) · [Documentación](../docs/)

---

# Ejemplos

Proyectos completos, no snippets. Cada uno se clona, se corre y hace lo que dice.

**No están acá de adorno: CI los ejecuta contra un browser real en cada commit.** Si alguno
dejara de funcionar, el build se pone en rojo. Un ejemplo que se pudre en silencio es peor que
no tener ejemplo.

## [Playwright + Page Object Model](playwright-pom/)

El caso más común en equipos serios: **el selector no está en el test, está en un page object.**

```
e2e/checkout.spec.ts     ← el test que falla. Cero selectores acá.
pages/shop.page.ts       ← donde vive el selector roto
```

El test falla → `healify fix` → cura `pages/shop.page.ts` y te dice en qué archivo lo tocó → el
test pasa.

> Es lo que Healenium resuelve con un plugin de IntelliJ más un backend Postgres.

```bash
cd examples/playwright-pom && npm install && npm test
```

## [Cypress + Shadow DOM](cypress-shadow-dom/)

El caso donde casi todas las herramientas se quedan ciegas: **el elemento no está en el
documento.** Vive dentro de un web component.

Abrí la consola en esa página y probá `document.querySelectorAll('button').length` → **0**.
No hay ningún botón. Está detrás de una frontera de shadow DOM, como en Salesforce Lightning,
Ionic, Lit o Vaadin.

El test usa un selector que no existe **y pasa igual**: Healify entra al shadow root, encuentra
el botón por su nombre accesible y hace el click. Nadie tocó código.

```bash
cd examples/cypress-shadow-dom && npm install && node serve.mjs & npx cypress run
```

## [Selenium + cura en vivo](selenium-live-heal/)

El caso donde **no se toca una sola línea del test**:

```js
const healed = plugin.wrap(driver)   // ← esto es todo
```

`healed` es el mismo driver de siempre. La diferencia aparece solo cuando un `findElement` no
encuentra nada: ahí Healify sondea el DOM real —shadow roots incluidos— y devuelve el elemento
en vez de tirar `NoSuchElementError`.

```bash
cd examples/selenium-live-heal && npm install && node serve.mjs & npm test
```

---

Los tres ejemplos encontraron bugs reales en features ya publicadas, invisibles para 715 tests
unitarios. Cuatro bugs en total, uno de ellos tan grave que el adapter de Selenium no curaba
absolutamente nunca.

Correr las cosas de verdad sigue siendo el mejor detector que tiene este proyecto. Por eso los
tres corren en CI contra browsers reales, y por eso no alcanza con que el test quede en verde:
`scripts/assert-healed.mjs` exige que el reporte diga `healed` **y** `verified: true`. Si alguien
arreglara el HTML de un demo, el test seguiría pasando y el ejemplo pasaría a mentir.

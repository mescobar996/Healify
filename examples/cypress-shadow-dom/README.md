# Ejemplo: Cypress + Shadow DOM

El caso donde casi todas las herramientas de self-healing se quedan ciegas: **el elemento no
está en el documento.** Vive dentro del shadow root de un web component.

```
app/index.html                  ← un <checkout-widget> con shadow DOM abierto
cypress/e2e/checkout.cy.js      ← el test, con el selector roto
```

Abrí la consola del browser en esa página y probá:

```js
document.querySelectorAll('button').length   // 0
```

No hay ningún botón. Está detrás de una frontera de shadow DOM — como en Salesforce Lightning,
Ionic, Lit o Vaadin.

## Corrélo

```bash
npm install
node serve.mjs &      # la app del ejemplo, en :4322
npx cypress run
```

El test **pasa**. Y eso es lo interesante, porque el selector que usa **no existe**:

```js
cy.healifyGet('#pay-btn-a1b2c3').click()   // el id real es #pay-btn-7c4d2e
```

## Qué pasó adentro

1. `cy.healifyGet()` se comporta igual que `cy.get()` hasta que el selector falla
2. Ahí sondea el DOM real **atravesando shadow roots abiertos**, y encuentra un `button` cuyo
   nombre accesible es *"Pagar ahora"*
3. Vuelve a buscarlo —también atravesando shadow roots— y hace el click

El test nunca se puso en rojo. Nadie tocó código. Y el reporte queda con el registro de qué se
curó y por qué.

## Por qué esto es difícil

`document.querySelector` no atraviesa shadow DOM. `document.evaluate` (XPath) tampoco. Ninguna
de las dos formas estándar de encontrar un elemento sirve acá, por especificación — no es una
limitación de Cypress, es cómo funciona la plataforma.

Healify camina los shadow roots explícitamente, con el mismo criterio de nombre accesible en
las dos direcciones: para **ver** qué hay, y para **volver a encontrar** lo que propuso. Si esos
dos criterios no coincidieran, la sugerencia sería correcta pero irrecuperable.

> Este ejemplo encontró exactamente ese bug: hasta la 2.1.0, el sondeo veía el botón y proponía
> bien, pero el reintento usaba XPath y no llegaba. Estaba a medias, y nadie se había dado
> cuenta porque los tests unitarios cubrían las dos mitades por separado.

## Diferencia con `cy.get()`

`cy.healifyGet()` es un comando **nuevo**, opt-in. No pisa `cy.get()` ni el motor de retry de
Cypress: lo usás solo donde querés cura en vivo. Si preferís que Cypress falle normalmente y
curar después, con `cy.get()` de siempre alcanza — Healify igual reporta el selector roto y
`healify fix` te lo aplica en el código.

`includeShadowDom: true` en `cypress.config.js` es lo que le permite a Cypress *buscar* dentro
del shadow root. Es independiente de Healify, y lo necesitás igual.

# Ejemplo: Playwright + Page Object Model

El caso que rompe a casi todas las herramientas de self-healing: **el selector no está en el
test, está en un page object.**

```
e2e/checkout.spec.ts     ← el test que falla. Cero selectores acá.
pages/shop.page.ts       ← donde vive el selector roto
app/index.html           ← una tienda de mentira, HTML plano, sin build
```

## Corrélo

```bash
npm install
npx playwright install chromium   # solo la primera vez
npm test
```

El test **falla**. Es a propósito: `pages/shop.page.ts` apunta a `#buy-btn-a1b2c3`, y el botón
real tiene otro id — como cuando el bundler regenera los hashes en un deploy.

```
✘ agrega un producto al carrito
  waiting for locator('#buy-btn-a1b2c3')
```

Ahora:

```bash
npx healify fix
```

```
✓ pages/shop.page.ts (page object de e2e/checkout.spec.ts)
  #buy-btn-a1b2c3 → role=button[name="Agregar al carrito"]

1 selector aplicado · 0 salteados
```

Y de nuevo `npm test` → **pasa.**

## Qué acaba de pasar

Healify no adivinó. Cuando el test falló, Playwright guardó el árbol de accesibilidad de la
página en ese momento exacto, y Healify lo leyó: ahí había un `button` cuyo nombre accesible
era *"Agregar al carrito"*. La sugerencia sale **verificada contra esa evidencia**, no deducida
del texto del selector viejo.

Después buscó el selector. No estaba en el spec — normal, ahí no hay selectores. Lo encontró en
`pages/shop.page.ts` y aplicó el cambio ahí, avisando en qué archivo lo tocó.

**Por qué `role=button[name="..."]` y no `#otro-id`:** el id nuevo también va a cambiar en el
próximo deploy. El rol y el nombre accesible, no — mientras el botón siga siendo un botón que
dice "Agregar al carrito", el selector aguanta. Esa es la diferencia entre curar un test y
patearlo para adelante.

## Conservador por diseño

`fix` solo toca el page object si encuentra **un** archivo con **una** ocurrencia del selector.
Si el mismo selector aparece en dos page objects, no adivina: reporta ambiguo y no toca nada.
Podés ver qué haría sin que escriba nada:

```bash
npx healify fix --dry-run
```

Y si querés dejarlo escuchando mientras trabajás:

```bash
npx healify fix --watch
```

## Lo que también vas a encontrar

Cada corrida deja `healify-report.html` — el reporte que le mandás al equipo, con el antes y
después, el nivel de confianza, y si la sugerencia se verificó contra el DOM real o es una
heurística. Abrilo, es 100% offline.

---

> **Nota honesta:** en este ejemplo el `fix` se aplica como string (`role=button[name="..."]`)
> porque el selector vive en un page object y la llamada está en otro archivo. Cuando el
> selector está **en el propio spec**, Healify hace algo mejor: reescribe la llamada entera con
> AST, `page.click('#x')` → `page.getByRole('button', { name: 'X' })`. Las dos formas funcionan;
> la segunda es más idiomática y solo es posible cuando el call site está a la vista.

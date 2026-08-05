# Healify para VS Code

Los selectores frágiles se ven en el editor. Los que ya se rompieron se arreglan con `Ctrl+.`.

## Dos niveles, y la diferencia importa

**Amarillo — mientras escribís.** Healify reconoce las formas que envejecen mal: ids
autogenerados, XPath posicionales, nombres de clase de utilidad. Te lo dice y **no te propone
un reemplazo**.

Eso no es una limitación pendiente de resolver, es la parte honesta. Sin haber visto la
página, cualquier nombre concreto sería inventado: preguntarle al motor por `#btn-a1b2c3`
devuelve `role('button', { name: 'Submit' })`, y ese *"Submit"* no salió de ningún lado.

**Rojo — después de correr los tests.** Acá Healify sí vio la página: sabe que el elemento
existe y cómo se llama de verdad. El diagnóstico trae el reemplazo real y `Ctrl+.` lo aplica.

> Un selector nunca recibe un reemplazo concreto sin haber sido confrontado contra una página
> real. Es la propiedad que sostiene toda la extensión, y hay tests —unitarios y dentro de un
> VS Code de verdad— que fallan si alguna vez deja de cumplirse.

## Instalar

```bash
code --install-extension healify-vscode-0.1.0.vsix
```

Necesita `@healify/cli` en el proyecto para aplicar las correcciones estructurales y para el
panel:

```bash
npm install --save-dev @healify/cli
```

## Cómo se usa

1. Escribís tests. Los selectores frágiles quedan subrayados en amarillo.
2. Corrés la suite. Healify escribe `healify-report.json`.
3. Lo que se rompió pasa a rojo, con el reemplazo verificado. `Ctrl+.` y listo.

El paso 3 no necesita que hagas nada: la extensión mira el reporte y actualiza los subrayados
apenas termina la corrida.

## Comandos

| | |
|---|---|
| `Healify: Abrir panel` | El histórico de curaciones y tests flaky, al lado del código |
| `Healify: Re-analizar el archivo actual` | Fuerza una relectura del reporte |

## Configuración

| | Default | |
|---|---|---|
| `healify.liveLint` | `true` | Los subrayados amarillos. Apagalo si solo querés los del reporte |
| `healify.reportPath` | `""` | Vacío = busca en `.healify/` y en la raíz, igual que el CLI |

## Frameworks

Playwright, Cypress, Selenium y WebdriverIO. Reconoce `page.click`, `cy.get`, `By.css`,
`$`, `findElement` y el resto de las llamadas que reciben selectores.

Los template literals quedan afuera a propósito: si tienen `${}`, el valor no se conoce sin
ejecutar el test.

## Cómo se verifica

`src/core/` no importa `vscode` y se testea con vitest. La capa del editor se prueba en un
VS Code real levantado con `@vscode/test-electron` — mockear esa API probaría el mock.

```bash
npm test              # el núcleo, sin editor
npm run test:integration   # VS Code de verdad
```

Los dos corren en CI en cada commit. Los cuatro bugs que Healify tuvo esta semana los
encontraron los ejemplos al correr de verdad, no los tests unitarios; escribir esta extensión
destapó dos más, incluido uno que la habría dejado ciega a **todos** los XPath.

## Licencia

MIT — parte de [Healify](https://github.com/mescobar996/Healify).

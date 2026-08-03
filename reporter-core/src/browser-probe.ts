import { formatPageElements, type PageElement } from './page-snapshot'

/**
 * Script que corre DENTRO del browser (vía `driver.executeScript()` de Selenium o
 * `browser.execute()` de WebdriverIO), no en Node — por eso es un string y no una función TS:
 * es el cuerpo de función que el protocolo WebDriver manda tal cual al motor de JS del browser.
 *
 * A diferencia de Playwright (que guarda el árbol de accesibilidad después del fallo, en un
 * archivo), acá se consulta el DOM en vivo en el momento exacto en que el `findElement`/`click`
 * original falló — Selenium y WebdriverIO ya tienen el browser abierto en la mano, no hace
 * falta que ningún framework les regale nada.
 *
 * Devuelve `{ role, name, frame? }[]` de los elementos interactivos de la página, con el mismo
 * criterio de nombre accesible en toda la escalera: aria-label, texto visible, placeholder,
 * valor — el primero que exista.
 *
 * **Atraviesa shadow DOM abierto e iframes same-origin.** Un `querySelectorAll` plano sobre
 * `document` no ve nada dentro de un `shadowRoot`: en una app hecha con web components
 * (Salesforce Lightning, Ionic, Lit, Vaadin) devolvía una lista vacía y el motor caía en
 * silencio a la heurística a ciegas — justo donde más falta hacía la evidencia. Lo mismo con
 * los iframes (checkouts embebidos, widgets de pago). Por eso el scan es recursivo:
 *
 * - `el.shadowRoot` solo existe para shadow roots **abiertos**; los `closed` son inaccesibles
 *   por especificación y no se intentan.
 * - `iframe.contentDocument` tira `SecurityError` en cross-origin: va envuelto en `try/catch`
 *   para que un iframe de ads no mate el scan entero.
 * - Los elementos que están adentro de un iframe se marcan con `frame` (`iframe#checkout`),
 *   porque un locator a nivel top NO los encuentra: hay que cambiar de contexto primero, y
 *   callarlo sería peor que no sugerir nada.
 * - `MAX_DEPTH`/`MAX_NODES` acotan el costo en una página patológica.
 *
 * ES5 a propósito (var, sin arrow functions): corre en cualquier motor de JS que el browser
 * bajo test tenga, sin asumir soporte moderno.
 */
export const BROWSER_PROBE_SCRIPT = `
var MAX_DEPTH = 12;
var MAX_NODES = 3000;
var results = [];

function healifyRoleOf(el, tag) {
  var role = el.getAttribute('role');
  if (role) return role;
  if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
  if (tag === 'button') return 'button';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'submit' || type === 'button') return 'button';
    if (type === 'search') return 'searchbox';
    if (type === 'hidden') return null;
    return 'textbox';
  }
  return null;
}

function healifyNameOf(el) {
  var ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  var text = (el.innerText || el.textContent || '').trim();
  if (text) return text.split('\\n')[0].trim();
  var placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder.trim();
  if (typeof el.value === 'string' && el.value.trim()) return el.value.trim();
  return '';
}

/* Identificador del iframe, para que el usuario sepa a qué contexto cambiar. Se elige la
   forma que además sea un selector CSS válido, así se puede pegar tal cual en
   frameLocator()/switchTo().frame(). Se sacan comillas y saltos de línea, que sí romperían
   el formato "[frame=...]" del snapshot (los corchetes no: el parser ancla al final de línea). */
function healifyFrameLabel(el, index) {
  var raw = el.getAttribute('id')
    ? 'iframe#' + el.getAttribute('id')
    : el.getAttribute('name')
      ? 'iframe[name=' + el.getAttribute('name') + ']'
      : el.getAttribute('src')
        ? 'iframe[src=' + el.getAttribute('src') + ']'
        : 'iframe:nth-of-type(' + (index + 1) + ')';
  return raw.replace(/[\\r\\n"]/g, '');
}

function healifyScan(root, framePath, depth) {
  if (depth > MAX_DEPTH || results.length >= MAX_NODES) return;

  var nodes = root.querySelectorAll('*');
  var frameIndex = 0;

  for (var i = 0; i < nodes.length; i++) {
    if (results.length >= MAX_NODES) return;
    var el = nodes[i];
    var tag = el.tagName ? el.tagName.toLowerCase() : '';

    var isCandidate = el.getAttribute('role') ||
      tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea' || tag === 'select';
    if (isCandidate) {
      var role = healifyRoleOf(el, tag);
      if (role) {
        var entry = { role: role, name: healifyNameOf(el) };
        if (framePath) entry.frame = framePath;
        results.push(entry);
      }
    }

    /* Shadow DOM abierto: mismo contexto de locator que el documento que lo contiene
       (Playwright y los selectores CSS lo atraviesan solos), así que NO lleva marca de frame. */
    if (el.shadowRoot) healifyScan(el.shadowRoot, framePath, depth + 1);

    if (tag === 'iframe' || tag === 'frame') {
      var label = healifyFrameLabel(el, frameIndex);
      frameIndex++;
      try {
        var doc = el.contentDocument;
        if (doc) healifyScan(doc, framePath ? framePath + ' > ' + label : label, depth + 1);
      } catch (e) {
        /* cross-origin: inaccesible por seguridad, se saltea sin romper el resto del scan */
      }
    }
  }
}

healifyScan(document, '', 0);
return results;
`.trim()

/**
 * Valida y formatea lo que devolvió `BROWSER_PROBE_SCRIPT`. Nunca confiar a ciegas en algo que
 * vino de `executeScript`/`execute`: puede ser `null`, un array vacío, o (con un driver raro)
 * cualquier otra cosa. `undefined` cuando no hay nada aprovechable — mismo criterio que cuando
 * Playwright no generó el attachment: el motor cae a la heurística a ciegas de siempre.
 */
export function domContextFromProbeResult(raw: unknown): string | undefined {
  if (!Array.isArray(raw)) return undefined

  const elements: PageElement[] = raw
    .filter((item): item is PageElement => {
      if (typeof item !== 'object' || item === null) return false
      const candidate = item as Partial<PageElement>
      return typeof candidate.role === 'string' && typeof candidate.name === 'string'
    })
    .map((item) => (typeof item.frame === 'string' && item.frame ? item : { role: item.role, name: item.name }))

  if (elements.length === 0) return undefined
  return formatPageElements(elements)
}

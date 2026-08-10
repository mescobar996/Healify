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
 * Devuelve `{ role, name, frame?, testId?, testIdAttr?, shadowDepth?, shadowPath? }[]` de los
 * elementos interactivos de la página, con el mismo criterio de nombre accesible en toda la
 * escalera: aria-label, texto visible, placeholder, valor — el primero que exista. Cuando el
 * elemento tiene un atributo de test-id (data-testid/data-cy/data-qa/data-test/data-e2e) se
 * incluye con su nombre de atributo real, para que el motor pueda sugerir ese testid sin
 * inventarlo ni reescribirlo. Cuando el elemento vive dentro de shadow DOM (MEJORA 3) se
 * incluye cuántos shadowRoots hay que atravesar (`shadowDepth`) y la cadena de hosts
 * (`shadowPath`, ej. `['x-card', 'inner-widget']`) — los selectores CSS/XPath no atraviesan
 * shadow DOM por especificación, así que el motor necesita saberlo para avisar el pierce.
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
/**
 * Derivación de rol y nombre accesible, compartida entre el sondeo y la búsqueda.
 *
 * Vive como constante y no duplicada en cada script a propósito: si el probe identifica un
 * elemento con un criterio y el buscador lo busca con otro, la sugerencia que sale del sondeo
 * no se puede volver a encontrar — que es exactamente el bug que tuvo `resolveElement` hasta
 * la 2.1.0. Un solo lugar, un solo criterio.
 */
const ACCESSIBLE_NAME_HELPERS = `
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

function healifyIsCandidate(el, tag) {
  return el.getAttribute('role') ||
    tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea' || tag === 'select';
}
`.trim()

/**
 * Busca UN elemento por rol + nombre accesible, atravesando shadow DOM abierto e iframes
 * same-origin. Devuelve el elemento (no un descriptor) o `null`.
 *
 * Existe porque el locator que sale de una curación no se podía volver a resolver cuando el
 * elemento vivía dentro de un shadow root: `document.querySelector` y `document.evaluate`
 * (XPath) **no atraviesan shadow DOM**, por especificación. El sondeo veía el botón, proponía
 * el selector correcto, y el reintento no lo encontraba — el soporte de shadow DOM estaba
 * hecho a medias, ciego justo en el último paso.
 *
 * Los dos argumentos (rol y nombre, en ese orden) se leen de `arguments`, no de parámetros
 * nombrados, para que el MISMO string sirva en los tres adapters sin envoltorios distintos:
 * `new Function(SCRIPT)(role, name)` en Cypress, `executeScript(SCRIPT, role, name)` en
 * Selenium, `execute(SCRIPT, role, name)` en WebdriverIO. Un solo script, una sola forma de
 * invocarlo.
 *
 * ES5 igual que el sondeo, por el mismo motivo: corre en el browser bajo test.
 */
export const BROWSER_FIND_BY_ROLE_SCRIPT = `
var role = arguments[0];
var name = arguments[1];
var MAX_DEPTH = 12;
var MAX_NODES = 3000;
var seen = 0;

${ACCESSIBLE_NAME_HELPERS}

function healifySearch(root, depth) {
  if (depth > MAX_DEPTH || seen >= MAX_NODES) return null;
  var nodes = root.querySelectorAll('*');

  for (var i = 0; i < nodes.length; i++) {
    if (seen >= MAX_NODES) return null;
    var el = nodes[i];
    seen++;
    var tag = el.tagName ? el.tagName.toLowerCase() : '';

    if (healifyIsCandidate(el, tag) && healifyRoleOf(el, tag) === role && healifyNameOf(el) === name) {
      return el;
    }

    if (el.shadowRoot) {
      var inShadow = healifySearch(el.shadowRoot, depth + 1);
      if (inShadow) return inShadow;
    }

    if (tag === 'iframe' || tag === 'frame') {
      try {
        var doc = el.contentDocument;
        if (doc) {
          var inFrame = healifySearch(doc, depth + 1);
          if (inFrame) return inFrame;
        }
      } catch (e) {
        /* cross-origin: inaccesible por seguridad */
      }
    }
  }
  return null;
}

return healifySearch(document, 0);
`.trim()

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

/* Atributo de test-id del elemento, en el orden de preferencia del motor (TESTID_ATTRS de
   healing-engine.ts). '' si ninguno. Se conserva el atributo REAL (data-cy en vez de
   data-testid): reescribir a otro atributo inventaría un selector que no existe en el DOM. */
function healifyTestIdAttr(el) {
  var t = el.getAttribute('data-testid');
  if (t) return 'data-testid';
  t = el.getAttribute('data-cy');
  if (t) return 'data-cy';
  t = el.getAttribute('data-qa');
  if (t) return 'data-qa';
  t = el.getAttribute('data-test');
  if (t) return 'data-test';
  t = el.getAttribute('data-e2e');
  if (t) return 'data-e2e';
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

/* Identificador del HOST de un shadow root, para el shadowPath: el componente que hay que
   atravesar para llegar al elemento. Se prefiere el id (selector CSS válido, desambiguador
   entre varios hosts del mismo tag) y se cae al tag name del componente. */
function healifyShadowLabel(el) {
  var id = el.getAttribute('id');
  return id ? '#' + id : (el.tagName ? el.tagName.toLowerCase() : 'unknown');
}

function healifyScan(root, framePath, depth, shadowDepth, shadowPath) {
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
        var testIdAttr = healifyTestIdAttr(el);
        if (testIdAttr) {
          entry.testId = el.getAttribute(testIdAttr);
          entry.testIdAttr = testIdAttr;
        }
        if (framePath) entry.frame = framePath;
        if (shadowDepth > 0) {
          entry.shadowDepth = shadowDepth;
          entry.shadowPath = shadowPath;
        }
        results.push(entry);
      }
    }

    /* Shadow DOM abierto (MEJORA 3): mismo contexto de locator que el documento que lo
       contiene en el sentido de que no exige cambiar de documento (a diferencia del iframe),
       pero los selectores CSS/XPath NO lo atraviesan por especificación — hay que hacer pierce
       de cada shadowRoot. Se registra cuántos niveles de shadow hay que atravesar
       (shadowDepth) y la cadena de componentes hosts (shadowPath), para que el motor avise
       cómo llegar al elemento en vez de sugerir un locator que nunca resuelve. */
    if (el.shadowRoot) {
      healifyScan(el.shadowRoot, framePath, depth + 1, (shadowDepth || 0) + 1,
        (shadowPath || []).concat(healifyShadowLabel(el)));
    }

    if (tag === 'iframe' || tag === 'frame') {
      var label = healifyFrameLabel(el, frameIndex);
      frameIndex++;
      try {
        var doc = el.contentDocument;
        /* El documento del iframe es otro documento: el contexto de shadow arranca de cero ahí. */
        if (doc) healifyScan(doc, framePath ? framePath + ' > ' + label : label, depth + 1, 0, undefined);
      } catch (e) {
        /* cross-origin: inaccesible por seguridad, se saltea sin romper el resto del scan */
      }
    }
  }
}

healifyScan(document, '', 0, 0, undefined);
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
    .map((item) => {
      // No se confía en el objeto crudo: se reconstruye campo por campo y se preservan
      // testId/testIdAttr cuando existen (el testid real del DOM es la MEJORA 1) y
      // shadowDepth/shadowPath cuando el elemento vive dentro de shadow DOM (MEJORA 3).
      const clean: PageElement = { role: item.role, name: item.name }
      if (typeof item.frame === 'string' && item.frame) clean.frame = item.frame
      if (typeof item.testId === 'string' && item.testId) {
        clean.testId = item.testId
        if (typeof item.testIdAttr === 'string' && item.testIdAttr) clean.testIdAttr = item.testIdAttr
      }
      if (typeof item.shadowDepth === 'number' && item.shadowDepth > 0) {
        clean.shadowDepth = item.shadowDepth
        if (Array.isArray(item.shadowPath)) {
          clean.shadowPath = item.shadowPath.filter((s): s is string => typeof s === 'string')
        }
      }
      return clean
    })

  if (elements.length === 0) return undefined
  return formatPageElements(elements)
}

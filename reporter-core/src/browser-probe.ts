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
 * Devuelve `{ role, name }[]` de los elementos interactivos de la página, con el mismo criterio
 * de nombre accesible en toda la escalera: aria-label, texto visible, placeholder, valor — el
 * primero que exista. ES5 a propósito (var, sin arrow functions): corre en cualquier motor de
 * JS que el browser bajo test tenga, sin asumir soporte moderno.
 */
export const BROWSER_PROBE_SCRIPT = `
var nodes = document.querySelectorAll('button, a, input, textarea, select, [role]');
var seen = [];
var results = [];
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (seen.indexOf(el) !== -1) continue;
  seen.push(el);

  var role = el.getAttribute('role');
  var tag = el.tagName.toLowerCase();
  if (!role) {
    if (tag === 'a') role = el.hasAttribute('href') ? 'link' : null;
    else if (tag === 'button') role = 'button';
    else if (tag === 'select') role = 'combobox';
    else if (tag === 'textarea') role = 'textbox';
    else if (tag === 'input') {
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox') role = 'checkbox';
      else if (type === 'radio') role = 'radio';
      else if (type === 'submit' || type === 'button') role = 'button';
      else if (type === 'search') role = 'searchbox';
      else if (type === 'hidden') role = null;
      else role = 'textbox';
    }
  }
  if (!role) continue;

  var name = '';
  var ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    name = ariaLabel.trim();
  } else {
    var text = (el.innerText || el.textContent || '').trim();
    if (text) {
      name = text.split('\\n')[0].trim();
    } else {
      var placeholder = el.getAttribute('placeholder');
      if (placeholder) {
        name = placeholder.trim();
      } else if (typeof el.value === 'string' && el.value.trim()) {
        name = el.value.trim();
      }
    }
  }
  results.push({ role: role, name: name });
}
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

  const elements: PageElement[] = raw.filter((item): item is PageElement => {
    if (typeof item !== 'object' || item === null) return false
    const candidate = item as Partial<PageElement>
    return typeof candidate.role === 'string' && typeof candidate.name === 'string'
  })

  if (elements.length === 0) return undefined
  return formatPageElements(elements)
}

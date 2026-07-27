/**
 * Lectura del árbol de accesibilidad que el framework capturó de la página real.
 *
 * Playwright escribe este árbol solo, en `error-context.md`, cada vez que un test falla
 * (ver `_snapshotForAI` en playwright/lib/index.js). Trae los roles y los nombres accesibles
 * REALES de lo que había en pantalla en ese momento — que es exactamente lo que al motor le
 * faltaba para dejar de adivinar nombres por diccionario.
 *
 * Formato real (capturado de una corrida, no inventado):
 *
 *     # Page snapshot
 *
 *     ```yaml
 *     - generic [active] [ref=e1]:
 *       - heading "Tienda" [level=1] [ref=e2]
 *       - navigation [ref=e3]:
 *         - link "Inicio" [ref=e4] [cursor=pointer]:
 *           - /url: /inicio
 *       - textbox "Correo" [ref=e7]
 *       - button "Comprar" [ref=e8]
 *     ```
 *
 * El parseo es por líneas y regex a propósito: no se agrega un parser de YAML ni de HTML.
 * `reporter-core` se bundlea dentro de los cinco paquetes públicos, así que cada dependencia
 * nueva se paga cinco veces.
 */

export interface PageElement {
  role: string
  /** Nombre accesible. Vacío para elementos que no exponen uno (`generic`, `navigation`). */
  name: string
}

/**
 * Inverso de `parsePageSnapshot`: convierte elementos ya extraídos (por ejemplo, de una
 * consulta en vivo al DOM real vía Selenium/WebdriverIO) al mismo formato de líneas que el
 * parser sabe leer. Así el motor recibe siempre el mismo tipo de dato, sin importar si vino de
 * un archivo que escribió Playwright o de una consulta hecha en el momento del fallo.
 */
export function formatPageElements(elements: PageElement[]): string {
  return elements.map((e) => (e.name ? `- ${e.role} "${e.name.replace(/"/g, '\\"')}"` : `- ${e.role}`)).join('\n')
}

/** Líneas de propiedad, no de elemento: `- /url: /inicio`. */
const PROPERTY_LINE = /^\s*-\s*\//
/** `- button "Comprar" [ref=e8]:` → role + nombre opcional, ignorando atributos y `:` final. */
const ELEMENT_LINE = /^\s*-\s+([a-zA-Z][\w-]*)\s*(?:"((?:[^"\\]|\\.)*)")?/
/** `- text: Correo` — nodo de texto suelto; el valor está después de los dos puntos. */
const TEXT_LINE = /^\s*-\s+text:\s*(.+?)\s*$/

/**
 * Extrae los elementos del árbol. Tolerante por diseño: cualquier línea que no encaje se
 * saltea en silencio. Este dato viene de un archivo generado por otra herramienta, que puede
 * cambiar de formato entre versiones — si eso pasa, el motor tiene que degradar a la
 * heurística a ciegas, nunca romper la corrida del usuario.
 */
export function parsePageSnapshot(markdown: string | undefined): PageElement[] {
  if (!markdown) return []

  const elements: PageElement[] = []

  for (const line of markdown.split('\n')) {
    if (PROPERTY_LINE.test(line)) continue

    const textMatch = line.match(TEXT_LINE)
    if (textMatch) {
      elements.push({ role: 'text', name: unescapeName(textMatch[1]) })
      continue
    }

    const match = line.match(ELEMENT_LINE)
    if (!match) continue

    const role = match[1]
    // `yaml` es la apertura del bloque de código, no un elemento de la página.
    if (role === 'yaml') continue

    elements.push({ role, name: match[2] ? unescapeName(match[2]) : '' })
  }

  return elements
}

function unescapeName(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

/** Elementos de un rol dado; con `name`, solo los que tienen exactamente ese nombre. */
export function findMatches(elements: PageElement[], role: string, name?: string): PageElement[] {
  return elements.filter((e) => e.role === role && (name === undefined || e.name === name))
}

/** ¿Existe de verdad en la página un elemento con este rol y este nombre accesible? */
export function existsInPage(elements: PageElement[], role: string, name: string): boolean {
  return findMatches(elements, role, name).length > 0
}

/** Palabras significativas de un selector: `#comprar-ahora-a1b2c3` → ['comprar', 'ahora']. */
export function selectorTokens(selector: string): string[] {
  return selector
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñ]+/i)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !/^[0-9a-f]{6,}$/.test(token))
}

/**
 * De todos los elementos reales de un rol, cuál corresponde al selector que se rompió.
 *
 * Devuelve `null` sin un ganador claro — preferimos no sugerir nada antes que mandar al
 * usuario a un elemento equivocado, que es peor que no sugerir: rompe la confianza y encima
 * puede hacer que el test pase probando otra cosa.
 *
 * - Un solo elemento de ese rol en la página: es ese, sin más vueltas.
 * - Varios: gana el que comparte alguna palabra con el selector roto
 *   (`#comprar-ahora-a1b2c3` → botón "Comprar"). Si empatan dos, no se elige.
 */
/**
 * Roles con los que un test interactúa. Se usan para buscar el elemento cuando el motor no
 * pudo deducir del texto del selector qué tipo de cosa era (`#comprar-ahora-a1b2c3` no cae en
 * ningún diccionario, pero en la página hay un `button "Comprar"` que coincide de sobra).
 */
const INTERACTIVE_ROLES = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'menuitem', 'tab', 'option', 'searchbox', 'switch']

/**
 * Busca en la página el elemento que corresponde al selector roto, sin depender de que el
 * motor haya adivinado bien el tipo de elemento.
 *
 * Prioriza el rol esperado si el motor pudo deducir uno; si ahí no hay un ganador claro,
 * busca entre todos los roles interactivos. Que la evidencia mande por sobre el diccionario
 * es justamente el punto: `#comprar-ahora-a1b2c3` no activa ninguna palabra conocida, pero el
 * botón "Comprar" de la página lo resuelve solo.
 */
export function bestElementFor(
  elements: PageElement[],
  selector: string,
  preferredRole?: string
): PageElement | null {
  if (preferredRole) {
    const name = bestNameFor(elements, preferredRole, selector)
    if (name !== null) return { role: preferredRole, name }
  }

  const tokens = selectorTokens(selector)
  if (tokens.length === 0) return null

  const scored = elements
    .filter((e) => INTERACTIVE_ROLES.includes(e.role) && e.name.length > 0)
    .map((element) => {
      const nameTokens = selectorTokens(element.name)
      const score = nameTokens.filter((nameToken) =>
        tokens.some((token) => token === nameToken || token.startsWith(nameToken) || nameToken.startsWith(token))
      ).length
      return { element, score }
    })
    .filter((s) => s.score > 0)

  if (scored.length === 0) return null

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a))
  if (scored.filter((s) => s.score === best.score).length > 1) return null

  return best.element
}

export function bestNameFor(elements: PageElement[], role: string, selector: string): string | null {
  const candidates = findMatches(elements, role).filter((e) => e.name.length > 0)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].name

  const tokens = selectorTokens(selector)
  if (tokens.length === 0) return null

  const scored = candidates.map((candidate) => {
    const nameTokens = selectorTokens(candidate.name)
    const score = nameTokens.filter((nameToken) =>
      tokens.some((token) => token === nameToken || token.startsWith(nameToken) || nameToken.startsWith(token))
    ).length
    return { name: candidate.name, score }
  })

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a))
  if (best.score === 0) return null
  if (scored.filter((s) => s.score === best.score).length > 1) return null

  return best.name
}
